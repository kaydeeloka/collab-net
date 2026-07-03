-- Monitoring review assets — run once in Supabase SQL Editor
-- Thumbnails: cover image per post (~5 MB)
-- Photos:     slideshow images per post (~5 MB each)
-- Videos:     video files (~100 MB)

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('monitoring-thumbnails', 'monitoring-thumbnails', true,  5242880),
  ('monitoring-photos',     'monitoring-photos',     true,  5242880),
  ('monitoring-videos',     'monitoring-videos',     true, 104857600)
ON CONFLICT (id) DO UPDATE SET
  public          = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "monitoring_thumbnails_storage_all" ON storage.objects;
CREATE POLICY "monitoring_thumbnails_storage_all" ON storage.objects
  FOR ALL USING (bucket_id = 'monitoring-thumbnails')
  WITH CHECK (bucket_id = 'monitoring-thumbnails');

DROP POLICY IF EXISTS "monitoring_photos_storage_all" ON storage.objects;
CREATE POLICY "monitoring_photos_storage_all" ON storage.objects
  FOR ALL USING (bucket_id = 'monitoring-photos')
  WITH CHECK (bucket_id = 'monitoring-photos');

DROP POLICY IF EXISTS "monitoring_videos_storage_all" ON storage.objects;
CREATE POLICY "monitoring_videos_storage_all" ON storage.objects
  FOR ALL USING (bucket_id = 'monitoring-videos')
  WITH CHECK (bucket_id = 'monitoring-videos');
