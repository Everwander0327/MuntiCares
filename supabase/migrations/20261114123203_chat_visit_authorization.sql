-- Restrict chat, call signaling, call records, and chat attachments to users who
-- share a visit that the UI exposes as a conversation.
-- The qualifying statuses intentionally match ConversationList.jsx and ChatWindow.jsx.

CREATE OR REPLACE FUNCTION public.can_chat_with(p_other_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_other_user IS NOT NULL
    AND p_other_user <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.requests r
      WHERE (
        (r.patient_id = auth.uid() AND r.provider_id = p_other_user)
        OR (r.provider_id = auth.uid() AND r.patient_id = p_other_user)
      )
        AND r.status IN ('Accepted', 'On The Way', 'Arrived', 'Completed')
    );
$$;

REVOKE ALL ON FUNCTION public.can_chat_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_chat_with(uuid) TO authenticated;

-- Conversation identity must stay fixed after insert. Also keep call message links
-- inside the same pair so a message cannot expose an unrelated call record.
CREATE OR REPLACE FUNCTION public.guard_chat_message_participants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id THEN
      RAISE EXCEPTION 'A chat message cannot be reassigned'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.call_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.calls c
    WHERE c.id = NEW.call_id
      AND ((c.caller_id = NEW.sender_id AND c.callee_id = NEW.receiver_id)
        OR (c.caller_id = NEW.receiver_id AND c.callee_id = NEW.sender_id))
  ) THEN
    RAISE EXCEPTION 'The call does not belong to this conversation'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_participant_guard ON public.messages;
CREATE TRIGGER messages_participant_guard
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_chat_message_participants();

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_select_parties" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT TO authenticated
  USING (
    (sender_id = auth.uid() AND public.can_chat_with(receiver_id))
    OR (receiver_id = auth.uid() AND public.can_chat_with(sender_id))
  );

DROP POLICY IF EXISTS "messages_insert_sender" ON public.messages;
CREATE POLICY "messages_insert_sender" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_chat_with(receiver_id));

DROP POLICY IF EXISTS "messages_update_participants" ON public.messages;
DROP POLICY IF EXISTS "messages_update_receiver" ON public.messages;
CREATE POLICY "messages_update_participants" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    (sender_id = auth.uid() AND public.can_chat_with(receiver_id))
    OR (receiver_id = auth.uid() AND public.can_chat_with(sender_id))
  )
  WITH CHECK (
    (sender_id = auth.uid() AND public.can_chat_with(receiver_id))
    OR (receiver_id = auth.uid() AND public.can_chat_with(sender_id))
  );

DROP POLICY IF EXISTS "messages_delete_sender" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_parties" ON public.messages;
CREATE POLICY "messages_delete_sender" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() AND public.can_chat_with(receiver_id));

DROP POLICY IF EXISTS "calls_select_participant" ON public.calls;
CREATE POLICY "calls_select_participant" ON public.calls
  FOR SELECT TO authenticated
  USING (
    (caller_id = auth.uid() AND public.can_chat_with(callee_id))
    OR (callee_id = auth.uid() AND public.can_chat_with(caller_id))
  );

DROP POLICY IF EXISTS "calls_insert_as_caller" ON public.calls;
CREATE POLICY "calls_insert_as_caller" ON public.calls
  FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid() AND public.can_chat_with(callee_id));

DROP POLICY IF EXISTS "calls_update_participant" ON public.calls;
CREATE POLICY "calls_update_participant" ON public.calls
  FOR UPDATE TO authenticated
  USING (
    (caller_id = auth.uid() AND public.can_chat_with(callee_id))
    OR (callee_id = auth.uid() AND public.can_chat_with(caller_id))
  )
  WITH CHECK (
    (caller_id = auth.uid() AND public.can_chat_with(callee_id))
    OR (callee_id = auth.uid() AND public.can_chat_with(caller_id))
  );

CREATE OR REPLACE FUNCTION public.guard_call_participants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.caller_id IS DISTINCT FROM OLD.caller_id
     OR NEW.callee_id IS DISTINCT FROM OLD.callee_id THEN
    RAISE EXCEPTION 'Call participants cannot be reassigned'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calls_participant_guard ON public.calls;
CREATE TRIGGER calls_participant_guard
  BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.guard_call_participants();

DROP POLICY IF EXISTS "call_events_insert_participant" ON public.call_events;
CREATE POLICY "call_events_insert_participant" ON public.call_events
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.id = call_events.call_id
        AND ((c.caller_id = auth.uid() AND public.can_chat_with(c.callee_id))
          OR (c.callee_id = auth.uid() AND public.can_chat_with(c.caller_id)))
    )
  );

DROP POLICY IF EXISTS "call_events_select_participant" ON public.call_events;
CREATE POLICY "call_events_select_participant" ON public.call_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calls c
    WHERE c.id = call_events.call_id
      AND ((c.caller_id = auth.uid() AND public.can_chat_with(c.callee_id))
        OR (c.callee_id = auth.uid() AND public.can_chat_with(c.caller_id)))
  ));

-- Signed URLs and object reads are available only while an authorized message in
-- the visit refers to an object owned by that message's sender. Legacy sender/file
-- paths continue to work; new uploads include the receiver in the path to authorize
-- the upload before the message row is inserted.
CREATE OR REPLACE FUNCTION public.chat_attachment_is_participant(p_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE trim(split_part(m.content, E'\n', 1)) = trim(p_path)
      AND split_part(trim(p_path), '/', 1) = m.sender_id::text
      AND ((m.sender_id = auth.uid() AND public.can_chat_with(m.receiver_id))
        OR (m.receiver_id = auth.uid() AND public.can_chat_with(m.sender_id)))
  );
$$;

REVOKE ALL ON FUNCTION public.chat_attachment_is_participant(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_attachment_is_participant(text) TO authenticated;

DROP POLICY IF EXISTS "chat_attachments_insert" ON storage.objects;
CREATE POLICY "chat_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat_attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
    AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.can_chat_with(split_part(name, '/', 2)::uuid)
  );

DROP POLICY IF EXISTS "chat_attachments_select" ON storage.objects;
CREATE POLICY "chat_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat_attachments' AND public.chat_attachment_is_participant(name));

DROP POLICY IF EXISTS "chat_attachments_delete" ON storage.objects;
CREATE POLICY "chat_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat_attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
    AND (
      public.chat_attachment_is_participant(name)
      OR (
        split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.can_chat_with(split_part(name, '/', 2)::uuid)
      )
    )
  );

-- Private broadcast/presence channels use the same visit rule as persisted data.
-- Calls_<user> is a recipient inbox; chat_/rtc_ topics encode the sorted pair.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS munticares_chat_realtime_select ON realtime.messages;
    CREATE POLICY munticares_chat_realtime_select ON realtime.messages
      FOR SELECT TO authenticated
      USING (
        (
          (SELECT realtime.topic()) ~* '^calls_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND (
            substring((SELECT realtime.topic()) FROM 7)::uuid = auth.uid()
            OR public.can_chat_with(substring((SELECT realtime.topic()) FROM 7)::uuid)
          )
        )
        OR (
          (SELECT realtime.topic()) ~* '^(chat|rtc)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND auth.uid() IN (
            split_part((SELECT realtime.topic()), '_', 2)::uuid,
            split_part((SELECT realtime.topic()), '_', 3)::uuid
          )
          AND public.can_chat_with(CASE
            WHEN auth.uid() = split_part((SELECT realtime.topic()), '_', 2)::uuid
              THEN split_part((SELECT realtime.topic()), '_', 3)::uuid
            ELSE split_part((SELECT realtime.topic()), '_', 2)::uuid
          END)
        )
      );

    DROP POLICY IF EXISTS munticares_chat_realtime_insert ON realtime.messages;
    CREATE POLICY munticares_chat_realtime_insert ON realtime.messages
      FOR INSERT TO authenticated
      WITH CHECK (
        (
          (SELECT realtime.topic()) ~* '^calls_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND public.can_chat_with(substring((SELECT realtime.topic()) FROM 7)::uuid)
        )
        OR (
          (SELECT realtime.topic()) ~* '^(chat|rtc)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND auth.uid() IN (
            split_part((SELECT realtime.topic()), '_', 2)::uuid,
            split_part((SELECT realtime.topic()), '_', 3)::uuid
          )
          AND public.can_chat_with(CASE
            WHEN auth.uid() = split_part((SELECT realtime.topic()), '_', 2)::uuid
              THEN split_part((SELECT realtime.topic()), '_', 3)::uuid
            ELSE split_part((SELECT realtime.topic()), '_', 2)::uuid
          END)
        )
      );

    -- Restrictive companions keep any older permissive realtime policies from
    -- widening access to these topic namespaces. Other topic families retain
    -- their existing policy decisions.
    DROP POLICY IF EXISTS munticares_chat_realtime_select_guard ON realtime.messages;
    CREATE POLICY munticares_chat_realtime_select_guard ON realtime.messages
      AS RESTRICTIVE FOR SELECT TO authenticated
      USING (
        (SELECT realtime.topic()) !~* '^(calls_[0-9a-f-]{36}|(chat|rtc)_[0-9a-f-]{36}_[0-9a-f-]{36})$'
        OR EXISTS (
          SELECT 1
          WHERE (
            (SELECT realtime.topic()) ~* '^calls_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND (
              substring((SELECT realtime.topic()) FROM 7)::uuid = auth.uid()
              OR public.can_chat_with(substring((SELECT realtime.topic()) FROM 7)::uuid)
            )
          )
          OR (
            (SELECT realtime.topic()) ~* '^(chat|rtc)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND auth.uid() IN (
              split_part((SELECT realtime.topic()), '_', 2)::uuid,
              split_part((SELECT realtime.topic()), '_', 3)::uuid
            )
            AND public.can_chat_with(CASE
              WHEN auth.uid() = split_part((SELECT realtime.topic()), '_', 2)::uuid
                THEN split_part((SELECT realtime.topic()), '_', 3)::uuid
              ELSE split_part((SELECT realtime.topic()), '_', 2)::uuid
            END)
          )
        )
      );

    DROP POLICY IF EXISTS munticares_chat_realtime_insert_guard ON realtime.messages;
    CREATE POLICY munticares_chat_realtime_insert_guard ON realtime.messages
      AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK (
        (SELECT realtime.topic()) !~* '^(calls_[0-9a-f-]{36}|(chat|rtc)_[0-9a-f-]{36}_[0-9a-f-]{36})$'
        OR (
          (
            (SELECT realtime.topic()) ~* '^calls_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND public.can_chat_with(substring((SELECT realtime.topic()) FROM 7)::uuid)
          )
          OR (
            (SELECT realtime.topic()) ~* '^(chat|rtc)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND auth.uid() IN (
              split_part((SELECT realtime.topic()), '_', 2)::uuid,
              split_part((SELECT realtime.topic()), '_', 3)::uuid
            )
            AND public.can_chat_with(CASE
              WHEN auth.uid() = split_part((SELECT realtime.topic()), '_', 2)::uuid
                THEN split_part((SELECT realtime.topic()), '_', 3)::uuid
              ELSE split_part((SELECT realtime.topic()), '_', 2)::uuid
            END)
          )
        )
      );
  END IF;
END $$;
