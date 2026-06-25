-- monitoring_assets — run once in Supabase SQL Editor (or use supabase_alter.sql tail)

CREATE TABLE IF NOT EXISTS monitoring_assets (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  monitoring_id        UUID        NOT NULL UNIQUE REFERENCES monitoring(id) ON DELETE CASCADE,
  thumbnail_source_url TEXT,       -- Apify CDN at scrape (expires)
  thumbnail_path       TEXT,       -- monitoring-thumbnails bucket path
  video_path           TEXT,       -- monitoring-videos bucket path
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_assets_monitoring ON monitoring_assets(monitoring_id);

ALTER TABLE monitoring_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_monitoring_assets" ON monitoring_assets;
CREATE POLICY "allow_all_monitoring_assets" ON monitoring_assets
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- migrate from monitoring.thumbnail_url / video_file_url if present
INSERT INTO monitoring_assets (monitoring_id, thumbnail_source_url, video_path)
SELECT m.id, m.thumbnail_url, m.video_file_url
FROM monitoring m
WHERE (m.thumbnail_url IS NOT NULL OR m.video_file_url IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM monitoring_assets a WHERE a.monitoring_id = m.id)
ON CONFLICT (monitoring_id) DO UPDATE SET
  thumbnail_source_url = COALESCE(EXCLUDED.thumbnail_source_url, monitoring_assets.thumbnail_source_url),
  video_path           = COALESCE(EXCLUDED.video_path, monitoring_assets.video_path),
  updated_at           = now();

ALTER TABLE monitoring DROP COLUMN IF EXISTS thumbnail_url;
ALTER TABLE monitoring DROP COLUMN IF EXISTS video_file_url;
