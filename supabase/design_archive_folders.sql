-- Design archive — user-created folders + images per phase (brand-archive bucket)
-- Run in Supabase SQL Editor if tables are missing.

CREATE TABLE IF NOT EXISTS design_archive_folders (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  phase_id    UUID        NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  sort_order  INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_archive_folders_phase
  ON design_archive_folders(phase_id);

CREATE TABLE IF NOT EXISTS design_archive_files (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id     UUID        NOT NULL REFERENCES design_archive_folders(id) ON DELETE CASCADE,
  file_name     TEXT        NOT NULL,
  storage_path  TEXT        NOT NULL UNIQUE,
  file_size     INTEGER,
  mime_type     TEXT,
  sort_order    INTEGER     DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_archive_files_folder
  ON design_archive_files(folder_id);

ALTER TABLE design_archive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_archive_files   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_design_archive_folders" ON design_archive_folders;
CREATE POLICY "allow_all_design_archive_folders" ON design_archive_folders
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_design_archive_files" ON design_archive_files;
CREATE POLICY "allow_all_design_archive_files" ON design_archive_files
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
