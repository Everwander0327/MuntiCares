import { createClient } from 'npm:@supabase/supabase-js@2.106.0';
import webpush from 'npm:web-push@3.6.7';
import { validSubscription, classifyDelivery, notificationPayload } from './policy.js';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Content-Type': 'application/json' };
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  try {
    const body = await req.json();
    if (body.action === 'deliver') {
      if (!Deno.env.get('WEB_PUSH_DISPATCH_SECRET') || req.headers.get('authorization') !== `Bearer ${Deno.env.get('WEB_PUSH_DISPATCH_SECRET')}`) return reply({ error: 'unauthorized' }, 401);
      webpush.setVapidDetails('https://munti-cares.vercel.app', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
      const { data: jobs, error } = await db.rpc('claim_web_push_jobs');
      if (error) throw error;
      let delivered = 0;
      for (const job of jobs || []) {
        let retry = false;
        if (job.payload.kind === 'call') {
          const { data: call } = await db.from('calls').select('status').eq('id', job.payload.callId).maybeSingle();
          if (call?.status !== 'ringing') { await db.from('web_push_jobs').delete().eq('id', job.id); continue; }
        }
        const { data: subscriptions, error: readError } = await db.from('web_push_subscriptions').select('*').eq('user_id', job.user_id);
        if (readError) throw readError;
        for (const row of subscriptions || []) {
          if (!validSubscription(row.subscription)) continue;
          try {
            const details = webpush.generateRequestDetails(row.subscription, JSON.stringify(notificationPayload(job)), { TTL: Math.max(0, Math.min(3600, Math.floor((Date.parse(job.expires_at) - Date.now()) / 1000))) });
            const response = await fetch(details.endpoint, { method: details.method, headers: details.headers, body: details.body, signal: AbortSignal.timeout(8000), redirect: 'error' });
            const result = classifyDelivery(response.status);
            if (result === 'expired') await db.from('web_push_subscriptions').delete().eq('endpoint', row.endpoint);
            else if (result === 'retry') retry = true;
            else delivered++;
          } catch { retry = true; }
        }
        if (!retry || job.attempts >= 5) await db.from('web_push_jobs').delete().eq('id', job.id);
      }
      return reply({ delivered, attempted: jobs?.length || 0 });
    }
    const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
    const { data: { user }, error } = await db.auth.getUser(token || '');
    if (error || !user) return reply({ error: 'unauthorized' }, 401);
    const { data: profile } = await db.from('users').select('is_banned').eq('id', user.id).maybeSingle();
    if (!profile || profile.is_banned) return reply({ error: 'forbidden' }, 403);
    if (body.action === 'config') return reply({ publicKey: Deno.env.get('VAPID_PUBLIC_KEY') });
    if (body.action === 'subscribe') {
      if (!validSubscription(body.subscription)) return reply({ error: 'invalid_subscription' }, 400);
      const { error } = await db.from('web_push_subscriptions').upsert({ endpoint: body.subscription.endpoint, user_id: user.id, subscription: body.subscription, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' });
      if (error) throw error;
      return reply({ ok: true });
    }
    if (body.action === 'unsubscribe') {
      const { error } = await db.from('web_push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', body.endpoint);
      if (error) throw error;
      return reply({ ok: true });
    }
    return reply({ error: 'invalid_action' }, 400);
  } catch { return reply({ error: 'notification_service_unavailable' }, 503); }
});
