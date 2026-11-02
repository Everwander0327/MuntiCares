import { supabase } from '@/lib/supabase';
import { logCallEvent } from './callEvents';

/*
 * Call records are rows in public.calls, not emoji-prefixed chat text.
 *
 * Every transition is written by whichever participant observes it, and each write
 * is filtered on the timestamp it fills in, so two clients racing the same event
 * settle on the first one instead of overwriting it with a later clock value.
 * No DELETE is exposed here on purpose: a consultation record stays auditable even
 * after the chat text around it expires.
 */

const CALLS_CHANGED = 'munticares:calls-changed';

export const newCallId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const notify = () => {
  window.dispatchEvent(new Event(CALLS_CHANGED));
};

export const onCallsChanged = (handler) => {
  window.addEventListener(CALLS_CHANGED, handler);
  return () => window.removeEventListener(CALLS_CHANGED, handler);
};

export async function createCallRecord({ id, callerId, calleeId, callType }) {
  const { error } = await supabase.from('calls').insert([{
    id,
    caller_id: callerId,
    callee_id: calleeId,
    call_type: callType,
    status: 'ringing',
  }]);
  if (error) throw error;
  notify();
  return id;
}

async function patchCall(id, patch, guardColumn, guardStatus) {
  if (!id) return;
  const allowed = guardStatus ? [].concat(guardStatus) : [];
  let query = supabase.from('calls').update(patch).eq('id', id);
  if (guardColumn) query = query.is(guardColumn, null);
  // A transition only applies to a row still in the states it makes sense for. Both
  // peers write what they observed, and the one that never saw the connection reach
  // 'connected' used to rewrite an answered consultation as missed.
  if (allowed.length === 1) query = query.eq('status', allowed[0]);
  else if (allowed.length > 1) query = query.in('status', allowed);
  const { error } = await query;
  if (error) console.error('[calls] update failed:', error.code, error.message);
  notify();
}

export const markCallAnswered = (id) => patchCall(
  id,
  // ended_at is cleared because the caller's 45 s ring timeout can close the row as
  // missed while the callee is still connecting, and calls_answered_not_after_ended
  // would reject an answered_at written behind that timestamp. Answering is the later,
  // truer fact, so the stale close is lifted and markCallEnded stamps it again.
  { status: 'answered', answered_at: new Date().toISOString(), ended_at: null },
  'answered_at',
  ['ringing', 'missed'],
);

export const markCallEnded = (id) => patchCall(
  id,
  { status: 'ended', ended_at: new Date().toISOString() },
  'ended_at',
  ['ringing', 'answered'],
);

// Dialled, never picked up. Only a still-unanswered row can become missed.
export const markCallMissed = (id) => patchCall(
  id,
  { status: 'missed', ended_at: new Date().toISOString() },
  'ended_at',
  'ringing',
);

export const markCallDeclined = (id) => patchCall(
  id,
  { status: 'declined', ended_at: new Date().toISOString() },
  'ended_at',
  'ringing',
);

export const markCallFailed = (id, reason) => patchCall(
  id,
  { status: 'failed', ended_at: new Date().toISOString(), end_reason: String(reason || '').slice(0, 200) },
  'ended_at',
  ['ringing', 'answered'],
);

// Server-side fan-out to the callee's registered devices. Best effort: the in-app
// ring still works when this fails, so a dead Edge Function must never block a dial.
// The outcome is written to the call trace because "delivered: 0" is the difference
// between a callee who ignored the call and one who was never woken at all.
export async function sendCallInvite(callId, userId) {
  if (!callId) return;
  const { data, error } = await supabase.functions.invoke('call-invite', {
    body: { callId },
    timeout: 8000,
  });
  if (error) {
    console.warn('[calls] push fan-out failed:', error.message);
    logCallEvent(callId, userId, 'push_fanout_failed', { message: error.message });
    return;
  }
  logCallEvent(callId, userId, 'push_fanout', {
    delivered: data?.delivered ?? null,
    attempted: data?.attempted ?? null,
    reason: data?.reason ?? data?.error ?? null,
  });
}

/*
 * The caller stops ringing at RING_TIMEOUT_MS (45 s in ChatWindow.jsx), so this is the
 * window in which a recovered invite can still connect. Anything older is history, not
 * a call — re-presenting it would ring a dead dial and re-ring every poll.
 */
export const RING_RECOVERY_WINDOW_MS = 45000;

// Supabase broadcast is not persistent: an invite sent while the callee's tab was closed,
// backgrounded or still subscribing is simply gone. The ringing row is the only thing that
// outlives that moment, so the callee reads it back instead of trusting the websocket.
export async function fetchRingingCallForCallee(userId) {
  if (!userId) return null;
  const since = new Date(Date.now() - RING_RECOVERY_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from('calls')
    .select('id, caller_id, call_type, ringing_at')
    .eq('callee_id', userId)
    .eq('status', 'ringing')
    .gte('ringing_at', since)
    .order('ringing_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[calls] ringing recovery failed:', error.message);
    return null;
  }
  if (!data) return null;
  // The overlay shows who is dialling, and the invite that carried that name is the
  // message this recovery exists to replace.
  const { data: caller } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', data.caller_id)
    .maybeSingle();
  return { ...data, callerName: caller?.full_name || '' };
}

export async function fetchCallRecord(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('calls')
    .select('id, caller_id, callee_id, call_type, status, ringing_at, answered_at, ended_at, duration_seconds')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.warn('[calls] fetch failed:', error.message);
    return null;
  }
  return data;
}

export async function fetchRecentCalls({ userId, limit = 100 }) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('calls')
    .select('id, caller_id, callee_id, call_type, status, ringing_at, answered_at, ended_at, duration_seconds, seen_at')
    .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
    .order('ringing_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[calls] fetch failed:', error.message);
    return [];
  }
  return data || [];
}

// Opening a conversation acknowledges its missed calls, so the flag in the list is a
// one-time alert rather than a badge that outlives its usefulness.
export async function markMissedCallsSeen({ userId, peerId }) {
  if (!userId || !peerId) return;
  const { error } = await supabase
    .from('calls')
    .update({ seen_at: new Date().toISOString() })
    .eq('callee_id', userId)
    .eq('caller_id', peerId)
    .eq('status', 'missed')
    .is('seen_at', null);
  if (error) console.warn('[calls] marking seen failed:', error.message);
  notify();
}

export async function fetchConversationCalls({ userId, peerId, limit = 60 }) {
  if (!userId || !peerId) return [];
  // Both participants drawn from the same two-id set, plus the table's
  // caller <> callee constraint, leaves exactly the two orientations of this pair.
  const { data, error } = await supabase
    .from('calls')
    .select('id, caller_id, callee_id, call_type, status, ringing_at, answered_at, ended_at, duration_seconds')
    .in('caller_id', [userId, peerId])
    .in('callee_id', [userId, peerId])
    .order('ringing_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[calls] fetch failed:', error.message);
    return [];
  }
  return data || [];
}
