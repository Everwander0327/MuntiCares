-- ========================================================
-- MuntiCares Experimental Database Initialization Script
-- Target Project: kumijiwepididcsyqchy
-- Generated automatically from verified production schema
-- ========================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CORE TABLES
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'patient',
  avatar_url TEXT,
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  phone TEXT,
  address TEXT,
  medical_notes TEXT,
  emergency_contact TEXT,
  is_profile_complete BOOLEAN DEFAULT FALSE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geocoded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  services TEXT[] DEFAULT '{}',
  rating NUMERIC DEFAULT 0,
  location TEXT,
  price_per_service NUMERIC DEFAULT 0,
  phone TEXT,
  bio TEXT,
  is_profile_complete BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  professional_id_path TEXT,
  trust_score NUMERIC DEFAULT 0,
  professional_id_status TEXT DEFAULT 'none',
  professional_id_paths TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  service TEXT,
  date TEXT,
  time TEXT,
  status TEXT DEFAULT 'Pending',
  price TEXT,
  notes TEXT,
  payment_status TEXT DEFAULT 'unpaid',
  dest_lat DOUBLE PRECISION,
  dest_lng DOUBLE PRECISION,
  route_started_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_locations (
  request_id UUID PRIMARY KEY REFERENCES public.requests(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_locations_provider_idx ON public.provider_locations(provider_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consent_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT TRUE,
  last_access TIMESTAMPTZ,
  permissions JSONB DEFAULT '{"documents": true, "visit_notes": true, "medical_history": true}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, provider_id)
);

CREATE TABLE IF NOT EXISTS public.medical_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  allergies TEXT,
  chronic_conditions TEXT,
  past_surgeries TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.visit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  notes TEXT,
  vitals_bp TEXT,
  vitals_hr TEXT,
  vitals_temp TEXT,
  vitals_rr TEXT,
  vitals_spo2 TEXT,
  pain_scale NUMERIC,
  services_rendered TEXT,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  document_title TEXT,
  file_path TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
  rating NUMERIC NOT NULL DEFAULT 5,
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_review_per_request UNIQUE(request_id)
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT,
  target_audience TEXT DEFAULT 'all',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'pending_cash',
  platform_fee NUMERIC DEFAULT 0,
  provider_payout NUMERIC DEFAULT 0,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. REALTIME & TRIGGERS
ALTER TABLE public.requests REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.consent_access REPLICA IDENTITY FULL;
ALTER TABLE public.announcements REPLICA IDENTITY FULL;
ALTER TABLE public.provider_locations REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.consent_access; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_locations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_provider_location()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('Completed', 'Cancelled', 'Rejected') THEN
    DELETE FROM public.provider_locations WHERE request_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cleanup_provider_location ON public.requests;
CREATE TRIGGER trg_cleanup_provider_location
  AFTER UPDATE OF status ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_provider_location();

-- 4. BASELINE PERMISSIONS (RLS disabled by default on experimental, ready for RLS policies)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_access DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_histories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;


-- ========================================================
-- 5. SEED DATA REPLICATION
-- ========================================================

-- Table: users (18 rows)
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('91e0b115-e381-402a-a930-61e85c4989b0', 'Andrew Ymson', 'andrew@gmail.com', '07081c592699a67f4485da2be31a48dbbb1372faf2a0683dee2435a18ec81870', 'patient', '2026-05-20T07:40:35.73816+00:00', FALSE, '/images/avatars/avatar_patient_hoodie.jpg') ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('426a5992-c6c6-4171-8136-001f4b25e201', 'John Lawrence Soriano', 'johnlawrence@gmail.com', 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f', 'provider', '2026-05-20T09:18:44.754171+00:00', FALSE, '/images/avatars/avatar_doctor_male.jpg') ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('8a1b0477-3ab9-4842-b56d-32f9231ebe16', 'System Admin', 'admin@munticares.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin', '2026-05-20T07:38:52.569194+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('be6968bf-f5f0-44c8-9c12-0cf1d5a5c218', 'Neko Forger', 'Neko@gmail.com', 'acbd290c821cfad814ae78278e0657fe73aa396e1b14db8a8e06e9111678208b', 'patient', '2026-05-22T10:49:05.542728+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('3ed1c501-292c-4048-8751-f9aaab930df9', 'Tianix Sayk', 'tianix@gmail.com', '81b4420bb03fe86a2d02cf7f09bd6ff9ce90881a7837c9562ab42ad12757bb80', 'patient', '2026-05-23T04:17:57.204788+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('93ccded0-a593-4123-8a51-b8c78b990f00', 'Mark Daniel Verdijo', 'markdaniel@gmail.com', 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f', 'patient', '2026-05-20T09:21:35.628202+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('bb745208-1f9c-4999-9345-31278f0529e7', 'Jose Rizal', 'jose.rizal@gmail.com', 'edf1ae3452a7e0a3a6d9669cc56acb120a09b52cf2f568382482624ac53c7355', 'patient', '2026-05-25T16:17:15.984345+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('4edcf3c2-6821-44e1-bbc2-af55b334f0e6', 'Paengpaeng', 'paengpaeng@gmail.com', 'b444ee97a8296e40b50fe30900c7283e714ebf37abbfefcab091264cdc37efcc', 'patient', '2026-05-21T10:07:33.919145+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('99612a48-7162-4514-854a-e4aa2884af45', 'Princess ', 'princessnephreteryaviles@gmail.com', '514e4f59962dd2d775444ac859a100ae7857de7f53bbc2a2b25b931d8b8c3358', 'patient', '2026-06-04T03:51:24.635275+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('785b4754-efcd-4617-a621-f6834ce32cf0', 'Daniela Tomol', 'tomoldaniela_bsit@plmun.edu.ph', '2bc18429e9dc5d474a0d01b01ad3dfbe93d929ec0d764bf258821e0fb8184411', 'patient', '2026-06-04T07:40:25.997709+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('7a9c63eb-6965-4424-9b34-cf42f09bbeed', 'Jayson', 'jayceon@gmail.com', 'bdac857dfb500a0791bd7cd72a8ad260b9a3db09ce8f9de1285f2dbd3412e874', 'patient', '2026-06-18T03:57:54.302003+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('31bf0d88-dc79-468e-8867-689f97a60608', 'Denmarc Revilla', 'denmarcrevilla@gmail.com', 'fdb63d42c6ae230ec7193ab562885e49519fb7118a8713f249a03eb16ab5ba23', 'patient', '2026-06-24T12:49:41.127049+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('ffa75e43-df39-415b-b293-45367b8e3386', 'bry pabilar', 'pabilarbryankaylle_bsit@plmun.edu.ph', '17ca907dac4436e9f9637871ed7c38279511ffbb3611a3b320f9992f84bc69a2', 'provider', '2026-05-20T16:10:00.181369+00:00', FALSE, 'https://zsqowrouxuxjjmosbvxt.supabase.co/storage/v1/object/public/profile-photos/avatars/ffa75e43-df39-415b-b293-45367b8e3386/1780218550502.jpg') ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('cffc696f-c71b-406f-8cc9-6526d1ac1bda', 'kalkal', 'pabilarbryan@gmail.com', '202505875178162dac61e2017ec42b77815ec79e45b10fef54b9edfdf924af6a', 'patient', '2026-05-20T16:48:42.008092+00:00', FALSE, '/images/avatars/avatar_patient_tie_ref.jpg') ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', 'Johnny sins', 'johnny@gmail.com', 'john123', 'provider', '2026-05-20T08:08:18.642057+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('862f26e6-65ad-47bc-b340-a62756305bd6', 'Mark Daniel Verdijo', 'markverdijo0809@gmail.com', '123456', 'patient', '2026-05-21T10:42:51.776717+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('ac39ad5a-9222-42e3-b80e-2b8e2af086c3', 'Princess Thea', 'princesstheamabangis@gmail.com', '5d2b21016efa739f5b8eb7dc1dbd0f49e9fe30b02fe0125cb5aaddb3b0463bab', 'patient', '2026-10-17T03:43:34.644364+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.users (id, full_name, email, password, role, created_at, is_banned, avatar_url) VALUES ('eafdc900-a5f9-4897-93d5-3f3570cbc6b0', 'Rene', 'rene@gmail.com', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'patient', '2026-10-22T14:01:09.339331+00:00', FALSE, '/images/avatars/avatar_patient_shirt_tie.jpg') ON CONFLICT DO NOTHING;

-- Table: patients (3 rows)
INSERT INTO public.patients (id, user_id, phone, address, medical_notes, emergency_contact, is_profile_complete, created_at, latitude, longitude, geocoded_at) VALUES ('44253ef2-4e7d-4063-b902-74b958e630e2', 'ffa75e43-df39-415b-b293-45367b8e3386', '', '', '', '', TRUE, '2026-05-31T09:09:39.504262+00:00', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.patients (id, user_id, phone, address, medical_notes, emergency_contact, is_profile_complete, created_at, latitude, longitude, geocoded_at) VALUES ('2971e3fc-196f-4684-8e3a-cf6b2a12db62', '3ed1c501-292c-4048-8751-f9aaab930df9', '09380873224', 'Luxembourg Center Subdivision ', 'Heart ache', 'Zeke', TRUE, '2026-05-23T04:53:50.823918+00:00', NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.patients (id, user_id, phone, address, medical_notes, emergency_contact, is_profile_complete, created_at, latitude, longitude, geocoded_at) VALUES ('e5bd7db0-34e8-435f-b635-13546b8d0763', '91e0b115-e381-402a-a930-61e85c4989b0', '0986416543', 'Ayala Alabang Village, Muntinlupa City', 'High Blood Pressure, Heart Condition', 'Neko/09865543214', TRUE, '2026-05-20T10:53:08.480599+00:00', 14.4215, 121.0335, '2026-10-17T10:32:41.172+00:00') ON CONFLICT DO NOTHING;

-- Table: providers (3 rows)
INSERT INTO public.providers (id, user_id, services, rating, location, price_per_service, created_at, phone, bio, is_profile_complete, is_approved, professional_id_path, trust_score, professional_id_status, professional_id_paths) VALUES ('7551493a-4e44-49da-b4a5-adfbf3fa0cb0', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', '{"Wound Care","Vital Signs Monitoring","Post-Surgery Recovery"}', 0, 'Muntinlupa City', 1500, '2026-05-20T08:08:19.425366+00:00', '0924856713', 'Registered Nurse', TRUE, TRUE, NULL, 0, 'none', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.providers (id, user_id, services, rating, location, price_per_service, created_at, phone, bio, is_profile_complete, is_approved, professional_id_path, trust_score, professional_id_status, professional_id_paths) VALUES ('cae5a863-ab94-4216-85a2-4ea61f303515', '426a5992-c6c6-4171-8136-001f4b25e201', '{"Wound Care","Post-Surgery Recovery","Vital Signs Monitoring","Medication Administration","Elderly Care","Physical Therapy","Dementia Care","Stroke Rehab"}', 4.6, 'Muntinlupa City', 9000, '2026-05-20T09:18:45.127625+00:00', '096256325923', 'Nurse ng lahat', TRUE, TRUE, '426a5992-c6c6-4171-8136-001f4b25e201/dca9c5b8-af59-4a55-ab1f-9e6d49528c8d.jpg', 80, 'verified', '{"426a5992-c6c6-4171-8136-001f4b25e201/dca9c5b8-af59-4a55-ab1f-9e6d49528c8d.jpg","426a5992-c6c6-4171-8136-001f4b25e201/ecc72717-8e0f-4a14-a9c9-c412096221bd.pdf","426a5992-c6c6-4171-8136-001f4b25e201/1779517949904-j4p21yx.jpeg"}') ON CONFLICT DO NOTHING;
INSERT INTO public.providers (id, user_id, services, rating, location, price_per_service, created_at, phone, bio, is_profile_complete, is_approved, professional_id_path, trust_score, professional_id_status, professional_id_paths) VALUES ('b4cce69e-6cb2-44a4-820e-3e242494cf9c', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', '{"Wound Care","Post-Surgery Recovery","Vital Signs Monitoring","Medication Administration","Dementia Care","Elderly Care","Stroke Rehab","Physical Therapy"}', 0, 'Muntinlupa City', 1500000, '2026-05-20T16:48:42.168822+00:00', '09383698438', 'Professional Dr kwakwak', TRUE, TRUE, NULL, 80, 'verified', '{}') ON CONFLICT DO NOTHING;

-- Table: requests (54 rows)
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('a288a5c6-2e43-4b29-bdec-6814ebdbb472', '93ccded0-a593-4123-8a51-b8c78b990f00', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', 'Wound Care', '2026-05-20', 'Rejected', '1500', '', '2026-05-20T09:27:06.431516+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('0f827765-b9b8-41e9-a5de-30f2ba7f0386', '91e0b115-e381-402a-a930-61e85c4989b0', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', 'Wound Care', '2026-10-14', 'Cancelled', '1500', '[Cancelled by patient] No reason provided', '2026-10-14T10:49:46.0663+00:00', '13:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('62e30e01-55ac-44ea-98c7-35179dc14c26', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-22', 'Rejected', '9000', 'help po', '2026-05-22T17:48:24.024567+00:00', '11:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('c7d00fae-b56b-43db-8583-ecb1c12b73fd', 'ffa75e43-df39-415b-b293-45367b8e3386', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', 'Wound Care', '2026-05-20', 'Rejected', '1500', 'papapwet po ', '2026-05-20T16:14:15.032717+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('e61e6856-e3f8-4ff6-ac48-786d360379c4', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-23', 'Completed', '9000', '', '2026-05-23T07:44:51.969686+00:00', '12:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('8c0a6479-fe01-4006-90f5-3988f59a4499', '91e0b115-e381-402a-a930-61e85c4989b0', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', 'Wound Care', '2026-05-20', 'Completed', '1500', '', '2026-05-20T08:35:45.928611+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('4a56deab-2871-4c74-960c-9ab4947f0d1b', 'ffa75e43-df39-415b-b293-45367b8e3386', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-24', 'Rejected', '9000', 'Pa-pwet po', '2026-05-24T19:12:18.196047+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('fea7a24d-ba4d-44e7-b64e-0057fc98524a', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-22', 'Completed', '9000', '[Cancelled by patient]', '2026-05-22T18:52:56.243385+00:00', '10:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('5477a032-b470-4a80-bc92-067436788f82', '93ccded0-a593-4123-8a51-b8c78b990f00', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-20', 'Completed', '9000', '', '2026-05-20T14:46:26.152406+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('20846622-e994-47bf-ba5b-52665246eee7', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-20', 'Completed', '9000', 'pagamot po sakit ng ulo', '2026-05-20T15:26:17.957253+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('7bba83a3-08e2-4df3-bdfd-530f6d270664', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-25', 'Completed', '9000', 'Pakibilisan po
', '2026-05-21T10:39:03.441805+00:00', '04:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('fda3f1ba-321c-482b-a67b-c67571ee2a48', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-22', 'Cancelled', '9000', '[Cancelled by patient]', '2026-05-22T19:02:42.515984+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('9385cde9-2e8c-4522-ab30-00b29c56d1b4', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-22', 'Cancelled', '9000', '[Cancelled by patient] ayaw ko na po', '2026-05-21T10:42:38.935424+00:00', '03:21:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('35a2a3d6-647e-4e5b-bd73-725eddc6ecc8', 'ffa75e43-df39-415b-b293-45367b8e3386', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-10-12', 'Completed', '9000', 'may hadhad sa singit ', '2026-10-12T13:52:18.429886+00:00', '11:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('48764a48-adae-4746-ac3f-1438b99defe2', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-23', 'Cancelled', '9000', '[Cancelled by patient] Schedule conflict', '2026-05-23T01:25:32.69492+00:00', '11:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('94635e0c-a704-4cb8-97ec-d792943aa840', '4edcf3c2-6821-44e1-bbc2-af55b334f0e6', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-22', 'Completed', '9000', '', '2026-05-21T10:08:05.177308+00:00', '10:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('324bf7db-018d-477c-bc08-4fad05765fd2', 'ffa75e43-df39-415b-b293-45367b8e3386', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', 'Wound Care', '2026-06-30', 'Completed', '1500000', 'adadadadadadadadadad', '2026-06-30T05:24:33.77077+00:00', '13:00:00', 'paid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('410b081a-674a-4142-809c-2380330201bf', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-31', 'Rejected', '9000', 'accept me please', '2026-05-22T17:47:21.736133+00:00', '11:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('b77ab165-aa34-499b-955b-c78316bdb0c0', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-22', 'Rejected', '9000', 'help po', '2026-05-22T05:52:23.653941+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('4fd26bb1-59c8-49d9-a346-39eb48f94e92', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-22', 'Rejected', '9000', 'pahelp po', '2026-05-22T11:59:34.350865+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('c637ea8b-0b1b-4e41-a024-41593444bde5', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-23', 'Rejected', '9000', '', '2026-05-23T01:37:22.093294+00:00', '11:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('72c9576d-abe4-4d9f-85af-bd32597e51d6', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-22', 'Completed', '9000', 'help po
[Pre-session Symptoms] sakit po ng ulo ko doc', '2026-05-22T12:01:57.680597+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('407447c4-1c5a-4b34-9a3e-2b9d325de9e2', '3ed1c501-292c-4048-8751-f9aaab930df9', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-23', 'Rejected', '9000', '', '2026-05-23T05:29:54.859714+00:00', '13:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('b0bc7f34-5e12-4a18-b981-b260b1652272', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-25', 'Rejected', '9000', '', '2026-05-25T02:12:35.625158+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('29868784-6f88-4592-bd8f-7eb760abe3c4', '91e0b115-e381-402a-a930-61e85c4989b0', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', 'Wound Care', '2026-05-25', 'Cancelled', '1500', '[Cancelled by patient] No reason provided', '2026-05-25T02:13:57.508187+00:00', '16:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('f24cd247-a0e4-4e0b-b57b-3868af880e27', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-23', 'Completed', '9000', '', '2026-05-23T06:38:18.793112+00:00', '15:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('2983f49c-9d4d-4ea2-bf06-22c2a3db6154', 'bb745208-1f9c-4999-9345-31278f0529e7', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-27', 'Rejected', '9000', '', '2026-05-25T16:17:55.842591+00:00', '14:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('fa586c01-bd7a-46ae-a49c-5a3367fc76fa', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-23', 'Completed', '9000', 'Sjsjshssb', '2026-05-23T06:57:29.170078+00:00', '15:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('85fe094c-abe5-4985-8523-eff6655ee8e4', 'ffa75e43-df39-415b-b293-45367b8e3386', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-06-25', 'Rejected', '9000', 'papapwet po ', '2026-05-26T13:54:46.524459+00:00', '15:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('a782c924-260a-4073-8dc9-4d21dacb9d9f', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-27', 'Completed', '9000', '', '2026-05-27T06:19:02.273665+00:00', '12:00:00', 'pending_cash', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('986adc1d-b684-4cfc-a69e-29e2069aada7', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-27', 'Cancelled', '9000', '[Cancelled by patient] No reason provided', '2026-05-27T05:46:32.620555+00:00', '11:00:00', 'pending_cash', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('4e281c92-a74a-4ba7-b09c-03295d292269', 'ffa75e43-df39-415b-b293-45367b8e3386', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-27', 'Rejected', '9000', 'l,mk', '2026-05-27T07:15:20.828984+00:00', '09:00:00', 'paid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('9fb8ad80-1724-4659-8b89-4f5071f70eeb', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-27', 'Cancelled', '9000', '[Cancelled by patient] Changed my mind', '2026-05-27T05:52:55.293259+00:00', '13:00:00', 'pending_cash', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('02af2211-37f5-4ba5-9654-82bec5685f17', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', 'Wound Care', '2026-10-12', 'Pending', '1500', 'lkklklklk
[Pre-session Symptoms] adadadasdasdada  | BP: 23 | Temp: 23°C | HR: 23 bpm | Weight: 23 kg', '2026-10-12T14:03:11.074015+00:00', '11:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('461185bf-b558-46f6-bb91-5e878b2aed57', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-27', 'Completed', '9000', '', '2026-05-27T06:27:52.551962+00:00', '13:00:00', 'paid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('bd6fd7c7-81d9-4c4e-aa9d-47ac2e63189e', '7a9c63eb-6965-4424-9b34-cf42f09bbeed', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-06-20', 'Completed', '9000', '', '2026-06-18T03:59:00.363065+00:00', '13:00:00', 'paid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('a24bcc61-3290-4f2d-b4b0-127ed84bee57', 'ffa75e43-df39-415b-b293-45367b8e3386', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-06-01', 'Completed', '9000', '', '2026-06-01T04:05:04.072469+00:00', '09:00:00', 'paid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('5212075e-b4ee-475a-bd93-8417337ddd76', '3ed1c501-292c-4048-8751-f9aaab930df9', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', 'Wound Care', '2026-05-23', 'Completed', '1500000', '', '2026-05-23T05:29:12.732709+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('54c91c4c-e0bc-4cfb-bdd2-536ebd3e21a2', 'ffa75e43-df39-415b-b293-45367b8e3386', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', 'Wound Care', '2026-05-27', 'Completed', '1500000', 'jhhghghg', '2026-05-27T07:15:54.192297+00:00', '09:00:00', 'paid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('33faa36e-962b-4f9a-bc87-37f8311f43de', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-06-18', 'Completed', '9000', 'Checking ', '2026-06-18T03:56:32.803817+00:00', '09:00:00', 'paid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('2f60152d-75d2-4323-9112-ac8fff80239f', '4edcf3c2-6821-44e1-bbc2-af55b334f0e6', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', 'Wound Care', '2026-06-24', 'Pending', '1500', 'dsfdsf', '2026-06-24T10:28:54.129768+00:00', '09:00:00', 'paid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('0ee82497-8409-4c83-942f-99bba966ef3e', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-10-11', 'Rejected', '9000', 'Sakit po ulo ko', '2026-10-11T12:57:40.545943+00:00', '10:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('f7f68eff-ba73-456e-89d3-ddde3deead77', 'bb745208-1f9c-4999-9345-31278f0529e7', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', 'Wound Care', '2026-05-30', 'Completed', '1500000', '', '2026-05-25T17:30:07.93679+00:00', '16:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('df10d408-b6d7-452b-b66f-6cb0a444b839', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-06-25', 'Completed', '9000', '', '2026-06-18T04:03:33.346192+00:00', '13:00:00', 'paid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('ac9feed7-fc7c-443e-a6fe-fe41cd52ef28', 'ffa75e43-df39-415b-b293-45367b8e3386', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', 'Wound Care', '2026-05-22', 'Completed', '1500000', '', '2026-05-22T06:14:48.645124+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('0f6c0595-054d-4f8d-a390-33e39056bb77', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-10-16', 'Completed', '9000', '', '2026-10-16T11:27:09.022506+00:00', '10:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('4ea7183a-5b20-4137-a75f-daa6e4dc533f', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-08-10', 'Cancelled', '9000', '[Cancelled by patient] No reason provided', '2026-08-10T12:58:17.806383+00:00', '10:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('375d3089-f236-4119-8072-1e619b9fbfb3', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-10-11', 'Completed', '9000', 'Sakit ulo ko doc', '2026-10-11T13:02:14.284375+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('fce2c917-8cd3-4d54-983d-72358eafcdfd', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-10-12', 'Completed', '9000', '', '2026-10-12T02:13:14.962102+00:00', '10:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('d961624a-0eb5-4031-9bac-41f7618a8dfc', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-10-16', 'Completed', '9000', '', '2026-10-16T11:47:41.97288+00:00', '09:00:00', 'unpaid', 14.427794, 121.050205, '2026-10-16T11:54:38.288+00:00', '2026-10-16T12:18:45.506+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('c553e6d7-aadf-4f53-982d-109a6a706f2a', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-10-17', 'Completed', '9000', '', '2026-10-17T08:17:01.828913+00:00', '12:00:00', 'unpaid', 14.4215, 121.0335, '2026-10-17T08:17:16.432+00:00', '2026-10-17T08:24:58.075+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('78100025-e0d1-4933-9f7f-d9a23e917c58', 'ffa75e43-df39-415b-b293-45367b8e3386', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-05-29', 'Completed', '9000', 'dasdasdasd', '2026-05-29T08:57:06.608056+00:00', '09:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('c74e9362-197e-42a6-9eaf-a96e13105701', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'Wound Care', '2026-10-17', 'Completed', '9000', '', '2026-10-17T08:34:02.222497+00:00', '11:00:00', 'unpaid', 14.4215, 121.0335, '2026-10-17T08:34:15.487+00:00', '2026-10-17T08:47:29.922+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.requests (id, patient_id, provider_id, service, date, status, price, notes, created_at, time, payment_status, dest_lat, dest_lng, route_started_at, arrived_at) VALUES ('b8ed4f35-8087-499d-b55b-28a73546d49b', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', 'Wound Care', '2026-10-22', 'Pending', '1500000', '', '2026-10-22T06:50:02.797094+00:00', '11:00:00', 'unpaid', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;

-- Table: consent_access (16 rows)
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('93d09c0f-443c-4b9c-85a7-f20305719169', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', TRUE, '2026-10-17T09:47:53.533+00:00', '2026-05-20T15:26:18.176589+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('32e5e9ef-2e47-4ea4-8bcd-ab1441b397a3', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', TRUE, NULL, '2026-10-22T06:50:03.010129+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('5764e62a-5d3e-4800-8f99-ab78ba84c10d', 'bb745208-1f9c-4999-9345-31278f0529e7', '426a5992-c6c6-4171-8136-001f4b25e201', TRUE, NULL, '2026-05-25T16:17:56.055441+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('4475031d-9816-4674-a34c-4891ba856303', '3ed1c501-292c-4048-8751-f9aaab930df9', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', TRUE, NULL, '2026-05-23T05:29:12.997727+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('59aa6e51-3bf7-41fe-99cb-2c07ab705b36', '3ed1c501-292c-4048-8751-f9aaab930df9', '426a5992-c6c6-4171-8136-001f4b25e201', TRUE, NULL, '2026-05-23T05:29:55.057406+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('e70103ad-8995-4b24-b63a-c3e0e144005e', '4edcf3c2-6821-44e1-bbc2-af55b334f0e6', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', TRUE, NULL, '2026-06-24T10:28:54.328738+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('03f35867-713e-48ec-9be1-5f496345e752', 'ffa75e43-df39-415b-b293-45367b8e3386', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', TRUE, NULL, '2026-05-22T06:14:48.92133+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('72e8ba2b-15fa-421a-9e67-a59759d36cb2', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', TRUE, NULL, '2026-10-12T14:03:11.244234+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('4aed71a5-aa9a-4354-8196-9ff379da2a7a', 'ffa75e43-df39-415b-b293-45367b8e3386', '426a5992-c6c6-4171-8136-001f4b25e201', TRUE, '2026-10-13T15:21:43.03+00:00', '2026-05-24T19:12:18.435787+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('72e3ecc7-874d-4a1d-a2ff-eca2519e5b64', 'bb745208-1f9c-4999-9345-31278f0529e7', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', TRUE, '2026-05-27T07:19:23.782+00:00', '2026-05-25T17:30:08.142301+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('0c23aee8-441f-4e0c-9710-d9c30d47d626', '91e0b115-e381-402a-a930-61e85c4989b0', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', TRUE, NULL, '2026-05-20T08:35:46.133609+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('eb0ce476-aecf-4f87-b3c4-5b338f1db80f', '7a9c63eb-6965-4424-9b34-cf42f09bbeed', '426a5992-c6c6-4171-8136-001f4b25e201', TRUE, '2026-10-10T11:57:00.214+00:00', '2026-06-18T03:59:00.575144+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('39ac7f97-9167-4e09-9402-10468343429a', '93ccded0-a593-4123-8a51-b8c78b990f00', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', TRUE, NULL, '2026-05-20T09:27:06.770634+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('5ee3c037-990b-40f2-8a56-64effd89acea', '93ccded0-a593-4123-8a51-b8c78b990f00', '426a5992-c6c6-4171-8136-001f4b25e201', TRUE, NULL, '2026-05-20T14:46:26.403079+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('ea9cdd45-4829-44da-bd6a-f6522abb2738', 'ffa75e43-df39-415b-b293-45367b8e3386', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', TRUE, NULL, '2026-05-20T16:14:15.207808+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.consent_access (id, patient_id, provider_id, is_enabled, last_access, created_at, permissions) VALUES ('0361bed2-8e70-4ae0-9cdd-a7296e4a9f6a', '4edcf3c2-6821-44e1-bbc2-af55b334f0e6', '426a5992-c6c6-4171-8136-001f4b25e201', TRUE, NULL, '2026-05-21T10:08:05.410551+00:00', '{"documents":true,"visit_notes":true,"medical_history":true}'::jsonb) ON CONFLICT DO NOTHING;

-- Table: medical_histories (2 rows)
INSERT INTO public.medical_histories (id, patient_id, allergies, chronic_conditions, past_surgeries, updated_at) VALUES ('cda6b56e-705b-4af4-9685-a8794d0969e1', 'ffa75e43-df39-415b-b293-45367b8e3386', 'Latex, No known allergies', 'High Blood Pressure', 'C-Section', '2026-05-31T09:09:39.864336+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.medical_histories (id, patient_id, allergies, chronic_conditions, past_surgeries, updated_at) VALUES ('9687ba93-bc5c-4a63-8f53-e04411526b01', '91e0b115-e381-402a-a930-61e85c4989b0', 'Penicillin', 'Asthma', 'Gallbladder Removal', '2026-05-23T07:32:19.667165+00:00') ON CONFLICT DO NOTHING;

-- Table: visit_notes (2 rows)
INSERT INTO public.visit_notes (id, patient_id, provider_id, vitals_bp, vitals_temp, notes, created_at, vitals_hr, vitals_rr, vitals_spo2, pain_scale, services_rendered, attachment_url) VALUES ('ce04a31c-f7f3-4131-accb-2266d09105e8', '91e0b115-e381-402a-a930-61e85c4989b0', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', '100/70', '35.4', 'okay naman sya magaling naman na', '2026-05-21T04:23:16.928152+00:00', '90', '20', '97', 2, 'Physical Therapy', 'provider_notes/5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac_0.10519063549651453.jpeg') ON CONFLICT DO NOTHING;
INSERT INTO public.visit_notes (id, patient_id, provider_id, vitals_bp, vitals_temp, notes, created_at, vitals_hr, vitals_rr, vitals_spo2, pain_scale, services_rendered, attachment_url) VALUES ('8cdbbf79-100a-4d14-b7d2-3e49ee4c5269', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', '50', '35.3', 'ayos naman sya nawala na sakit ng ulo nya dahil lang siguro sa init ng panahon', '2026-10-11T13:09:00.612842+00:00', '110', '', '99', NULL, '', NULL) ON CONFLICT DO NOTHING;

-- Table: patient_documents (1 rows)
INSERT INTO public.patient_documents (id, patient_id, document_title, file_path, uploaded_at) VALUES ('fdcd5418-170b-4514-b400-cd4cace58a7c', '91e0b115-e381-402a-a930-61e85c4989b0', 'John_Lawrence_Soriano_Resume.pdf', '91e0b115-e381-402a-a930-61e85c4989b0/0.6438089048891121.pdf', '2026-05-20T15:39:44.443072+00:00') ON CONFLICT DO NOTHING;

-- Table: provider_reviews (9 rows)
INSERT INTO public.provider_reviews (id, patient_id, provider_id, request_id, rating, review_text, created_at) VALUES ('5af59e5c-dd80-4b04-a6aa-91b678343ae7', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', '375d3089-f236-4119-8072-1e619b9fbfb3', 5, 'Malupit po si doc', '2026-10-11T13:09:28.294737+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.provider_reviews (id, patient_id, provider_id, request_id, rating, review_text, created_at) VALUES ('edde6222-dd2b-4272-b09e-5590d56a3271', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'fa586c01-bd7a-46ae-a49c-5a3367fc76fa', 5, 'Kyupal', '2026-05-23T06:58:45.690239+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.provider_reviews (id, patient_id, provider_id, request_id, rating, review_text, created_at) VALUES ('84347a39-b0f2-4e33-85e8-0ff08ec48290', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'e61e6856-e3f8-4ff6-ac48-786d360379c4', 5, 'Angas po', '2026-05-23T07:47:00.093908+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.provider_reviews (id, patient_id, provider_id, request_id, rating, review_text, created_at) VALUES ('78cc17e1-b632-4c9c-8fba-d3d36d0ba2f0', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'a782c924-260a-4073-8dc9-4d21dacb9d9f', 4, 'lopit po', '2026-05-28T09:14:53.539057+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.provider_reviews (id, patient_id, provider_id, request_id, rating, review_text, created_at) VALUES ('4d737f3c-3b9b-4f67-951c-4acdb55bdddf', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', '461185bf-b558-46f6-bb91-5e878b2aed57', 4, 'sana ma book ulit', '2026-05-28T09:15:04.966435+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.provider_reviews (id, patient_id, provider_id, request_id, rating, review_text, created_at) VALUES ('f493bd4f-907e-4833-bd0d-8cb292ac2098', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', '20846622-e994-47bf-ba5b-52665246eee7', 4, 'lopit aydol', '2026-05-22T05:18:45.849717+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.provider_reviews (id, patient_id, provider_id, request_id, rating, review_text, created_at) VALUES ('30180ecb-6f77-401b-ac4e-408f749b6213', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', '72c9576d-abe4-4d9f-85af-bd32597e51d6', 4, 'ampanget', '2026-05-22T12:04:29.939691+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.provider_reviews (id, patient_id, provider_id, request_id, rating, review_text, created_at) VALUES ('5e985842-0e5c-46a6-8595-09ffe7234578', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 'f24cd247-a0e4-4e0b-b57b-3868af880e27', 5, NULL, '2026-05-23T06:39:24.04083+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.provider_reviews (id, patient_id, provider_id, request_id, rating, review_text, created_at) VALUES ('89e9d7c0-2f0f-453b-8ea8-a385d5675f21', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', '33faa36e-962b-4f9a-bc87-37f8311f43de', 5, NULL, '2026-06-18T04:01:49.192914+00:00') ON CONFLICT DO NOTHING;

-- Table: announcements (2 rows)
INSERT INTO public.announcements (id, title, message, target_audience, created_by, created_at) VALUES ('3e55acce-3d5e-4e71-83de-80473321cf60', 'TEST', 'hello', 'all', '8a1b0477-3ab9-4842-b56d-32f9231ebe16', '2026-10-11T05:36:17.149753+00:00') ON CONFLICT DO NOTHING;
INSERT INTO public.announcements (id, title, message, target_audience, created_by, created_at) VALUES ('162abeb6-1b94-4d59-949a-1de333eda93b', 'City Health Advisory: Barangay Health Caravan & Mobile Clinic Schedule', 'Free medical checkups, vital signs monitoring, and maintenance medicine distribution are actively conducted across all 9 barangays in Muntinlupa City. In-home consultations can be requested directly via MuntiCares.', 'all', NULL, '2026-05-29T08:47:19.697421+00:00') ON CONFLICT DO NOTHING;

-- Table: transactions (13 rows)
INSERT INTO public.transactions (id, request_id, patient_id, provider_id, amount, payment_method, status, created_at, paid_at, platform_fee, provider_payout) VALUES ('ff6223c0-8a66-4350-af77-5cc005da4b7e', '986adc1d-b684-4cfc-a69e-29e2069aada7', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 9000, 'cash', 'pending_cash', '2026-05-27T05:47:04.15391+00:00', NULL, 0, 0) ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (id, request_id, patient_id, provider_id, amount, payment_method, status, created_at, paid_at, platform_fee, provider_payout) VALUES ('de6cdfea-e279-47d3-b56f-3a86e283c501', '9fb8ad80-1724-4659-8b89-4f5071f70eeb', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 9000, 'cash', 'pending_cash', '2026-05-27T05:53:10.013057+00:00', NULL, 0, 0) ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (id, request_id, patient_id, provider_id, amount, payment_method, status, created_at, paid_at, platform_fee, provider_payout) VALUES ('cfd75d81-8bd7-4d9e-8ac6-68bd605ff566', 'a782c924-260a-4073-8dc9-4d21dacb9d9f', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 9000, 'cash', 'pending_cash', '2026-05-27T06:19:10.503477+00:00', NULL, 0, 0) ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (id, request_id, patient_id, provider_id, amount, payment_method, status, created_at, paid_at, platform_fee, provider_payout) VALUES ('27823d1c-5f8b-4776-9d2a-a043aa92756b', '461185bf-b558-46f6-bb91-5e878b2aed57', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 9000, 'cash', 'collected', '2026-05-27T06:28:00.642803+00:00', '2026-05-27T06:30:10.058+00:00', 0, 0) ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (id, request_id, patient_id, provider_id, amount, payment_method, status, created_at, paid_at, platform_fee, provider_payout) VALUES ('6696c66e-5e68-4f36-ae57-deb676c9868b', '4e281c92-a74a-4ba7-b09c-03295d292269', 'ffa75e43-df39-415b-b293-45367b8e3386', '426a5992-c6c6-4171-8136-001f4b25e201', 9000, 'gcash', 'paid', '2026-05-27T07:15:28.286455+00:00', '2026-05-27T07:15:28.959+00:00', 0, 0) ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (id, request_id, patient_id, provider_id, amount, payment_method, status, created_at, paid_at, platform_fee, provider_payout) VALUES ('92decaee-6a63-48e9-a138-dd7838f0890c', '54c91c4c-e0bc-4cfb-bdd2-536ebd3e21a2', 'ffa75e43-df39-415b-b293-45367b8e3386', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', 1500000, 'gcash', 'paid', '2026-05-27T07:16:31.698065+00:00', '2026-05-27T07:16:32.385+00:00', 0, 0) ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (id, request_id, patient_id, provider_id, amount, payment_method, status, created_at, paid_at, platform_fee, provider_payout) VALUES ('4a52020b-8c82-4ef1-a44a-3ec958c89e1d', 'a24bcc61-3290-4f2d-b4b0-127ed84bee57', 'ffa75e43-df39-415b-b293-45367b8e3386', '426a5992-c6c6-4171-8136-001f4b25e201', 9000, 'cash', 'completed', '2026-06-01T04:05:08.518207+00:00', '2026-06-09T13:12:25.443+00:00', 0, 9000) ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (id, request_id, patient_id, provider_id, amount, payment_method, status, created_at, paid_at, platform_fee, provider_payout) VALUES ('3fc0598c-4434-418b-ab32-3accc121d55f', '33faa36e-962b-4f9a-bc87-37f8311f43de', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 9000, 'maya', 'paid', '2026-06-18T03:58:08.176528+00:00', '2026-06-18T03:58:07.811+00:00', 900, 8100) ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (id, request_id, patient_id, provider_id, amount, payment_method, status, created_at, paid_at, platform_fee, provider_payout) VALUES ('11c59a14-ae2e-4aab-b7c4-bcea412d69ee', '33faa36e-962b-4f9a-bc87-37f8311f43de', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 9000, 'maya', 'paid', '2026-06-18T03:58:20.614146+00:00', '2026-06-18T03:58:20.394+00:00', 900, 8100) ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (id, request_id, patient_id, provider_id, amount, payment_method, status, created_at, paid_at, platform_fee, provider_payout) VALUES ('b51c199c-192b-4c62-886f-050e38c6bd90', 'bd6fd7c7-81d9-4c4e-aa9d-47ac2e63189e', '7a9c63eb-6965-4424-9b34-cf42f09bbeed', '426a5992-c6c6-4171-8136-001f4b25e201', 9000, 'bank_transfer', 'paid', '2026-06-18T04:01:35.301682+00:00', '2026-06-18T04:01:35.082+00:00', 0, 9000) ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (id, request_id, patient_id, provider_id, amount, payment_method, status, created_at, paid_at, platform_fee, provider_payout) VALUES ('d0896ab0-9447-4d1c-a23f-420e89df3c22', 'df10d408-b6d7-452b-b66f-6cb0a444b839', '91e0b115-e381-402a-a930-61e85c4989b0', '426a5992-c6c6-4171-8136-001f4b25e201', 9000, 'bank_transfer', 'paid', '2026-06-18T04:03:42.217329+00:00', '2026-06-18T04:03:41.562+00:00', 0, 9000) ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (id, request_id, patient_id, provider_id, amount, payment_method, status, created_at, paid_at, platform_fee, provider_payout) VALUES ('69a87706-ba90-47eb-ae63-2d9c3333086f', '2f60152d-75d2-4323-9112-ac8fff80239f', '4edcf3c2-6821-44e1-bbc2-af55b334f0e6', '5d4e3af7-ab4d-4ab1-b047-83a13c7ea0ac', 1500, 'bank_transfer', 'paid', '2026-06-24T10:33:42.379502+00:00', '2026-06-24T10:33:42.81+00:00', 0, 1500) ON CONFLICT DO NOTHING;
INSERT INTO public.transactions (id, request_id, patient_id, provider_id, amount, payment_method, status, created_at, paid_at, platform_fee, provider_payout) VALUES ('a800a674-e0ec-4732-87ee-4746108821e7', '324bf7db-018d-477c-bc08-4fad05765fd2', 'ffa75e43-df39-415b-b293-45367b8e3386', 'cffc696f-c71b-406f-8cc9-6526d1ac1bda', 1500000, 'gcash', 'paid', '2026-06-30T05:25:13.735049+00:00', '2026-06-30T05:25:14.374+00:00', 150000, 1350000) ON CONFLICT DO NOTHING;

