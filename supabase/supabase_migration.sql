-- ============================================================
--  MiMuse Supabase Schema — fresh project bootstrap
--  Run once in Supabase SQL Editor on a new account.
-- ============================================================

-- Drop existing objects (reverse dependency order)
DROP TABLE IF EXISTS outreach_messages       CASCADE;
DROP TABLE IF EXISTS confirmed_brand_assets  CASCADE;
DROP TABLE IF EXISTS monitoring_assets       CASCADE;
DROP TABLE IF EXISTS monitoring              CASCADE;
DROP TABLE IF EXISTS influencer_platform     CASCADE;
DROP TABLE IF EXISTS ems_reshipments         CASCADE;
DROP TABLE IF EXISTS ems_tracking            CASCADE;
DROP TABLE IF EXISTS confirmed_influencers   CASCADE;
DROP TABLE IF EXISTS confirmed_brands        CASCADE;
DROP TABLE IF EXISTS brand_personal          CASCADE;
DROP TABLE IF EXISTS brand_general           CASCADE;
DROP TABLE IF EXISTS influencers             CASCADE;
DROP TABLE IF EXISTS email_templates         CASCADE;
DROP TABLE IF EXISTS monitoring_keywords     CASCADE;
DROP TABLE IF EXISTS beauty_news_archives    CASCADE;
DROP TABLE IF EXISTS email_recipients        CASCADE;
DROP TABLE IF EXISTS app_config              CASCADE;
DROP TABLE IF EXISTS tiers                   CASCADE;
DROP TABLE IF EXISTS phases                  CASCADE;
DROP FUNCTION IF EXISTS get_active_phase_id();
DROP FUNCTION IF EXISTS set_influencer_defaults() CASCADE;

-- ============================================================
--  Phases
-- ============================================================
CREATE TABLE phases (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at        TIMESTAMPTZ DEFAULT now(),
  name              TEXT        NOT NULL UNIQUE,
  is_active         BOOLEAN     DEFAULT false,
  started_at        DATE,
  ended_at          DATE,
  google_sheets_url TEXT,
  kit_send_date     DATE,
  project_concept   TEXT,
  collection_img    TEXT,
  archive_desc      TEXT,
  design_theme_img            TEXT,
  design_kit_box_img          TEXT,
  design_collection_card_img  TEXT,
  design_brochure_img         TEXT,
  design_archive_desc         TEXT
);

INSERT INTO phases (name, is_active, started_at) VALUES ('1차', true, CURRENT_DATE);

-- ============================================================
--  Tiers
-- ============================================================
CREATE TABLE tiers (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  rank          TEXT    NOT NULL UNIQUE,
  label         TEXT    NOT NULL,
  category      TEXT    NOT NULL,
  tags          TEXT    NOT NULL,
  min_followers INTEGER NOT NULL,
  max_followers INTEGER NOT NULL,
  sort_order    INTEGER DEFAULT 0
);

INSERT INTO tiers (rank, label, category, tags, min_followers, max_followers, sort_order) VALUES
  ('1순위', '마이크로 (10K~50K)',  'K-뷰티',   'kbeauty', 10000,  50000,  1),
  ('2순위', '마이크로 (10K~50K)',  '일반뷰티', 'beauty',  10000,  50000,  2),
  ('3순위', '나노 (3K~10K)',       'K-뷰티',   'kbeauty', 3000,   9999,   3),
  ('4순위', '나노 (3K~10K)',       '일반뷰티', 'beauty',  3000,   9999,   4),
  ('5순위', '마이크로 (60K~100K)', 'K-뷰티',   'kbeauty', 60000,  100000, 5);

-- ============================================================
--  App Config (before tables that DEFAULT to active phase)
-- ============================================================
CREATE TABLE app_config (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO app_config (key, value) VALUES
  ('kbeauty_keywords', '["glass skin","kbeauty","korean beauty","korean skincare","kbeauty review","kbeauty routine","korean skincare routine","kbeauty products","kbeauty addict","korean makeup","olive young","kbeauty skincare"]'::jsonb),
  ('beauty_keywords',  '["beauty review","skincare","makeup tips","beauty creator","beautytok","makeup haul","beauty hacks","beauty influencer"]'::jsonb),
  ('filter_conditions','[{"cat":"중복","desc":"1~5순위까지의 중복 계정 필터링","type":"dedup","enabled":true}]'::jsonb),
  ('search_filters',   '{"maxRatio":70,"maxUploadDays":30,"proxyCountry":"US","requireEmail":true,"dedupExisting":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value)
SELECT 'active_phase_id', to_jsonb(id::text) FROM phases WHERE name = '1차' LIMIT 1
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION get_active_phase_id()
RETURNS UUID AS $$
  SELECT (value #>> '{}')::uuid FROM app_config WHERE key = 'active_phase_id';
$$ LANGUAGE sql STABLE;

-- ============================================================
--  Email Templates (before outreach_messages FK)
-- ============================================================
CREATE TABLE email_templates (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  domain     TEXT        NOT NULL CHECK (domain IN ('influencer', 'brand', 'ems')),
  name       TEXT        NOT NULL,
  title      TEXT        NOT NULL DEFAULT '',
  body       TEXT        NOT NULL DEFAULT '',
  category   TEXT        NOT NULL DEFAULT '기타',
  sort_order INTEGER     NOT NULL DEFAULT 0,
  is_default BOOLEAN     NOT NULL DEFAULT false,
  is_active  BOOLEAN     NOT NULL DEFAULT true
);

-- ============================================================
--  Influencers
-- ============================================================
CREATE TABLE influencers (
  id                UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at        TIMESTAMPTZ  DEFAULT now(),
  phase_id          UUID         NOT NULL DEFAULT get_active_phase_id() REFERENCES phases(id) ON DELETE CASCADE,
  tier_id           UUID         REFERENCES tiers(id) ON DELETE SET NULL,
  handle            TEXT         NOT NULL,
  display_name      TEXT,
  email             TEXT,
  followers         INTEGER      DEFAULT 0,
  following         INTEGER      DEFAULT 0,
  following_ratio   TEXT,
  total_likes       INTEGER      DEFAULT 0,
  video_count       INTEGER      DEFAULT 0,
  engagement_rate   NUMERIC      DEFAULT 0,
  profile_url       TEXT,
  status            TEXT         DEFAULT '',
  platform          TEXT         DEFAULT 'TikTok',
  last_contact_at   TIMESTAMPTZ,
  reply_count       INTEGER      DEFAULT 0,
  progress_stage    TEXT         DEFAULT '',
  progress_count    INTEGER,
  memo              TEXT         DEFAULT '',
  contact_count     INTEGER,
  source_phase_id   UUID         REFERENCES phases(id) ON DELETE SET NULL,
  last_reply_at     TIMESTAMPTZ,
  avatar_url        TEXT,
  contacted         BOOLEAN      NOT NULL DEFAULT false,
  UNIQUE (phase_id, handle)
);

CREATE INDEX idx_influencers_phase      ON influencers(phase_id);
CREATE INDEX idx_influencers_tier       ON influencers(tier_id);
CREATE INDEX idx_influencers_source_phase ON influencers(source_phase_id);
CREATE INDEX idx_influencers_last_reply ON influencers(last_reply_at DESC NULLS LAST);
CREATE INDEX idx_influencers_contacted  ON influencers(phase_id, contacted) WHERE contacted = true;

-- ============================================================
--  Outreach Messages
-- ============================================================
CREATE TABLE outreach_messages (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at          TIMESTAMPTZ DEFAULT now(),
  influencer_id       UUID        NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  direction           TEXT        NOT NULL,
  subject             TEXT,
  body                TEXT        NOT NULL,
  sent_at             TIMESTAMPTZ DEFAULT now(),
  template_name       TEXT,
  template_id         UUID        REFERENCES email_templates(id) ON DELETE SET NULL,
  outlook_message_id  TEXT
);

CREATE INDEX idx_outreach_messages_influencer ON outreach_messages(influencer_id);
CREATE INDEX idx_outreach_messages_sent_at    ON outreach_messages(sent_at);

-- ============================================================
--  Confirmed Influencers
-- ============================================================
CREATE TABLE confirmed_influencers (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now(),
  phase_id        UUID        NOT NULL DEFAULT get_active_phase_id() REFERENCES phases(id) ON DELETE CASCADE,
  influencer_id   UUID        UNIQUE REFERENCES influencers(id) ON DELETE SET NULL,
  upload_status   TEXT        DEFAULT 'Pending',
  repost          TEXT,
  phone           TEXT,
  address_line_1  TEXT,
  address_line_2  TEXT,
  city            TEXT,
  state           TEXT,
  zip             TEXT,
  country         TEXT,
  email           TEXT,
  review_link     TEXT,
  notes           TEXT,
  form_submitted  BOOLEAN     DEFAULT false,
  platform        TEXT        DEFAULT 'TikTok',
  seq             INTEGER,
  UNIQUE (phase_id, email)
);

CREATE INDEX idx_confirmed_phase ON confirmed_influencers(phase_id);

-- ============================================================
--  Influencer Platform
-- ============================================================
CREATE TABLE influencer_platform (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT now(),
  confirmed_influencer_id UUID        NOT NULL REFERENCES confirmed_influencers(id) ON DELETE CASCADE,
  platform                TEXT        NOT NULL,
  handle                  TEXT,
  followers               INTEGER     DEFAULT 0,
  profile_url             TEXT
);

CREATE INDEX idx_influencer_platform_confirmed ON influencer_platform(confirmed_influencer_id);
CREATE INDEX idx_influencer_platform_handle    ON influencer_platform(handle);

-- ============================================================
--  EMS Tracking
-- ============================================================
CREATE TABLE ems_tracking (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT now(),
  confirmed_influencer_id UUID        NOT NULL REFERENCES confirmed_influencers(id) ON DELETE CASCADE,
  ems_number              TEXT,
  registered_date         DATE,
  status                  TEXT        DEFAULT 'Preparing',
  last_update             TEXT,
  email_sent              BOOLEAN     DEFAULT false,
  application_number      TEXT,
  notes                   TEXT,
  reship                  TEXT,
  phase_id                UUID        REFERENCES phases(id) ON DELETE SET NULL,
  registered_17track      TEXT
);

CREATE INDEX idx_ems_confirmed ON ems_tracking(confirmed_influencer_id);
CREATE INDEX idx_ems_status    ON ems_tracking(status);
CREATE INDEX idx_ems_phase     ON ems_tracking(phase_id);

CREATE TABLE ems_reshipments (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT now(),
  confirmed_influencer_id UUID        NOT NULL UNIQUE REFERENCES confirmed_influencers(id) ON DELETE CASCADE,
  original_tracking_id    UUID        REFERENCES ems_tracking(id) ON DELETE SET NULL,
  ems_number              TEXT,
  registered_date         DATE,
  application_number      TEXT,
  carrier_status          TEXT        DEFAULT 'Preparing',
  last_update             TEXT,
  email_sent              BOOLEAN     DEFAULT false,
  error_reason            TEXT,
  status                  TEXT        DEFAULT '처리 대기',
  phase_id                UUID        REFERENCES phases(id) ON DELETE SET NULL
);

CREATE INDEX idx_ems_reshipments_confirmed ON ems_reshipments(confirmed_influencer_id);
CREATE INDEX idx_ems_reshipments_status    ON ems_reshipments(status);
CREATE INDEX idx_ems_reshipments_phase     ON ems_reshipments(phase_id);

-- ============================================================
--  Monitoring
-- ============================================================
CREATE TABLE monitoring (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT now(),
  influencer_platform_id  UUID        NOT NULL REFERENCES influencer_platform(id) ON DELETE CASCADE,
  date                    DATE,
  media                   TEXT,
  content                 TEXT,
  brand                   TEXT,
  review_link             TEXT,
  views                   INTEGER     DEFAULT 0,
  likes                   INTEGER     DEFAULT 0,
  comments                INTEGER     DEFAULT 0,
  keywords                TEXT,
  updated                 DATE,
  phase_id                UUID        REFERENCES phases(id) ON DELETE CASCADE
);

CREATE INDEX idx_monitoring_platform ON monitoring(influencer_platform_id);
CREATE INDEX idx_monitoring_brand    ON monitoring(brand);
CREATE INDEX idx_monitoring_date     ON monitoring(date);
CREATE INDEX idx_monitoring_phase    ON monitoring(phase_id);

CREATE TABLE monitoring_assets (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  monitoring_id        UUID        NOT NULL UNIQUE REFERENCES monitoring(id) ON DELETE CASCADE,
  thumbnail_source_url TEXT,
  thumbnail_path       TEXT,
  video_path           TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_monitoring_assets_monitoring ON monitoring_assets(monitoring_id);

-- ============================================================
--  Monitoring Keywords
-- ============================================================
CREATE TABLE monitoring_keywords (
  id       UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  phase_id UUID  REFERENCES phases(id) ON DELETE CASCADE,
  brand    TEXT  NOT NULL,
  keywords TEXT[] DEFAULT '{}'
);

CREATE UNIQUE INDEX uk_monitoring_keywords_mimuse
  ON monitoring_keywords (brand) WHERE phase_id IS NULL AND brand = 'mimuse';

CREATE UNIQUE INDEX uk_monitoring_keywords_phase_brand
  ON monitoring_keywords (phase_id, brand) WHERE phase_id IS NOT NULL;

CREATE INDEX idx_monitoring_keywords_phase ON monitoring_keywords(phase_id);

-- MiMuse keywords are global (phase_id NULL). Per-brand keywords are seeded per phase from confirmed_brands in the app.
INSERT INTO monitoring_keywords (brand, phase_id, keywords) VALUES
  ('mimuse', NULL, ARRAY['mimuse', '미뮤즈']);

-- ============================================================
--  Beauty News Archives
-- ============================================================
CREATE TABLE beauty_news_archives (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now(),
  windows_start DATE        NOT NULL UNIQUE,
  windows_end   DATE,
  categories    JSONB       NOT NULL DEFAULT '[]',
  keywords      JSONB       DEFAULT '[]',
  report_title  TEXT
);

CREATE INDEX idx_archives_date ON beauty_news_archives(windows_start DESC);

-- ============================================================
--  Email Recipients
-- ============================================================
CREATE TABLE email_recipients (
  id       UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  email    TEXT    NOT NULL UNIQUE,
  name     TEXT,
  selected BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
--  Brand Contacts
-- ============================================================
CREATE TABLE brand_general (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  company          TEXT,
  email            TEXT[],
  brand_name       TEXT,
  website          TEXT,
  product_category TEXT,
  overseas         BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now(),
  contacted        BOOLEAN     NOT NULL DEFAULT false,
  status           TEXT        NOT NULL DEFAULT '',
  send_count       INTEGER     NOT NULL DEFAULT 0,
  notes            TEXT,
  reply_count      INTEGER,
  telephone        TEXT,
  phase_id         UUID        NOT NULL DEFAULT get_active_phase_id() REFERENCES phases(id) ON DELETE CASCADE,
  last_reply_at    TIMESTAMPTZ,
  source_phase_id  UUID        REFERENCES phases(id) ON DELETE SET NULL,
  last_contact_at  TIMESTAMPTZ
);

CREATE INDEX idx_brand_general_phase        ON brand_general(phase_id);
CREATE INDEX idx_brand_general_source_phase ON brand_general(source_phase_id);

CREATE TABLE brand_personal (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  company          TEXT,
  contact_name     TEXT,
  department       TEXT,
  position         TEXT,
  personal_email   TEXT[],
  personal_phone   TEXT,
  website          TEXT,
  rep_email        TEXT,
  telephone        TEXT,
  product_category TEXT,
  overseas         BOOLEAN     NOT NULL DEFAULT false,
  contacted        BOOLEAN     NOT NULL DEFAULT false,
  status           TEXT        NOT NULL DEFAULT '',
  send_count       INTEGER     NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  reply_count      INTEGER,
  phase_id         UUID        NOT NULL DEFAULT get_active_phase_id() REFERENCES phases(id) ON DELETE CASCADE,
  brand_name       TEXT,
  last_reply_at    TIMESTAMPTZ,
  source_phase_id  UUID        REFERENCES phases(id) ON DELETE SET NULL,
  last_contact_at  TIMESTAMPTZ
);

CREATE INDEX idx_brand_personal_phase        ON brand_personal(phase_id);
CREATE INDEX idx_brand_personal_source_phase ON brand_personal(source_phase_id);

-- ============================================================
--  Confirmed Brands + Assets
-- ============================================================
CREATE TABLE confirmed_brands (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  phase_id         UUID        REFERENCES phases(id) ON DELETE CASCADE,
  brand_name       TEXT        NOT NULL,
  contact_name     TEXT,
  position         TEXT,
  email            TEXT,
  phone            TEXT,
  website          TEXT,
  product          TEXT,
  production_cost  TEXT,
  received         BOOLEAN     NOT NULL DEFAULT false,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  archive_memo     TEXT,
  archive_desc     TEXT,
  product_en       TEXT
);

CREATE INDEX idx_confirmed_brands_phase ON confirmed_brands(phase_id);

CREATE TABLE confirmed_brand_assets (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  confirmed_brand_id UUID        NOT NULL REFERENCES confirmed_brands(id) ON DELETE CASCADE,
  category           TEXT        NOT NULL CHECK (category IN (
    'logo', 'product_main', 'product_sub', 'cutout', 'ingredients', 'product_cover'
  )),
  file_name          TEXT        NOT NULL,
  storage_path       TEXT        NOT NULL UNIQUE,
  file_size          INTEGER,
  mime_type          TEXT,
  label              TEXT,
  sort_order         INTEGER     DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_confirmed_brand_assets_brand_cat
  ON confirmed_brand_assets(confirmed_brand_id, category);

-- ============================================================
--  Storage Buckets
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('email-assets',          'email-assets',          true,  5242880),
  ('brand-archive',         'brand-archive',         false, 52428800),
  ('monitoring-thumbnails', 'monitoring-thumbnails', true,  5242880),
  ('monitoring-videos',     'monitoring-videos',     false, 104857600)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "email_assets_all" ON storage.objects;
CREATE POLICY "email_assets_all" ON storage.objects
  FOR ALL USING (bucket_id = 'email-assets') WITH CHECK (bucket_id = 'email-assets');

DROP POLICY IF EXISTS "brand_archive_storage_all" ON storage.objects;
CREATE POLICY "brand_archive_storage_all" ON storage.objects
  FOR ALL USING (bucket_id = 'brand-archive') WITH CHECK (bucket_id = 'brand-archive');

DROP POLICY IF EXISTS "monitoring_thumbnails_storage_all" ON storage.objects;
CREATE POLICY "monitoring_thumbnails_storage_all" ON storage.objects
  FOR ALL USING (bucket_id = 'monitoring-thumbnails') WITH CHECK (bucket_id = 'monitoring-thumbnails');

DROP POLICY IF EXISTS "monitoring_videos_storage_all" ON storage.objects;
CREATE POLICY "monitoring_videos_storage_all" ON storage.objects
  FOR ALL USING (bucket_id = 'monitoring-videos') WITH CHECK (bucket_id = 'monitoring-videos');

-- ============================================================
--  Row Level Security
-- ============================================================
ALTER TABLE phases                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_platform   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ems_tracking          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ems_reshipments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring            ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_assets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_keywords   ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_news_archives  ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_recipients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_general         ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_personal        ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_brands      ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_brand_assets ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'phases','tiers','app_config','email_templates','influencers','outreach_messages',
    'confirmed_influencers','influencer_platform','ems_tracking','ems_reshipments',
    'monitoring','monitoring_assets','monitoring_keywords','beauty_news_archives',
    'email_recipients','brand_general','brand_personal','confirmed_brands','confirmed_brand_assets'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "allow_all_%s" ON %I;
       CREATE POLICY "allow_all_%s" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================
--  Trigger: influencer defaults on INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION set_influencer_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phase_id IS NULL THEN
    NEW.phase_id := get_active_phase_id();
  END IF;

  IF NEW.tier_id IS NULL AND NEW.followers IS NOT NULL THEN
    SELECT id INTO NEW.tier_id
    FROM tiers
    WHERE NEW.followers BETWEEN min_followers AND max_followers
    ORDER BY sort_order
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_influencer_defaults
BEFORE INSERT ON influencers
FOR EACH ROW EXECUTE FUNCTION set_influencer_defaults();

-- dedupe_confirmed_phase — see dedupe_confirmed_phase.sql (same definition)
CREATE OR REPLACE FUNCTION public.dedupe_confirmed_phase(p_phase_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed_removed INT := 0;
  v_platforms_removed INT := 0;
  v_seq_renumbered    BOOLEAN := false;
  v_seq_updates       INT := 0;
BEGIN
  IF p_phase_id IS NULL THEN
    RETURN jsonb_build_object(
      'confirmed_removed', 0,
      'platforms_removed', 0,
      'seq_renumbered', false
    );
  END IF;

  WITH enriched AS (
    SELECT
      ci.id,
      ci.influencer_id,
      ci.seq,
      COALESCE(
        NULLIF(lower(trim(regexp_replace(coalesce(i.handle, ''), '^@', ''))), ''),
        (
          SELECT NULLIF(lower(trim(regexp_replace(coalesce(ip.handle, ''), '^@', ''))), '')
          FROM influencer_platform ip
          WHERE ip.confirmed_influencer_id = ci.id
          ORDER BY ip.followers DESC NULLS LAST, ip.id
          LIMIT 1
        )
      ) AS norm_handle,
      lower(trim(coalesce(ci.email, ''))) AS norm_email,
      (
        (CASE WHEN ci.influencer_id IS NOT NULL THEN 100 ELSE 0 END)
        + (CASE WHEN ci.form_submitted THEN 50 ELSE 0 END)
        + (CASE WHEN ci.phone IS NOT NULL AND ci.phone <> '' THEN 10 ELSE 0 END)
        + (CASE WHEN ci.email IS NOT NULL AND ci.email <> '' THEN 5 ELSE 0 END)
        + (CASE WHEN EXISTS (
            SELECT 1 FROM influencer_platform ip WHERE ip.confirmed_influencer_id = ci.id
          ) THEN 3 ELSE 0 END)
        + (CASE WHEN ci.seq IS NOT NULL THEN 1 ELSE 0 END)
      ) AS score
    FROM confirmed_influencers ci
    LEFT JOIN influencers i ON i.id = ci.influencer_id
    WHERE ci.phase_id = p_phase_id
  ),
  keyed AS (
    SELECT *,
      COALESCE(
        NULLIF(norm_handle, ''),
        CASE
          WHEN norm_email <> '' THEN '__email__:' || norm_email
          ELSE '__id__:' || id::text
        END
      ) AS dup_key
    FROM enriched
  ),
  keepers AS (
    SELECT DISTINCT ON (dup_key)
      dup_key,
      id AS keeper_id
    FROM keyed
    ORDER BY dup_key, score DESC, COALESCE(seq, 999999) ASC, id
  ),
  dups AS (
    SELECT k.id AS dup_id, k.influencer_id AS dup_influencer_id, ke.keeper_id
    FROM keyed k
    JOIN keepers ke ON ke.dup_key = k.dup_key
    WHERE k.id <> ke.keeper_id
  ),
  _merge AS (
    UPDATE confirmed_influencers ci
    SET influencer_id = d.dup_influencer_id
    FROM dups d
    WHERE ci.id = d.keeper_id
      AND d.dup_influencer_id IS NOT NULL
      AND ci.influencer_id IS NULL
    RETURNING ci.id
  ),
  _deleted AS (
    DELETE FROM confirmed_influencers ci
    USING dups d
    WHERE ci.id = d.dup_id
    RETURNING ci.id
  )
  SELECT COUNT(*)::INT INTO v_confirmed_removed FROM _deleted;

  WITH ranked AS (
    SELECT ip.id,
      ROW_NUMBER() OVER (
        PARTITION BY
          ip.confirmed_influencer_id,
          lower(trim(coalesce(ip.platform, ''))),
          lower(trim(regexp_replace(coalesce(ip.handle, ''), '^@', '')))
        ORDER BY ip.followers DESC NULLS LAST, ip.id
      ) AS rn
    FROM influencer_platform ip
    JOIN confirmed_influencers ci ON ci.id = ip.confirmed_influencer_id
    WHERE ci.phase_id = p_phase_id
  )
  DELETE FROM influencer_platform ip
  USING ranked r
  WHERE ip.id = r.id
    AND r.rn > 1;

  GET DIAGNOSTICS v_platforms_removed = ROW_COUNT;

  WITH ordered AS (
    SELECT
      ci.id,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(ci.seq, 999999) ASC, ci.created_at ASC, ci.id
      )::INT AS new_seq
    FROM confirmed_influencers ci
    WHERE ci.phase_id = p_phase_id
  )
  UPDATE confirmed_influencers ci
  SET seq = o.new_seq
  FROM ordered o
  WHERE ci.id = o.id
    AND ci.seq IS DISTINCT FROM o.new_seq;

  GET DIAGNOSTICS v_seq_updates = ROW_COUNT;
  v_seq_renumbered := v_seq_updates > 0;

  RETURN jsonb_build_object(
    'confirmed_removed', v_confirmed_removed,
    'platforms_removed', v_platforms_removed,
    'seq_renumbered', v_seq_renumbered
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dedupe_confirmed_phase(UUID) TO anon, authenticated;
