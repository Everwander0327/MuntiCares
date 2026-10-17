import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

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

const buildRtcConfig = () => {
  const iceServers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
  // Optional TURN relay for strict NATs (e.g. some mobile carriers).
  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    iceServers.push({
      urls: turnUrl.split(',').map((u) => u.trim()).filter(Boolean),
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    });
  }
  return { iceServers, iceCandidatePoolSize: 2 };
};

/*
 * Long-lived, shared signaling channels (one per conversation).
 * supabase.channel(topic) returns the EXISTING instance for a topic and removeChannel()
 * is asynchronous, so tearing a channel down and re-creating it quickly (React StrictMode,
 * re-renders) hands back a half-closed channel that silently drops messages. Keeping one
 * persistent channel per conversation avoids that. Stored on globalThis to survive HMR.
 */
const registry = (globalThis.__mcSignalingChannels ||= new Map());

function getSignalingChannel(topic) {
  const existing = registry.get(topic);
  if (existing) {
    console.log('[webrtc] getSignalingChannel existing for', topic, 'ready:', existing.ready);
    return existing;
  }

  console.log('[webrtc] creating new channel for', topic);
  const channel = supabase.channel(topic);
  const entry = { channel, listeners: new Set(), ready: false, queue: [] };

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
    }
  });

  registry.set(topic, entry);
  return entry;
}

const waitForIceGathering = (pc, timeoutMs) =>
  new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const check = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    pc.addEventListener('icegatheringstatechange', check);
  });

const newCallId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

async function getMedia(type) {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error('Camera/microphone requires a secure (HTTPS) connection.');
    err.code = 'INSECURE_CONTEXT';
    throw err;
  }
  if (type === 'audio') {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return { stream, type: 'audio' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    return { stream, type: 'video' };
  } catch (err1) {
    console.warn('[webrtc] user-facing camera failed, retrying generic video...', err1);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      return { stream, type: 'video' };
    } catch (err2) {
      console.warn('[webrtc] camera unavailable, degrading to voice...', err2);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
  const [error, setError] = useState(null);
  const [role, setRole] = useState(null); // caller | callee | null

  const topic = selfId && peerId ? `rtc_${[selfId, peerId].sort().join('_')}` : null;

  const statusRef = useRef('idle');
  const roleRef = useRef(null);
  const callIdRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const offerPayloadRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const answeredCallIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

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
      if (el.srcObject !== stream) el.srcObject = stream || null;
      if (stream) {
        const p = el.play?.();
        if (p && typeof p.catch === 'function') {
          p.catch((err) => {
            console.warn('[webrtc] play prevented/blocked:', err?.name);
          });
        }
      }
    };
    attach(localVideoRef.current, localStreamRef.current, true);
    attach(remoteVideoRef.current, remoteStreamRef.current, false);
    attach(remoteAudioRef.current, remoteStreamRef.current, false);
  }, []);

  const cleanup = useCallback(() => {
    console.log('[webrtc] cleanup called');
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
    pendingCandidatesRef.current = [];
    offerPayloadRef.current = null;
    setPcState('new');
  }, []);

  const flushCandidates = useCallback(async (callId) => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queued = pendingCandidatesRef.current;
    pendingCandidatesRef.current = queued.filter((c) => c.callId !== callId);
    console.log('[webrtc] flushing', queued.length, 'queued candidates for callId:', callId);
    for (const c of queued) {
      if (c.callId !== callId) continue;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c.candidate));
      } catch (err) {
        console.warn('[webrtc] addIceCandidate failed in flush', err);
      }
    }
  }, []);

  const finishCall = useCallback(({ notify, reason } = {}) => {
    console.log('[webrtc] finishCall called, notify:', notify, 'reason:', reason);
    if (notify && callIdRef.current) {
      send({ type: 'hangup', callId: callIdRef.current });
    }
    cleanup();
    if (reason) setError(reason);
    setIsMuted(false);
    setIsCameraOff(false);
    if (statusRef.current !== 'idle') setCallStatus('ended');
  }, [cleanup, send, setCallStatus]);

  const createPeerConnection = useCallback((callId) => {
    console.log('[webrtc] createPeerConnection for callId:', callId);
    const pc = new RTCPeerConnection(buildRtcConfig());
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log('[webrtc] onicecandidate:', e.candidate.candidate?.slice(0, 45));
        send({
          type: 'candidate',
          callId,
          candidate: {
            candidate: e.candidate.candidate,
            sdpMid: e.candidate.sdpMid,
            sdpMLineIndex: e.candidate.sdpMLineIndex,
            usernameFragment: e.candidate.usernameFragment,
          },
        });
      }
    };

    pc.ontrack = (e) => {
      console.log('[webrtc] ontrack event received, track kind:', e.track.kind);
      let stream = remoteStreamRef.current;
      if (!stream) {
        stream = new MediaStream();
        remoteStreamRef.current = stream;
      }
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
      const liveStream = new MediaStream(stream.getTracks());
      remoteStreamRef.current = liveStream;
      if (e.track.kind === 'video') {
        setHasRemoteVideo(true);
        e.track.onmute = () => setHasRemoteVideo(false);
        e.track.onunmute = () => setHasRemoteVideo(true);
        e.track.onended = () => setHasRemoteVideo(false);
      }
      attachMedia();
    };

    const onState = () => {
      if (pcRef.current !== pc) return;
      const state = pc.connectionState || pc.iceConnectionState;
      console.log('[webrtc] pc connection state change:', state, 'connState:', pc.connectionState, 'iceState:', pc.iceConnectionState);
      setPcState(state);
      if (state === 'connected' || state === 'completed') {
        setError(null);
        setCallStatus('connected');
        if (remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream(remoteStreamRef.current.getTracks());
        }
        attachMedia();
      } else if (state === 'disconnected' || state === 'closed') {
        console.log('[webrtc] peer connection state became disconnected/closed, finishing call');
        finishCall({ notify: false });
      } else if (state === 'failed') {
        finishCall({ notify: true, reason: 'Connection failed. The network may be blocking peer-to-peer calls.' });
      }
    };
    pc.onconnectionstatechange = onState;
    pc.oniceconnectionstatechange = () => {
      if (!('connectionState' in pc)) onState();
    };

    return pc;
  }, [attachMedia, finishCall, send, setCallStatus]);

  const answerOffer = useCallback(async (msg) => {
    console.log('[webrtc] answerOffer starting for callId:', msg.callId);
    answeredCallIdRef.current = msg.callId;
    callIdRef.current = msg.callId;
    pendingOfferRef.current = null;

    const requestedType = msg.callType === 'audio' ? 'audio' : 'video';
    setCallType(requestedType);

    try {
      const pc = createPeerConnection(msg.callId);
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      console.log('[webrtc] callee applied remote offer');

      let media = null;
      try {
        media = await getMedia(requestedType);
        console.log('[webrtc] callee got media tracks:', media.stream.getTracks().map(t => t.kind));
      } catch (err) {
        console.warn('[webrtc] callee has no usable mic/camera, joining receive-only', err);
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
        attachMedia();
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('[webrtc] callee created answer and setLocalDescription');
      await flushCandidates(msg.callId);

      send({
        type: 'answer',
        callId: msg.callId,
        sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
      });
      console.log('[webrtc] callee sent answer');
    } catch (err) {
      console.error('[webrtc] failed to answer offer', err);
      finishCall({ notify: true, reason: 'Could not connect the call. Please try again.' });
    }
  }, [attachMedia, createPeerConnection, finishCall, flushCandidates, send]);

  // ----- Incoming signaling -----
  const handleSignal = useCallback(async (msg) => {
    if (!msg || !msg.type) return;

    if (msg.type === '__subscribed') {
      console.log('[webrtc] channel __subscribed, role:', roleRef.current);
      // (Re)subscribed: re-announce state so a missed message is recovered.
      if (roleRef.current === 'callee' && !pcRef.current) {
        send({ type: 'ready' });
      } else if (roleRef.current === 'caller' && offerPayloadRef.current &&
        pcRef.current?.signalingState === 'have-local-offer') {
        send(offerPayloadRef.current);
      }
      return;
    }

    if (msg.from === selfId) return;

    switch (msg.type) {
      case 'ready': {
        console.log('[webrtc] RX ready, role:', roleRef.current, 'hasOffer:', !!offerPayloadRef.current, 'sigState:', pcRef.current?.signalingState);
        if (roleRef.current === 'caller' && offerPayloadRef.current &&
          pcRef.current?.signalingState === 'have-local-offer') {
          console.log('[webrtc] caller sending offer in response to ready');
          send(offerPayloadRef.current);
        }
        break;
      }
      case 'offer': {
        console.log('[webrtc] RX offer, role:', roleRef.current, 'hasPc:', !!pcRef.current);
        if (roleRef.current === 'caller') return; // we are calling; ignore peer offers (glare)
        if (answeredCallIdRef.current === msg.callId) return; // duplicate re-send
        if (roleRef.current === 'callee' && !pcRef.current) {
          await answerOffer(msg);
        } else {
          // Not accepted yet: keep it until the user accepts the ring.
          pendingOfferRef.current = { ...msg, receivedAt: Date.now() };
        }
        break;
      }
      case 'answer': {
        const pc = pcRef.current;
        console.log('[webrtc] RX answer, role:', roleRef.current, 'sigState:', pc?.signalingState, 'callId match:', msg.callId === callIdRef.current);
        if (roleRef.current !== 'caller' || !pc || msg.callId !== callIdRef.current) return;
        if (pc.signalingState !== 'have-local-offer') return; // already applied
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          console.log('[webrtc] caller applied answer successfully');
          await flushCandidates(msg.callId);
        } catch (err) {
          console.error('[webrtc] failed to apply answer', err);
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
          if (pendingCandidatesRef.current.length > 200) pendingCandidatesRef.current.shift();
        }
        break;
      }
      case 'hangup': {
        console.log('[webrtc] RX hangup, active:', statusRef.current, 'msgCallId:', msg.callId, 'ourCallId:', callIdRef.current);
        if (pendingOfferRef.current?.callId === msg.callId) pendingOfferRef.current = null;
        const active = statusRef.current === 'connecting' || statusRef.current === 'connected';
        if (!active) return;
        finishCall({ notify: false });
        break;
      }
      default:
        break;
    }
  }, [answerOffer, finishCall, flushCandidates, selfId, send]);

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
  useEffect(() => {
    if (role !== 'callee' || callStatus !== 'connecting') return undefined;
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (pcRef.current || tries > 15) { clearInterval(id); return; }
      console.log('[webrtc] callee re-requesting offer (try ' + tries + ')');
      send({ type: 'ready' });
    }, 2000);
    return () => clearInterval(id);
  }, [role, callStatus, send]);

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
  const startCall = useCallback(async (type = 'video') => {
    console.log('[webrtc] startCall called with type:', type);
    if (statusRef.current === 'connecting' || statusRef.current === 'connected') return null;
    cleanup();
    const callId = newCallId();
    callIdRef.current = callId;
    answeredCallIdRef.current = null;
    setRoleBoth('caller');
    setError(null);
    setIsMuted(false);
    setIsCameraOff(type === 'audio');
    setCallType(type);
    setCallStatus('connecting');

    let media;
    try {
      media = await getMedia(type);
      console.log('[webrtc] caller got media tracks:', media.stream.getTracks().map(t => t.kind));
    } catch (err) {
      console.error('[webrtc] caller getMedia error:', err);
      setRoleBoth(null);
      callIdRef.current = null;
      setCallStatus('idle');
      throw err;
    }
    if (callIdRef.current !== callId || statusRef.current !== 'connecting') {
      media.stream.getTracks().forEach((t) => t.stop());
      return null;
    }

    localStreamRef.current = media.stream;
    setCallType(media.type);
    setIsCameraOff(media.type === 'audio');
    attachMedia();

    const pc = createPeerConnection(callId);
    media.stream.getTracks().forEach((track) => pc.addTrack(track, media.stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log('[webrtc] caller offer created and setLocalDescription');

    offerPayloadRef.current = {
      type: 'offer',
      callId,
      callType: media.type,
      sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
    };
    send(offerPayloadRef.current);
    return { type: media.type, degraded: !!media.degraded };
  }, [attachMedia, cleanup, createPeerConnection, send, setCallStatus, setRoleBoth]);

  const joinCall = useCallback(async (type = 'video') => {
    console.log('[webrtc] joinCall called with type:', type, 'role:', roleRef.current);
    if (roleRef.current === 'callee' &&
      (statusRef.current === 'connecting' || statusRef.current === 'connected')) return;
    cleanup();
    callIdRef.current = null;
    setRoleBoth('callee');
    setError(null);
    setIsMuted(false);
    setIsCameraOff(type === 'audio');
    setCallType(type === 'audio' ? 'audio' : 'video');
    setCallStatus('connecting');

    const pending = pendingOfferRef.current;
    if (pending && Date.now() - pending.receivedAt < 60000 && pending.callId !== answeredCallIdRef.current) {
      console.log('[webrtc] callee answering pending offer immediately on join');
      await answerOffer(pending);
    } else {
      console.log('[webrtc] callee sending ready signal');
      pendingOfferRef.current = null;
      send({ type: 'ready' });
    }
  }, [answerOffer, cleanup, send, setCallStatus, setRoleBoth]);

  const endCall = useCallback((notify = true) => {
    finishCall({ notify });
  }, [finishCall]);

  const resetCall = useCallback(() => {
    cleanup();
    callIdRef.current = null;
    setRoleBoth(null);
    setError(null);
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
      setTimeout(attachMedia, 50);
      return;
    }

    // Call started as audio or has no video track yet -> acquire camera on demand!
    try {
      console.log('[webrtc] acquiring camera track for toggleCamera...');
      let vStream = null;
      try {
        vStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
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

      const pc = pcRef.current;
      if (pc) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video' || s.dtlsTransport);
        if (videoSender && typeof videoSender.replaceTrack === 'function') {
          console.log('[webrtc] replaceTrack on existing video sender');
          await videoSender.replaceTrack(newTrack);
        } else {
          console.log('[webrtc] addTrack new video track to pc');
          pc.addTrack(newTrack, localStreamRef.current);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send({
            type: 'offer',
            callId: callIdRef.current,
            callType: 'video',
            sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
          });
        }
      }

      setIsCameraOff(false);
      setCallType('video');
      setTimeout(attachMedia, 50);
    } catch (err) {
      console.error('[webrtc] failed to turn camera on', err);
    }
  }, [attachMedia, isCameraOff, send]);

  return {
    callStatus,
    callType,
    hasRemoteVideo,
    pcState,
    role,
    isMuted,
    isCameraOff,
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
    attachMedia,
  };
}

