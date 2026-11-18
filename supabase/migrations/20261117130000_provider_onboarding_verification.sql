-- Provider onboarding base coordinates, professional ID bucket & RLS,
-- and guard_provider_columns update allowing provider submission to 'pending'.

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS base_lat double precision,
  ADD COLUMN IF NOT EXISTS base_lng double precision;

COMMENT ON COLUMN public.providers.base_lat IS 'Latitude of provider dispatch base pinned during onboarding.';
COMMENT ON COLUMN public.providers.base_lng IS 'Longitude of provider dispatch base pinned during onboarding.';

-- Ensure the provider-docs bucket exists for PRC/Government ID verification uploads.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'provider-docs',
  'provider-docs',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "provider_docs_insert_own" ON storage.objects;
CREATE POLICY "provider_docs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'provider-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "provider_docs_select_own_or_admin" ON storage.objects;
CREATE POLICY "provider_docs_select_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'provider-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "provider_docs_delete_own_or_admin" ON storage.objects;
CREATE POLICY "provider_docs_delete_own_or_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'provider-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

-- Allow a provider to transition professional_id_status to 'pending' ONLY when
-- attaching uploaded document paths; admins retain full authority to set
-- 'verified', 'rejected', is_approved, rating, and trust_score.
CREATE OR REPLACE FUNCTION public.guard_provider_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor uuid := auth.uid();
  is_staff boolean;
  has_uploaded_docs boolean;
BEGIN
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.is_admin() INTO is_staff;
  IF is_staff THEN
    RETURN NEW;
  END IF;

  NEW.is_approved := COALESCE(OLD.is_approved, NEW.is_approved);
  NEW.rating := COALESCE(OLD.rating, NEW.rating);
  NEW.trust_score := COALESCE(OLD.trust_score, NEW.trust_score);

  has_uploaded_docs := COALESCE(array_length(NEW.professional_id_paths, 1), 0) > 0
    OR NULLIF(trim(COALESCE(NEW.professional_id_path, '')), '') IS NOT NULL;

  IF NEW.professional_id_status = 'pending' AND has_uploaded_docs THEN
    NEW.professional_id_status := 'pending';
  ELSE
    NEW.professional_id_status := COALESCE(OLD.professional_id_status, NEW.professional_id_status);
  END IF;

  RETURN NEW;
END;
$$;
