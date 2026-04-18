-- =============================================================================
-- Supabase Storage: book_images bucket for Shelve (책 꽂기)
-- Run this in Supabase SQL Editor after schema.sql.
-- Incremental migration 20250223220000_add_avatars_bucket.sql is merged here.
-- =============================================================================

-- Create bucket (skip if already exists via Dashboard)
INSERT INTO storage.buckets (id, name, public)
VALUES ('book_images', 'book_images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies (drop first if re-running: DROP POLICY IF EXISTS "book_images_insert" ON storage.objects; etc.)
CREATE POLICY "book_images_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'book_images');

-- Allow public read (book covers are public)
CREATE POLICY "book_images_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'book_images');

-- =============================================================================
-- Avatars bucket for user profile images
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Users can upload their own avatar (path: {user_id}/avatar.*)
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Public read for avatars
CREATE POLICY "avatars_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Users can update/delete their own avatar
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
