-- ============================================================
-- Migration: Ensure public profile-photos bucket & event upload policies
-- Bucket: profile-photos (PUBLIC read, authenticated/admin upload)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  5242880, -- 5 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ];

DROP POLICY IF EXISTS "profile_photos_public_read" ON storage.objects;
CREATE POLICY "profile_photos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "profile_photos_auth_insert" ON storage.objects;
CREATE POLICY "profile_photos_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (
      (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text
      OR ((storage.foldername(name))[1] = 'events' AND public.is_admin())
    )
  );

DROP POLICY IF EXISTS "profile_photos_auth_update" ON storage.objects;
CREATE POLICY "profile_photos_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (
      (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text
      OR ((storage.foldername(name))[1] = 'events' AND public.is_admin())
    )
  );

DROP POLICY IF EXISTS "profile_photos_auth_delete" ON storage.objects;
CREATE POLICY "profile_photos_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (
      (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text
      OR ((storage.foldername(name))[1] = 'events' AND public.is_admin())
    )
  );
