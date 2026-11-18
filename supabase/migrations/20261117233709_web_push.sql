CREATE SCHEMA IF NOT EXISTS push_private;
REVOKE ALL ON SCHEMA push_private FROM PUBLIC, anon, authenticated;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE TABLE public.web_push_subscriptions (
 endpoint text PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 subscription jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_push_subscriptions FROM anon, authenticated;
GRANT ALL ON public.web_push_subscriptions TO service_role;
CREATE TABLE public.web_push_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 payload jsonb NOT NULL, expires_at timestamptz NOT NULL, attempts int NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.web_push_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_push_jobs FROM anon, authenticated;
GRANT ALL ON public.web_push_jobs TO service_role;
CREATE INDEX web_push_jobs_due ON public.web_push_jobs(next_attempt_at);
CREATE FUNCTION public.claim_web_push_jobs() RETURNS SETOF public.web_push_jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 DELETE FROM public.web_push_jobs WHERE expires_at <= now() OR attempts >= 5;
 RETURN QUERY UPDATE public.web_push_jobs SET attempts=attempts+1, next_attempt_at=now()+interval '1 minute'
 WHERE id IN (SELECT id FROM public.web_push_jobs WHERE next_attempt_at<=now() ORDER BY next_attempt_at LIMIT 20 FOR UPDATE SKIP LOCKED) RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.claim_web_push_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_web_push_jobs() TO service_role;
CREATE FUNCTION push_private.dispatch() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE secret text;
BEGIN
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='web_push_dispatch_secret' LIMIT 1;
 IF secret IS NOT NULL AND EXISTS(SELECT 1 FROM public.web_push_jobs WHERE next_attempt_at<=now() AND expires_at>now()) THEN
 PERFORM net.http_post(url:='https://zsqowrouxuxjjmosbvxt.supabase.co/functions/v1/web-push',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:='{"action":"deliver"}'::jsonb);
 END IF;
END $$;
CREATE FUNCTION push_private.enqueue_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE recipient uuid; kind text; path text; role text; lifetime interval := interval '1 hour';
BEGIN
 IF TG_TABLE_NAME='messages' THEN
   IF NEW.message_type='call' OR NEW.is_read THEN RETURN NEW; END IF;
   recipient:=NEW.receiver_id; kind:='message';
 ELSIF TG_TABLE_NAME='calls' THEN
   IF NEW.status<>'ringing' THEN RETURN NEW; END IF;
   recipient:=NEW.callee_id; kind:='call'; lifetime:=interval '40 seconds';
 ELSE
   IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.date IS NOT DISTINCT FROM OLD.date AND NEW.time IS NOT DISTINCT FROM OLD.time THEN RETURN NEW; END IF;
   kind:=CASE WHEN NEW.status IN ('On The Way','Arrived','Completed') THEN 'status' ELSE 'booking' END;
   FOREACH recipient IN ARRAY ARRAY[NEW.patient_id,NEW.provider_id] LOOP
     IF recipient IS NULL OR recipient=auth.uid() THEN CONTINUE; END IF;
     SELECT u.role INTO role FROM public.users u WHERE u.id=recipient AND NOT u.is_banned;
     IF role IN ('patient','provider') THEN
       INSERT INTO public.web_push_jobs(user_id,payload,expires_at) SELECT recipient,jsonb_build_object('kind',kind,'path','/'||role||'/requests'),now()+lifetime WHERE EXISTS(SELECT 1 FROM public.web_push_subscriptions WHERE user_id=recipient);
     END IF;
   END LOOP;
   PERFORM push_private.dispatch(); RETURN NEW;
 END IF;
 SELECT u.role INTO role FROM public.users u WHERE u.id=recipient AND NOT u.is_banned;
 IF role IN ('patient','provider','admin') THEN
   path:='/'||role||'/messages';
   INSERT INTO public.web_push_jobs(user_id,payload,expires_at) SELECT recipient,jsonb_build_object('kind',kind,'path',path,'callId',CASE WHEN TG_TABLE_NAME='calls' THEN to_jsonb(NEW)->>'id' ELSE NULL END),now()+lifetime WHERE EXISTS(SELECT 1 FROM public.web_push_subscriptions WHERE user_id=recipient);
 END IF;
 PERFORM push_private.dispatch(); RETURN NEW;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA push_private FROM PUBLIC,anon,authenticated;
CREATE TRIGGER web_push_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION push_private.enqueue_event();
CREATE TRIGGER web_push_call AFTER INSERT ON public.calls FOR EACH ROW EXECUTE FUNCTION push_private.enqueue_event();
CREATE TRIGGER web_push_request AFTER INSERT OR UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION push_private.enqueue_event();
SELECT cron.schedule('web-push-retry','* * * * *','SELECT push_private.dispatch()');
