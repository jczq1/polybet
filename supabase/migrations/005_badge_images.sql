-- =============================================
-- ADD IMAGE SUPPORT TO BADGES
-- =============================================

-- Add image_url column to badges (optional - if set, use image instead of emoji icon)
ALTER TABLE badges ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;

-- Create storage bucket for badge images (run this in Supabase dashboard if not using CLI)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('badges', 'badges', true);

-- Note: You'll need to create the 'badges' storage bucket in Supabase Dashboard:
-- 1. Go to Storage
-- 2. Create new bucket named 'badges'
-- 3. Make it public
-- 4. Add policy: Allow public read access
-- 5. Add policy: Allow authenticated users with admin role to upload

-- RLS policy for storage (if using SQL to manage):
-- CREATE POLICY "Public read access for badge images"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'badges');

-- CREATE POLICY "Admin upload access for badge images"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'badges' AND
--     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
--   );

-- CREATE POLICY "Admin update access for badge images"
--   ON storage.objects FOR UPDATE
--   USING (
--     bucket_id = 'badges' AND
--     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
--   );

-- CREATE POLICY "Admin delete access for badge images"
--   ON storage.objects FOR DELETE
--   USING (
--     bucket_id = 'badges' AND
--     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
--   );
