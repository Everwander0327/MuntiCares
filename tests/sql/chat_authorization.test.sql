-- Local Supabase verification only. Run after applying migrations locally.
-- All data changes are rolled back; do not run this against production.
BEGIN;

DO $$
DECLARE
  v_patient uuid;
  v_provider uuid;
  v_unrelated uuid;
  v_message uuid;
  v_rows integer;
  v_blocked boolean;
  v_attachment_path text;
BEGIN
  SELECT r.patient_id, r.provider_id
    INTO v_patient, v_provider
    FROM public.requests r
   WHERE r.status IN ('Accepted', 'On The Way', 'Arrived', 'Completed')
   LIMIT 1;

  IF v_patient IS NULL THEN
    RAISE NOTICE 'SKIP chat authorization checks: no qualifying patient/provider visit exists';
    RETURN;
  END IF;

  SELECT u.id INTO v_unrelated
    FROM public.users u
   WHERE u.id NOT IN (v_patient, v_provider)
     AND NOT EXISTS (
       SELECT 1 FROM public.requests r
        WHERE r.status IN ('Accepted', 'On The Way', 'Arrived', 'Completed')
          AND ((r.patient_id = v_patient AND r.provider_id = u.id)
            OR (r.provider_id = v_patient AND r.patient_id = u.id)
            OR (r.patient_id = v_provider AND r.provider_id = u.id)
            OR (r.provider_id = v_provider AND r.patient_id = u.id))
     )
   LIMIT 1;

  IF v_unrelated IS NULL THEN
    RAISE NOTICE 'SKIP unrelated-user checks: no unrelated account exists';
    RETURN;
  END IF;

  -- An authorized participant can send through the actual participant pair.
  PERFORM set_config('request.jwt.claim.sub', v_patient::text, true);
  PERFORM set_config('role', 'authenticated', true);
  INSERT INTO public.messages (sender_id, receiver_id, content, message_type, is_read)
  VALUES (v_patient, v_provider, 'authorization test', 'text', false)
  RETURNING id INTO v_message;
  RESET ROLE;

  -- A user cannot put another sender in sender_id, even when the other ID is a
  -- legitimate participant in a visit.
  PERFORM set_config('request.jwt.claim.sub', v_patient::text, true);
  PERFORM set_config('role', 'authenticated', true);
  v_blocked := false;
  BEGIN
    INSERT INTO public.messages (sender_id, receiver_id, content, message_type, is_read)
    VALUES (v_provider, v_patient, 'forged sender', 'text', false);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: forged sender_id was accepted'; END IF;

  -- A real sender cannot target an unrelated account.
  v_blocked := false;
  BEGIN
    INSERT INTO public.messages (sender_id, receiver_id, content, message_type, is_read)
    VALUES (v_patient, v_unrelated, 'forged recipient', 'text', false);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: unrelated receiver_id was accepted'; END IF;

  -- A participant cannot reassign an existing message to a different pair.
  v_blocked := false;
  BEGIN
    UPDATE public.messages SET receiver_id = v_unrelated WHERE id = v_message;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF NOT v_blocked AND v_rows <> 0 THEN
    RAISE EXCEPTION 'FAIL: existing message was reassigned';
  END IF;

  -- The authorized participant can read the row; the unrelated account cannot.
  SELECT count(*) INTO v_rows FROM public.messages WHERE id = v_message;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'FAIL: authorized participant cannot read message'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_unrelated::text, true);
  SELECT count(*) INTO v_rows FROM public.messages WHERE id = v_message;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'FAIL: unrelated account read message'; END IF;
  RESET ROLE;

  -- The same participant check governs call records and call diagnostics.
  PERFORM set_config('request.jwt.claim.sub', v_patient::text, true);
  PERFORM set_config('role', 'authenticated', true);
  v_blocked := false;
  BEGIN
    INSERT INTO public.calls (caller_id, callee_id, call_type)
    VALUES (v_patient, v_unrelated, 'audio');
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: unrelated call participant was accepted'; END IF;
  RESET ROLE;

  -- Check attachment visibility using a path referenced by an authorized visit
  -- message; the unrelated account must not pass the same storage helper.
  v_attachment_path := v_patient::text || '/' || v_provider::text || '/audit.jpg';
  PERFORM set_config('request.jwt.claim.sub', v_patient::text, true);
  PERFORM set_config('role', 'authenticated', true);
  INSERT INTO public.messages (sender_id, receiver_id, content, message_type, is_read)
  VALUES (v_patient, v_provider, v_attachment_path, 'image', false);
  IF NOT public.chat_attachment_is_participant(v_attachment_path) THEN
    RAISE EXCEPTION 'FAIL: authorized visit participant could not access attachment';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_unrelated::text, true);
  IF public.chat_attachment_is_participant(v_attachment_path) THEN
    RAISE EXCEPTION 'FAIL: unrelated account could access attachment';
  END IF;
  RESET ROLE;

  -- Seed a private topic row, then attempt a subscription read as an unrelated
  -- account. Realtime's private-channel authorization uses this same SELECT policy.
  v_attachment_path := 'chat_' || LEAST(v_patient::text, v_provider::text) || '_' ||
    GREATEST(v_patient::text, v_provider::text);
  INSERT INTO realtime.messages (topic, extension, payload, private, event)
  VALUES (v_attachment_path, 'broadcast', '{}'::jsonb, true, 'authorization-test');
  PERFORM set_config('request.jwt.claim.sub', v_unrelated::text, true);
  PERFORM set_config('realtime.topic', v_attachment_path, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO v_rows
    FROM realtime.messages
   WHERE topic = v_attachment_path;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'FAIL: unrelated account subscribed to private chat topic'; END IF;
  RESET ROLE;

  -- This direct insert simulates an unauthorized broadcast publish; transaction
  -- rollback removes any attempted event.
  PERFORM set_config('request.jwt.claim.sub', v_unrelated::text, true);
  PERFORM set_config('realtime.topic', v_attachment_path, true);
  PERFORM set_config('role', 'authenticated', true);
  v_blocked := false;
  BEGIN
    INSERT INTO realtime.messages (topic, extension, payload, private, event)
    VALUES (
      current_setting('realtime.topic'),
      'broadcast',
      '{}'::jsonb,
      true,
      'unauthorized-test'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: unrelated account published to private chat topic'; END IF;
  RESET ROLE;

  RAISE NOTICE 'PASS: authorized visit pair, forged IDs, reassignment, unrelated reads, calls, attachments, and realtime publish';
END $$;

ROLLBACK;
