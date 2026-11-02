import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logCallEvent } from '../lib/callEvents';

/**
 * Native WebRTC 1-on-1 call hook (voice or video) using Supabase Realtime broadcast
 * for signaling. Media flows peer-to-peer; Supabase only relays small JSON messages.
 *
 * Roles:
 *  - caller: startCall(type) -> captures media, creates the offer, re-sends it whenever
 *            the callee announces it is "ready".
 *  - callee: joinCall(type) (after accepting the ring) -> announces "ready", answers the
 *            caller's offer. The callee NEVER creates an offer, which prevents glare and
 *            call loops.
 *
 * Every call has a callId so duplicate/stale signals are ignored.
 */

const STUN_ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun.cloudflare.com:3478'] },
];

/*
 * TURN is minted per call by the `ice-servers` Edge Function: a static TURN login in a
 * VITE_ variable ships inside the public bundle, so anyone could relays traffic on our bill.
 * Server-side secrets stay server-side and only the expiring derived credential reaches us.
 * VITE_TURN_* remains as a local-dev escape hatch only.
 */
let cachedIceServers = STUN_ICE_SERVERS;
let cachedUntil = 0;
let pendingIce = null;
let iceServersFallbackReason = null;

// An Edge Function cold start can outrun a short timeout, and the STUN-only fallback that
// follows is what a call over mobile data or a strict NAT then reports as "Connection
// failed" — so the request gets room for a cold start and one retry before we give up the
// relay. The first dial of a session waits on this inside the caller's 45 s ring budget, so
// the two tries are bounded rather than both getting the full window.
async function requestIceServers(timeout = 15000) {
  const { data, error } = await supabase.functions.invoke('ice-servers', { method: 'GET', timeout });
  if (error) throw error;
  if (!Array.isArray(data?.iceServers) || data.iceServers.length === 0) {
    throw new Error('ice-servers returned no servers');
  }
  const ttl = Number(data.ttl) || 300;
  // Refresh at half the credential lifetime so a long consult never dials with dead creds.
  cachedUntil = Date.now() + Math.max(60, Math.floor(ttl / 2)) * 1000;
  cachedIceServers = data.iceServers;
  iceServersFallbackReason = null;
  return cachedIceServers;
}

export const hasTurnServer = (servers) =>
  (servers || []).some((server) =>
    [].concat(server?.urls || []).some((url) => String(url).startsWith('turn')));

export const getIceServersFallbackReason = () => iceServersFallbackReason;

export async function getIceServers() {
  if (Date.now() < cachedUntil) return cachedIceServers;
  if (!pendingIce) {
    pendingIce = requestIceServers()
      .catch(async (err) => {
        console.warn('[webrtc] ice-servers unavailable, retrying once:', err?.message || err);
        try {
          return await requestIceServers(6000);
        } catch (retryErr) {
          console.warn('[webrtc] ice-servers still unavailable, falling back to STUN-only:', retryErr?.message || retryErr);
          const turnUrl = import.meta.env.VITE_TURN_URL;
          cachedIceServers = turnUrl
            ? [...STUN_ICE_SERVERS, {
              urls: turnUrl.split(',').map((u) => u.trim()).filter(Boolean),
              username: import.meta.env.VITE_TURN_USERNAME,
              credential: import.meta.env.VITE_TURN_CREDENTIAL,
            }]
            : STUN_ICE_SERVERS;
          iceServersFallbackReason = `${err?.message || err} / ${retryErr?.message || retryErr}`;
          // A cold start must not cost the rest of the session its relay, so this
          // negative cache is shorter than the old 60 s one.
          cachedUntil = Date.now() + 15000;
          return cachedIceServers;
        }
      })
      .finally(() => { pendingIce = null; });
  }
  return pendingIce;
}

const buildRtcConfig = (servers) => {
  const iceServers = servers?.length ? servers : STUN_ICE_SERVERS;
  console.log('[webrtc] configuring RTCPeerConnection with iceServers:', iceServers);
  return {
    iceServers,
    iceCandidatePoolSize: 2,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };
};

/*
 * Long-lived, shared signaling channels (one per conversation).
 * supabase.channel(topic) returns the EXISTING instance for a topic and removeChannel()
 * is asynchronous, so tearing a channel down and re-creating it quickly (React StrictMode,
 * re-renders) hands back a half-closed channel that silently drops messages. Keeping one
 * persistent channel per conversation avoids that. Stored on globalThis to survive HMR.
 */
const registry = (globalThis.__mcSignalingChannels ||= new Map());

/*
 * A CHANNEL_ERROR or TIMED_OUT channel does not recover on its own, so every signal
 * would stay queued until the page reloads. Rebuild it and carry listeners and the
 * pending queue across.
 */
function retrySignalingChannel(topic, entry) {
  if (entry.retryTimer || registry.get(topic) !== entry) return;
  entry.retryTimer = setTimeout(() => {
    entry.retryTimer = null;
    if (registry.get(topic) !== entry) return;
    console.log('[webrtc] rebuilding signaling channel for', topic);
    registry.delete(topic);
    supabase.removeChannel(entry.channel);
    const next = getSignalingChannel(topic);
    entry.listeners.forEach((fn) => next.listeners.add(fn));
    entry.queue.forEach((payload) => next.queue.push(payload));
  }, 1500);
}

function getSignalingChannel(topic) {
  const existing = registry.get(topic);
  if (existing) {
    console.log('[webrtc] getSignalingChannel existing for', topic, 'ready:', existing.ready);
    return existing;
  }

  console.log('[webrtc] creating new channel for', topic);
  const channel = supabase.channel(topic);
  const entry = { channel, listeners: new Set(), ready: false, queue: [], retryTimer: null };

  channel.on('broadcast', { event: 'signal' }, (data) => {
    const payload = data?.payload;
    console.log('[webrtc] RX on', topic, payload?.type, 'from:', payload?.from);
    entry.listeners.forEach((fn) => {
      try { fn(payload); } catch (err) { console.error('[webrtc] signal handler error', err); }
    });
  });

  channel.subscribe((status) => {
    console.log('[webrtc] channel subscribe status on', topic, ':', status);
    if (status === 'SUBSCRIBED') {
      entry.ready = true;
      const pending = entry.queue.splice(0);
      console.log('[webrtc] channel ready, flushing', pending.length, 'queued messages on', topic);
      pending.forEach((payload) => channel.send({ type: 'broadcast', event: 'signal', payload }));
      entry.listeners.forEach((fn) => fn({ type: '__subscribed' }));
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      entry.ready = false;
      retrySignalingChannel(topic, entry);
    }
  });

  registry.set(topic, entry);
  return entry;
}

export const newCallId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const tuneSenderParameters = async (pc) => {
  if (!pc) return;
  try {
    const senders = pc.getSenders();
    for (const sender of senders) {
      if (sender.track?.kind === 'video' && typeof sender.getParameters === 'function') {
        const params = sender.getParameters();
        if (params?.encodings && params.encodings.length > 0) {
          params.encodings[0].maxBitrate = 2500000; // 2.5 Mbps for crisp HD
          params.encodings[0].networkPriority = 'high';
          params.degradationPreference = 'maintain-resolution'; // Prevents blurriness & downscaling
          await sender.setParameters(params);
          console.log('[webrtc] tuned video sender to 2.5 Mbps HD quality (maintain-resolution)');
        }
      }
    }
  } catch (err) {
    console.warn('[webrtc] sender parameter tuning notice:', err);
  }
};

/*
 * The sender carrying our video track. A sender is matched by track kind only:
 * every sender has a dtlsTransport once the connection is up, so a looser test
 * returns the audio sender and replaceTrack(videoTrack) then throws a kind mismatch.
 */
const findVideoSender = (pc) => pc?.getSenders().find((s) => s.track?.kind === 'video') || null;

/*
 * Which candidate pair actually carried the call: host (LAN), srflx (P2P through NAT)
 * or relay (TURN). This is the number the STUN-only vs TURN argument needs, and it is
 * only readable from getStats once a pair has been selected.
 */
const describeTransport = async (pc) => {
  try {
    const stats = await pc.getStats();
    let selectedPairId = null;
    const pairs = [];
    stats.forEach((entry) => {
      if (entry.type === 'transport' && entry.selectedCandidatePairId) selectedPairId = entry.selectedCandidatePairId;
      if (entry.type === 'candidate-pair') pairs.push(entry);
    });
    const pair = pairs.find((p) => p.id === selectedPairId)
      || pairs.find((p) => p.state === 'succeeded' && (p.selected || p.nominated));
    if (!pair) return null;
    const local = stats.get(pair.localCandidateId);
    const remote = stats.get(pair.remoteCandidateId);
    return {
      localType: local?.candidateType || null,
      remoteType: remote?.candidateType || null,
      protocol: local?.protocol || null,
      relayProtocol: local?.relayProtocol || null,
    };
  } catch {
    return null;
  }
};

/**
 * Swap in or add an outgoing video track. Renegotiates only when the connection
 * has no video sender yet (an audio call that later turns the camera on).
 */
const setOutgoingVideoTrack = async (pc, track, stream, sendRenegotiateOffer) => {
  const sender = findVideoSender(pc);
  if (sender) {
    await sender.replaceTrack(track);
    await tuneSenderParameters(pc);
    return;
  }
  pc.addTrack(track, stream);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await tuneSenderParameters(pc);
  await sendRenegotiateOffer();
};

async function getMedia(type, facing = 'user') {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error('Camera/microphone requires a secure (HTTPS) connection.');
    err.code = 'INSECURE_CONTEXT';
    throw err;
  }
  const audioConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  if (type === 'audio') {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
    return { stream, type: 'audio' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: {
        facingMode: facing ? { ideal: facing } : undefined,
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
      },
    });
    return { stream, type: 'video' };
  } catch (err1) {
    console.warn('[webrtc] HD camera request failed, retrying generic video...', err1);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: true,
      });
      return { stream, type: 'video' };
    } catch (err2) {
      console.warn('[webrtc] camera unavailable, degrading to voice...', err2);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
      return { stream, type: 'audio', degraded: true };
    }
  }
}

export default function useWebRTCCall({ selfId, peerId }) {
  const [callStatus, setCallStatusState] = useState('idle'); // idle | connecting | connected | ended
  const [callType, setCallType] = useState('video');
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [pcState, setPcState] = useState('new');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const [cameraRotation, setCameraRotation] = useState(0); // 0 | 90 | 180 | 270
  const [error, setError] = useState(null);
  const [role, setRole] = useState(null); // caller | callee | null

  const topic = selfId && peerId ? `rtc_${[selfId, peerId].sort().join('_')}` : null;

  const statusRef = useRef('idle');
  const roleRef = useRef(null);
  const callIdRef = useRef(null);
  const facingModeRef = useRef('user');
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const offerPayloadRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const answeredCallIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const localCandidatesRef = useRef([]);
  const disconnectTimerRef = useRef(null);
  const iceRestartTriedRef = useRef(false);
  const transportLoggedRef = useRef(false);
  const lastPcStateKeyRef = useRef('');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const setCallStatus = useCallback((next) => {
    statusRef.current = next;
    setCallStatusState(next);
  }, []);

  const setRoleBoth = useCallback((next) => {
    roleRef.current = next;
    setRole(next);
  }, []);

  const log = useCallback((event, detail = {}, callId = callIdRef.current) => {
    logCallEvent(callId, selfId, event, detail);
  }, [selfId]);

  const send = useCallback((msg) => {
    if (!topic) {
      console.warn('[webrtc] cannot send, topic is missing');
      return;
    }
    const entry = getSignalingChannel(topic);
    const payload = { ...msg, from: selfId };
    console.log('[webrtc] TX on', topic, payload.type, 'channelReady:', entry.ready);
    if (entry.ready) {
      entry.channel.send({ type: 'broadcast', event: 'signal', payload }).then((res) => {
        console.log('[webrtc] send resolved for', payload.type, ':', res);
      }).catch((err) => {
        console.error('[webrtc] send error for', payload.type, ':', err);
      });
    } else {
      console.log('[webrtc] channel not ready yet, queuing', payload.type);
      entry.queue.push(payload);
    }
  }, [topic, selfId]);

  const attachMedia = useCallback(() => {
    const attach = (el, stream, muted) => {
      if (!el) return;
      el.muted = !!muted;
      el.defaultMuted = !!muted;
      el.playsInline = true;
      try {
        el.setAttribute('playsinline', '');
        el.setAttribute('webkit-playsinline', '');
      } catch {}
      if (el.srcObject !== stream) {
        el.srcObject = stream || null;
      }
      if (stream && stream.getTracks().length > 0) {
        const p = el.play?.();
        if (p && typeof p.catch === 'function') {
          p.catch((err) => {
            if (err?.name !== 'AbortError') {
              console.warn('[webrtc] play prevented/blocked:', err?.name);
            }
          });
        }
      }
    };
    attach(localVideoRef.current, localStreamRef.current, true);
    attach(remoteVideoRef.current, remoteStreamRef.current, false);
    attach(remoteAudioRef.current, remoteStreamRef.current, false);
  }, []);

  const cleanup = useCallback((keepPendingCallId = null) => {
    console.log('[webrtc] cleanup called, keepPendingCallId:', keepPendingCallId);
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    iceRestartTriedRef.current = false;
    transportLoggedRef.current = false;
    lastPcStateKeyRef.current = '';
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    setHasRemoteVideo(false);
    if (pcRef.current) {
      const pc = pcRef.current;
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      try { pc.close(); } catch { /* ignore */ }
      pcRef.current = null;
    }
    [localVideoRef, remoteVideoRef, remoteAudioRef].forEach((r) => {
      if (r.current) r.current.srcObject = null;
    });
    if (keepPendingCallId) {
      pendingCandidatesRef.current = pendingCandidatesRef.current.filter((c) => c.callId === keepPendingCallId);
    } else {
      pendingCandidatesRef.current = [];
    }
    localCandidatesRef.current = [];
    offerPayloadRef.current = null;
    setPcState('new');
  }, []);

  const flushCandidates = useCallback(async (callId) => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const forThisCall = pendingCandidatesRef.current.filter((c) => c.callId === callId);
    pendingCandidatesRef.current = pendingCandidatesRef.current.filter((c) => c.callId !== callId);
    console.log('[webrtc] flushing', forThisCall.length, 'queued candidates for callId:', callId);
    log('candidates_flushed', { count: forThisCall.length }, callId);
    for (const c of forThisCall) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c.candidate));
      } catch (err) {
        console.warn('[webrtc] addIceCandidate failed in flush', err);
      }
    }
  }, [log]);

  const finishCall = useCallback(({ notify, reason } = {}) => {
    console.log('[webrtc] finishCall called, notify:', notify, 'reason:', reason);
    log('call_finish', { notify: !!notify, reason: reason || null, status: statusRef.current });
    if (notify && callIdRef.current) {
      send({ type: 'hangup', callId: callIdRef.current });
    }
    cleanup();
    if (reason) setError(reason);
    setIsMuted(false);
    setIsCameraOff(false);
    setFacingMode('user');
    facingModeRef.current = 'user';
    setCameraRotation(0);
    if (statusRef.current !== 'idle') setCallStatus('ended');
  }, [cleanup, log, send, setCallStatus]);

  /**
   * Announce a locally created renegotiation offer (camera turned on mid-call).
   * Refuses when the peer is offering at the same time, otherwise both sides sit in
   * have-local-offer and every setRemoteDescription afterwards throws.
   */
  const sendRenegotiationOffer = useCallback(async (pc) => {
    if (pcRef.current !== pc) return;
    if (pc.signalingState !== 'have-local-offer') return;
    offerPayloadRef.current = {
      type: 'offer',
      callId: callIdRef.current,
      callType: 'video',
      sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
    };
    send(offerPayloadRef.current);
  }, [send]);

  /*
   * 'disconnected' is recoverable — a Wi-Fi handoff or a brief NAT pinhole lapse
   * looks exactly like a real drop. Wait, then restart ICE once, then give up.
   */
  const watchDisconnected = useCallback((pc) => {
    if (disconnectTimerRef.current || pcRef.current !== pc) return;
    disconnectTimerRef.current = setTimeout(() => {
      disconnectTimerRef.current = null;
      if (pcRef.current !== pc) return;
      if (pc.connectionState === 'connected' || pc.connectionState === 'completed') return;
      if (!iceRestartTriedRef.current) {
        iceRestartTriedRef.current = true;
        log('ice_restart', { why: 'disconnected_timeout' });
        try { pc.restartIce(); } catch { /* browser without restartIce */ }
        setError('Connection unstable — reconnecting…');
        watchDisconnected(pc);
        return;
      }
      finishCall({ notify: true, reason: 'Connection lost. Please call again.' });
    }, 8000);
  }, [finishCall, log]);

  const createPeerConnection = useCallback((callId, iceServers) => {
    console.log('[webrtc] createPeerConnection for callId:', callId);
    const pc = new RTCPeerConnection(buildRtcConfig(iceServers));
    pcRef.current = pc;
    transportLoggedRef.current = false;
    lastPcStateKeyRef.current = '';
    log('ice_config', {
      servers: iceServers?.length || 0,
      hasTurn: hasTurnServer(iceServers),
      stunFallback: getIceServersFallbackReason(),
    }, callId);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log('[webrtc] onicecandidate:', e.candidate.candidate?.slice(0, 55));
        const candObj = {
          candidate: e.candidate.candidate,
          sdpMid: e.candidate.sdpMid,
          sdpMLineIndex: e.candidate.sdpMLineIndex,
          usernameFragment: e.candidate.usernameFragment,
        };
        localCandidatesRef.current.push(candObj);
        send({
          type: 'candidate',
          callId,
          candidate: candObj,
        });
      }
    };

    pc.ontrack = (e) => {
      console.log('[webrtc] ontrack event received, track kind:', e.track.kind);
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      const stream = remoteStreamRef.current;
      if (e.streams?.[0]) {
        e.streams[0].getTracks().forEach((track) => {
          if (!stream.getTracks().some((t) => t.id === track.id)) {
            stream.addTrack(track);
          }
        });
      }
      if (e.track && !stream.getTracks().some((t) => t.id === e.track.id)) {
        stream.addTrack(e.track);
      }
      if (e.track.kind === 'video') {
        setHasRemoteVideo(true);
        e.track.onended = () => setHasRemoteVideo(false);
      }
      attachMedia();
    };

    const onState = () => {
      if (pcRef.current !== pc) return;
      const state = pc.connectionState || pc.iceConnectionState;
      console.log('[webrtc] pc state change - connState:', pc.connectionState, 'iceState:', pc.iceConnectionState);
      const stateKey = `${pc.connectionState}|${pc.iceConnectionState}`;
      if (stateKey !== lastPcStateKeyRef.current) {
        lastPcStateKeyRef.current = stateKey;
        log('pc_state', { conn: pc.connectionState, ice: pc.iceConnectionState }, callId);
      }
      setPcState(state);
      const isConnected =
        pc.connectionState === 'connected' ||
        pc.connectionState === 'completed' ||
        pc.iceConnectionState === 'connected' ||
        pc.iceConnectionState === 'completed';

      if (isConnected) {
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        iceRestartTriedRef.current = false;
        setError(null);
        setCallStatus('connected');
        if (!transportLoggedRef.current) {
          transportLoggedRef.current = true;
          describeTransport(pc).then((transport) => {
            if (transport) log('transport_selected', transport, callId);
          });
        }
        if (remoteStreamRef.current) {
          const hasVideo = remoteStreamRef.current.getVideoTracks().some((t) => t.readyState === 'live');
          if (hasVideo) setHasRemoteVideo(true);
        }
        tuneSenderParameters(pc);
        attachMedia();
      } else if (pc.connectionState === 'closed') {
        console.log('[webrtc] peer connection closed, finishing call');
        finishCall({ notify: false });
      } else if (pc.connectionState === 'disconnected') {
        console.log('[webrtc] peer connection disconnected, watching for recovery');
        watchDisconnected(pc);
      } else if (pc.connectionState === 'failed' || pc.iceConnectionState === 'failed') {
        if (!iceRestartTriedRef.current) {
          iceRestartTriedRef.current = true;
          log('ice_restart', { why: 'connection_failed' }, callId);
          try { pc.restartIce(); } catch { /* browser without restartIce */ }
          return;
        }
        finishCall({ notify: true, reason: 'Connection failed. The network may be blocking peer-to-peer calls.' });
      }
    };
    pc.onconnectionstatechange = onState;
    pc.oniceconnectionstatechange = onState;

    return pc;
  }, [attachMedia, finishCall, log, send, setCallStatus, watchDisconnected]);

  const answerOffer = useCallback(async (msg) => {
    console.log('[webrtc] answerOffer starting for callId:', msg.callId);
    log('offer_answered', { callType: msg.callType || null }, msg.callId);
    answeredCallIdRef.current = msg.callId;
    callIdRef.current = msg.callId;
    pendingOfferRef.current = null;

    const requestedType = msg.callType === 'audio' ? 'audio' : 'video';
    setCallType(requestedType);

    try {
      const pc = createPeerConnection(msg.callId, await getIceServers());
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      console.log('[webrtc] callee applied remote offer');

      let media = null;
      try {
        media = await getMedia(requestedType);
        console.log('[webrtc] callee got media tracks:', media.stream.getTracks().map(t => t.kind));
      } catch (err) {
        console.warn('[webrtc] callee has no usable mic/camera, joining receive-only', err);
        log('media_unavailable_receive_only', { message: err?.name || err?.message || String(err) }, msg.callId);
        setError('Microphone/camera unavailable — you can listen but the other side cannot hear you.');
      }
      if (pcRef.current !== pc || callIdRef.current !== msg.callId) {
        media?.stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (media) {
        localStreamRef.current = media.stream;
        media.stream.getTracks().forEach((track) => pc.addTrack(track, media.stream));
        setCallType(media.type);
        setIsCameraOff(media.type === 'audio');
        attachMedia();
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('[webrtc] callee created answer and setLocalDescription');
      await tuneSenderParameters(pc);
      await flushCandidates(msg.callId);

      send({
        type: 'answer',
        callId: msg.callId,
        sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
      });
      console.log('[webrtc] callee sent answer');
      log('answer_sent', { candidates: localCandidatesRef.current?.length || 0 }, msg.callId);

      if (localCandidatesRef.current?.length) {
        for (const cand of localCandidatesRef.current) {
          send({
            type: 'candidate',
            callId: msg.callId,
            candidate: cand,
          });
        }
      }
    } catch (err) {
      console.error('[webrtc] failed to answer offer', err);
      log('answer_failed', { message: err?.message || String(err) }, msg.callId);
      finishCall({ notify: true, reason: 'Could not connect the call. Please try again.' });
    }
  }, [attachMedia, createPeerConnection, finishCall, flushCandidates, log, send]);

  // ----- Incoming signaling -----
  const handleSignal = useCallback(async (msg) => {
    if (!msg || !msg.type) return;

    if (msg.type === '__subscribed') {
      console.log('[webrtc] channel __subscribed, role:', roleRef.current);
      log('channel_subscribed', { role: roleRef.current });
      // (Re)subscribed: re-announce state so a missed message is recovered.
      if (roleRef.current === 'callee' && !pcRef.current) {
        log('ready_sent', { why: 'resubscribe' });
        send({ type: 'ready' });
      } else if (roleRef.current === 'caller' && offerPayloadRef.current &&
        pcRef.current?.signalingState === 'have-local-offer') {
        log('offer_resent', { why: 'resubscribe' });
        send(offerPayloadRef.current);
      }
      return;
    }

    if (msg.from === selfId) return;

    switch (msg.type) {
      case 'ready': {
        console.log('[webrtc] RX ready, role:', roleRef.current, 'hasOffer:', !!offerPayloadRef.current, 'sigState:', pcRef.current?.signalingState);
        log('ready_received', {
          role: roleRef.current,
          hasOffer: !!offerPayloadRef.current,
          sigState: pcRef.current?.signalingState || null,
        });
        if (roleRef.current === 'caller' && offerPayloadRef.current &&
          pcRef.current?.signalingState === 'have-local-offer') {
          console.log('[webrtc] caller sending offer in response to ready');
          log('offer_resent', { why: 'ready' });
          send(offerPayloadRef.current);
          if (localCandidatesRef.current?.length) {
            console.log('[webrtc] caller re-sending', localCandidatesRef.current.length, 'candidates in response to ready');
            for (const cand of localCandidatesRef.current) {
              send({
                type: 'candidate',
                callId: callIdRef.current,
                candidate: cand,
              });
            }
          }
        }
        break;
      }
      case 'offer': {
        console.log('[webrtc] RX offer, role:', roleRef.current, 'hasPc:', !!pcRef.current);
        log('offer_received', {
          role: roleRef.current,
          hasPc: !!pcRef.current,
          status: statusRef.current,
          callType: msg.callType || null,
        }, msg.callId);
        if (pcRef.current && statusRef.current === 'connected' && msg.callId === callIdRef.current) {
          if (pcRef.current.signalingState !== 'stable') {
            // Both sides toggled the camera at once: applying this offer now would throw.
            console.warn('[webrtc] renegotiation offer ignored, signalingState:', pcRef.current.signalingState);
            log('renegotiation_ignored', { sigState: pcRef.current.signalingState }, msg.callId);
            return;
          }
          console.log('[webrtc] handling renegotiation offer mid-call');
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            send({
              type: 'answer',
              callId: msg.callId,
              sdp: { type: pcRef.current.localDescription.type, sdp: pcRef.current.localDescription.sdp },
            });
            if (msg.callType === 'video') {
              setCallType('video');
            }
          } catch (err) {
            console.warn('[webrtc] renegotiation error:', err);
          }
          return;
        }
        if (roleRef.current === 'caller') {
          // we are calling; ignore peer offers (glare)
          log('offer_ignored_glare', { ourCallId: callIdRef.current, peerCallId: msg.callId }, msg.callId);
          return;
        }
        if (answeredCallIdRef.current === msg.callId) {
          log('offer_ignored_duplicate', {}, msg.callId);
          return; // duplicate re-send
        }
        if (roleRef.current === 'callee' && !pcRef.current) {
          await answerOffer(msg);
        } else {
          // Not accepted yet: keep it until the user accepts the ring.
          log('offer_queued_pending', { role: roleRef.current, status: statusRef.current }, msg.callId);
          pendingOfferRef.current = { ...msg, receivedAt: Date.now() };
        }
        break;
      }
      case 'answer': {
        const pc = pcRef.current;
        console.log('[webrtc] RX answer, role:', roleRef.current, 'sigState:', pc?.signalingState, 'callId match:', msg.callId === callIdRef.current);
        log('answer_received', {
          role: roleRef.current,
          sigState: pc?.signalingState || null,
          callIdMatch: msg.callId === callIdRef.current,
        }, msg.callId);
        if (!pc || msg.callId !== callIdRef.current) return;
        if (pc.signalingState !== 'have-local-offer') return; // already applied
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          console.log('[webrtc] applied answer successfully');
          log('answer_applied', {}, msg.callId);
          await flushCandidates(msg.callId);

          if (localCandidatesRef.current?.length) {
            console.log('[webrtc] caller re-sending', localCandidatesRef.current.length, 'candidates to callee after answer');
            for (const cand of localCandidatesRef.current) {
              send({
                type: 'candidate',
                callId: msg.callId,
                candidate: cand,
              });
            }
          }
        } catch (err) {
          console.error('[webrtc] failed to apply answer', err);
          log('answer_apply_failed', { message: err?.message || String(err) }, msg.callId);
        }
        break;
      }
      case 'camera_toggle': {
        if (msg.callId === callIdRef.current) {
          if (msg.hasVideo) {
            setHasRemoteVideo(true);
            setCallType('video');
          } else {
            setHasRemoteVideo(false);
          }
        }
        break;
      }
      case 'candidate': {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription && msg.callId === callIdRef.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (err) {
            console.warn('[webrtc] addIceCandidate failed', err);
          }
        } else {
          pendingCandidatesRef.current.push({ callId: msg.callId, candidate: msg.candidate });
          if (pendingCandidatesRef.current.length > 200) {
            // Under a candidate flood, shed other calls first — the active call's
            // earliest candidates are the host candidates that make it connect.
            const activeCallId = callIdRef.current;
            const hasForeign = pendingCandidatesRef.current.some((c) => c.callId !== activeCallId);
            if (hasForeign) {
              pendingCandidatesRef.current = pendingCandidatesRef.current.filter((c) => c.callId === activeCallId);
            } else {
              pendingCandidatesRef.current.shift();
            }
          }
        }
        break;
      }
      case 'hangup': {
        console.log('[webrtc] RX hangup, active:', statusRef.current, 'msgCallId:', msg.callId, 'ourCallId:', callIdRef.current);
        log('hangup_received', { active: statusRef.current, ourCallId: callIdRef.current }, msg.callId || callIdRef.current);
        // A hangup for a call that already ended must not kill the one now in flight
        // between the same two people.
        const currentCallId = callIdRef.current || pendingOfferRef.current?.callId;
        if (msg.callId && currentCallId && msg.callId !== currentCallId) return;
        if (pendingOfferRef.current?.callId === msg.callId) pendingOfferRef.current = null;
        const active = statusRef.current === 'connecting' || statusRef.current === 'connected';
        if (!active) return;
        finishCall({ notify: false });
        break;
      }
      default:
        break;
    }
  }, [answerOffer, finishCall, flushCandidates, log, selfId, send]);

  const handleSignalRef = useRef(handleSignal);
  handleSignalRef.current = handleSignal;

  useEffect(() => {
    if (!topic) return undefined;
    const entry = getSignalingChannel(topic);
    const listener = (msg) => handleSignalRef.current?.(msg);
    entry.listeners.add(listener);
    if (entry.ready) {
      setTimeout(() => handleSignalRef.current?.({ type: '__subscribed' }), 0);
    }
    return () => { entry.listeners.delete(listener); };
  }, [topic]);

  // Callee keeps asking for the offer until it arrives (covers lost/early messages).
  // The window has to outlast the caller's own 45 s ring timeout: asking for only 30 s
  // let the callee fall silent while the caller was still offering, so both sides waited
  // out the dial and the call was recorded as missed.
  useEffect(() => {
    if (role !== 'callee' || callStatus !== 'connecting') return undefined;
    const maxTries = 22; // every 2 s ≈ 44 s, matching RING_TIMEOUT_MS in ChatWindow
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (pcRef.current) { clearInterval(id); return; }
      if (tries > maxTries) {
        clearInterval(id);
        log('offer_never_arrived', { waitedMs: maxTries * 2000 });
        return;
      }
      console.log('[webrtc] callee re-requesting offer (try ' + tries + ')');
      log('ready_sent', { why: 'retry', attempt: tries });
      send({ type: 'ready' });
    }, 2000);
    return () => clearInterval(id);
  }, [callStatus, log, role, send]);

  useEffect(() => { attachMedia(); }, [attachMedia, callStatus, callType, isCameraOff]);

  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;
  const sendRef = useRef(send);
  sendRef.current = send;

  // Hang up and release devices ONLY if the chat window unmounts mid-call.
  useEffect(() => {
    return () => {
      if (statusRef.current === 'connecting' || statusRef.current === 'connected') {
        if (callIdRef.current) sendRef.current?.({ type: 'hangup', callId: callIdRef.current });
      }
      cleanupRef.current?.();
    };
  }, []);

  // ----- Public API -----
  const startCall = useCallback(async (type = 'video', externalCallId) => {
    console.log('[webrtc] startCall called with type:', type);
    if (statusRef.current === 'connecting' || statusRef.current === 'connected') return null;
    // The peer already dialled us and we hold their offer: dialling back would make both
    // sides the caller, and each side then ignores the other's offer as glare.
    if (pendingOfferRef.current) {
      console.log('[webrtc] startCall declined: an incoming offer is already pending');
      return { declined: 'incoming_offer', callId: pendingOfferRef.current.callId || null };
    }
    cleanup();
    const callId = externalCallId || newCallId();
    callIdRef.current = callId;
    answeredCallIdRef.current = null;
    setRoleBoth('caller');
    setError(null);
    setIsMuted(false);
    setIsCameraOff(type === 'audio');
    setCallType(type);
    setCallStatus('connecting');
    log('caller_start', { requestedType: type }, callId);

    // Mint TURN credentials while the user is still answering the permission prompt.
    const iceServersPromise = getIceServers();

    let media;
    try {
      media = await getMedia(type);
      console.log('[webrtc] caller got media tracks:', media.stream.getTracks().map(t => t.kind));
    } catch (err) {
      console.error('[webrtc] caller getMedia error:', err);
      log('caller_media_failed', {
        requestedType: type,
        name: err?.name || null,
        message: err?.message || String(err),
      }, callId);
      setRoleBoth(null);
      callIdRef.current = null;
      setCallStatus('idle');
      throw err;
    }
    if (callIdRef.current !== callId || statusRef.current !== 'connecting') {
      log('caller_abandoned_after_media', {}, callId);
      media.stream.getTracks().forEach((t) => t.stop());
      return null;
    }

    localStreamRef.current = media.stream;
    setCallType(media.type);
    setIsCameraOff(media.type === 'audio');
    attachMedia();
    if (media.degraded) log('media_degraded', { requestedType: type, gotType: media.type }, callId);

    const pc = createPeerConnection(callId, await iceServersPromise);
    media.stream.getTracks().forEach((track) => pc.addTrack(track, media.stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log('[webrtc] caller offer created and setLocalDescription');
    await tuneSenderParameters(pc);

    offerPayloadRef.current = {
      type: 'offer',
      callId,
      callType: media.type,
      sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
    };
    log('offer_sent', { callType: media.type }, callId);
    send(offerPayloadRef.current);
    return { type: media.type, degraded: !!media.degraded };
  }, [attachMedia, cleanup, createPeerConnection, log, send, setCallStatus, setRoleBoth]);

  const joinCall = useCallback(async (type = 'video', expectedCallId) => {
    console.log('[webrtc] joinCall called with type:', type, 'role:', roleRef.current, 'expectedCallId:', expectedCallId);
    if (roleRef.current === 'callee' &&
      (statusRef.current === 'connecting' || statusRef.current === 'connected')) return;
    const pendingCallId = pendingOfferRef.current?.callId;
    // Keep the candidates already buffered for the call being entered, whether they were
    // tagged with the pending offer or with the ringing record this join was asked to enter.
    cleanup(expectedCallId || pendingCallId);
    // The caller dials with the database row id as its callId, so adopting the ringing
    // record's id here makes every later signal match and gives the trace something to
    // hang the callee's events on before the offer shows up.
    callIdRef.current = expectedCallId || pendingCallId || null;
    setRoleBoth('callee');
    setError(null);
    setIsMuted(false);
    setIsCameraOff(type === 'audio');
    setCallType(type === 'audio' ? 'audio' : 'video');
    setCallStatus('connecting');
    log('callee_join', { requestedType: type, hadPendingOffer: !!pendingCallId, sourceCallId: expectedCallId || null });
    getIceServers(); // warm the cache so answerOffer does not stall on the first fetch

    const pending = pendingOfferRef.current;
    if (pending && Date.now() - pending.receivedAt < 60000 && pending.callId !== answeredCallIdRef.current) {
      console.log('[webrtc] callee answering pending offer immediately on join');
      await answerOffer(pending);
    } else {
      console.log('[webrtc] callee sending ready signal');
      pendingOfferRef.current = null;
      log('ready_sent', { why: 'join' });
      send({ type: 'ready' });
    }
  }, [answerOffer, cleanup, log, send, setCallStatus, setRoleBoth]);

  const endCall = useCallback((notify = true) => {
    finishCall({ notify });
  }, [finishCall]);

  const resetCall = useCallback(() => {
    cleanup();
    callIdRef.current = null;
    setRoleBoth(null);
    setError(null);
    setFacingMode('user');
    facingModeRef.current = 'user';
    setCameraRotation(0);
    setCallStatus('idle');
  }, [cleanup, setCallStatus, setRoleBoth]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
      return next;
    });
  }, []);

  const toggleCamera = useCallback(async () => {
    console.log('[webrtc] toggleCamera called, current isCameraOff:', isCameraOff);
    const existingTracks = localStreamRef.current?.getVideoTracks() || [];
    if (existingTracks.length > 0) {
      const nextOff = !isCameraOff;
      existingTracks.forEach((t) => { t.enabled = !nextOff; });
      setIsCameraOff(nextOff);
      if (!nextOff) {
        setCallType('video');
      }
      if (callIdRef.current) {
        send({ type: 'camera_toggle', callId: callIdRef.current, hasVideo: !nextOff });
      }
      setTimeout(attachMedia, 50);
      return;
    }

    // Call started as audio or has no video track yet -> acquire camera on demand!
    try {
      console.log('[webrtc] acquiring camera track for toggleCamera...');
      let vStream = null;
      try {
        vStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } },
        });
      } catch (err1) {
        console.warn('[webrtc] front-facing camera failed, retrying generic video...', err1);
        vStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      const newTrack = vStream?.getVideoTracks()?.[0];
      if (!newTrack) return;

      if (!localStreamRef.current) {
        localStreamRef.current = new MediaStream();
      }
      localStreamRef.current.addTrack(newTrack);
      localStreamRef.current = new MediaStream(localStreamRef.current.getTracks());

      const pc = pcRef.current;
      if (pc) {
        await setOutgoingVideoTrack(pc, newTrack, localStreamRef.current, () => sendRenegotiationOffer(pc));
      }

      setIsCameraOff(false);
      setCallType('video');
      if (callIdRef.current) {
        send({ type: 'camera_toggle', callId: callIdRef.current, hasVideo: true });
      }
      setTimeout(attachMedia, 50);
    } catch (err) {
      console.error('[webrtc] failed to turn camera on', err);
    }
  }, [attachMedia, isCameraOff, send, sendRenegotiationOffer]);

  const rotateCamera = useCallback(() => {
    setCameraRotation((prev) => (prev + 90) % 360);
  }, []);

  const switchCamera = useCallback(async () => {
    const nextFacing = facingModeRef.current === 'user' ? 'environment' : 'user';
    console.log('[webrtc] switchCamera to:', nextFacing);
    try {
      let vStream = null;
      try {
        vStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: nextFacing },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
          },
        });
      } catch (e1) {
        vStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: nextFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      }
      const newTrack = vStream?.getVideoTracks()?.[0];
      if (!newTrack) {
        rotateCamera();
        return;
      }

      const oldTracks = localStreamRef.current?.getVideoTracks() || [];
      oldTracks.forEach((t) => t.stop());

      if (localStreamRef.current) {
        oldTracks.forEach((t) => localStreamRef.current.removeTrack(t));
        localStreamRef.current.addTrack(newTrack);
        localStreamRef.current = new MediaStream(localStreamRef.current.getTracks());
      }

      const pc = pcRef.current;
      if (pc) {
        await setOutgoingVideoTrack(pc, newTrack, localStreamRef.current, () => sendRenegotiationOffer(pc));
      }

      facingModeRef.current = nextFacing;
      setFacingMode(nextFacing);
      setIsCameraOff(false);
      setTimeout(attachMedia, 50);
    } catch (err) {
      console.warn('[webrtc] device could not switch facingMode, rotating preview instead:', err);
      rotateCamera();
    }
  }, [attachMedia, rotateCamera, sendRenegotiationOffer]);

  return {
    callStatus,
    callType,
    hasRemoteVideo,
    pcState,
    role,
    isMuted,
    isCameraOff,
    facingMode,
    cameraRotation,
    error,
    setError,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    localStreamRef,
    remoteStreamRef,
    startCall,
    joinCall,
    endCall,
    resetCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    rotateCamera,
    attachMedia,
  };
}

