import { supabase } from '@/lib/supabase';

/*
 * Append-only diagnostics for one teleconsultation call, written to public.call_events.
 *
 * A 'missed' row on its own cannot say whether the invite ever reached the callee or
 * whether the SDP offer arrived after the callee accepted, so the signaling trace has to
 * survive the tab that produced it. Writes are fire-and-forget: a failed insert must never
 * break a call, and the events are not consultation metadata (they age out after 14 days).
 */

export function logCallEvent(callId, userId, event, detail = {}) {
  if (!callId || !userId) return;
  supabase
    .from('call_events')
    .insert([{ call_id: callId, user_id: userId, event, detail }])
    .then(({ error }) => {
      if (error) console.warn('[calls] event log failed:', event, error.message);
    });
}
