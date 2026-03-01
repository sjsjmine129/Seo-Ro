-- =============================================================================
-- Supabase Storage: book_images bucket for Shelve (책 꽂기)
-- Run this in Supabase SQL Editor after schema.sql
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
