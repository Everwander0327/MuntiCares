import { supabase } from '@/lib/supabase';

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

async function patchCall(id, patch, guardColumn) {
  if (!id) return;
  let query = supabase.from('calls').update(patch).eq('id', id);
  if (guardColumn) query = query.is(guardColumn, null);
  const { error } = await query;
  if (error) console.warn('[calls] update failed:', error.message);
  notify();
}

export const markCallAnswered = (id) => patchCall(
  id,
  { status: 'answered', answered_at: new Date().toISOString() },
  'answered_at',
);

export const markCallEnded = (id) => patchCall(
  id,
  { status: 'ended', ended_at: new Date().toISOString() },
  'ended_at',
);

// Dialled, never picked up.
export const markCallMissed = (id) => patchCall(
  id,
  { status: 'missed', ended_at: new Date().toISOString() },
  'ended_at',
);

export const markCallDeclined = (id) => patchCall(
  id,
  { status: 'declined', ended_at: new Date().toISOString() },
  'ended_at',
);

export const markCallFailed = (id, reason) => patchCall(
  id,
  { status: 'failed', ended_at: new Date().toISOString(), end_reason: String(reason || '').slice(0, 200) },
  'ended_at',
);

// Server-side fan-out to the callee's registered devices. Best effort: the in-app
// ring still works when this fails, so a dead Edge Function must never block a dial.
export async function sendCallInvite(callId) {
  if (!callId) return;
  const { error } = await supabase.functions.invoke('call-invite', {
    body: { callId },
    timeout: 8000,
  });
  if (error) console.warn('[calls] push fan-out failed:', error.message);
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
