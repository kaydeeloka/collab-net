-- ============================================================
--  MiMuse Supabase Schema
-- ============================================================

-- Drop existing objects (reverse dependency order)
DROP TABLE IF EXISTS outreach_messages      CASCADE;
DROP TABLE IF EXISTS influencers            CASCADE;
DROP TABLE IF EXISTS ems_reshipments         CASCADE;
DROP TABLE IF EXISTS ems_tracking           CASCADE;
DROP TABLE IF EXISTS monitoring             CASCADE;
DROP TABLE IF EXISTS confirmed_influencers  CASCADE;
DROP TABLE IF EXISTS monitoring_keywords    CASCADE;
DROP TABLE IF EXISTS beauty_news_archives   CASCADE;
DROP TABLE IF EXISTS email_recipients       CASCADE;
DROP TABLE IF EXISTS app_config             CASCADE;
DROP TABLE IF EXISTS phases                 CASCADE;
DROP TABLE IF EXISTS tiers                  CASCADE;
DROP FUNCTION IF EXISTS get_active_phase_id;

-- ============================================================
--  0. Phases
-- ============================================================
CREATE TABLE phases (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  name        TEXT        NOT NULL UNIQUE,   -- '1차', '2차', etc.
  is_active   BOOLEAN     DEFAULT false,
  started_at  DATE,
  ended_at    DATE
);

INSERT INTO phases (name, is_active, started_at) VALUES ('1차', true, CURRENT_DATE);

-- ============================================================
--  0a. Tiers
-- ============================================================
CREATE TABLE tiers (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  rank          TEXT    NOT NULL UNIQUE,   -- '1순위' ~ '5순위'
  label         TEXT    NOT NULL,          -- '마이크로 (10K~50K)'
  category      TEXT    NOT NULL,          -- 'K-뷰티' | '일반뷰티'
  tags          TEXT    NOT NULL,          -- 'kbeauty' | 'beauty'
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
--  8. App Config  ← moved up so the helper function can read it
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

-- Seed active_phase_id from the phase we just inserted
INSERT INTO app_config (key, value)
SELECT 'active_phase_id', to_jsonb(id::text) FROM phases WHERE name = '1차' LIMIT 1
ON CONFLICT (key) DO NOTHING;

-- ============================================================
--  Helper function: returns the current active phase UUID
--  (PostgreSQL allows function calls in DEFAULT, but not subqueries)
-- ============================================================
CREATE OR REPLACE FUNCTION get_active_phase_id()
RETURNS UUID AS $$
  SELECT (value #>> '{}')::uuid FROM app_config WHERE key = 'active_phase_id';
$$ LANGUAGE sql STABLE;

-- ============================================================
--  1. Influencers
-- ============================================================
CREATE TABLE influencers (
  id                UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at        TIMESTAMPTZ  DEFAULT now(),
  phase_id          UUID         NOT NULL DEFAULT get_active_phase_id() REFERENCES phases(id) ON DELETE CASCADE,
  tier_id           UUID         REFERENCES tiers(id) ON DELETE SET NULL,
  handle            TEXT         NOT NULL,
  display_name      TEXT,
  email             TEXT,
  platform          TEXT,
  followers         INTEGER      DEFAULT 0,
  following         INTEGER      DEFAULT 0,
  following_ratio   TEXT,
  total_likes       INTEGER      DEFAULT 0,
  video_count       INTEGER      DEFAULT 0,
  avg_views         INTEGER      DEFAULT 0,
  engagement_rate   NUMERIC(6,2) DEFAULT 0,
  profile_url       TEXT,
  outreach          TEXT         DEFAULT '',        -- '' | 'target' | 'yes' | 'reply' | 'negotiate' | 'accept' | 'reject'
  status            TEXT         DEFAULT '',
  contact_count     INTEGER      DEFAULT 0,
  last_contact_at   TIMESTAMPTZ,
  reply_count       INTEGER      DEFAULT 0,
  memo              TEXT         DEFAULT '',
  UNIQUE (phase_id, handle)
);

CREATE INDEX idx_influencers_phase    ON influencers(phase_id);
CREATE INDEX idx_influencers_tier     ON influencers(tier_id);
CREATE INDEX idx_influencers_outreach ON influencers(outreach);

-- ============================================================
--  1a. Outreach Messages
-- ============================================================
CREATE TABLE outreach_messages (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now(),
  influencer_id   UUID        NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  direction       TEXT        NOT NULL,  -- 'outbound' | 'inbound'
  subject         TEXT,
  body            TEXT        NOT NULL,
  sent_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_outreach_messages_influencer ON outreach_messages(influencer_id);
CREATE INDEX idx_outreach_messages_sent_at    ON outreach_messages(sent_at);

-- ============================================================
--  2. Confirmed Influencers
-- ============================================================
CREATE TABLE confirmed_influencers (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now(),
  phase_id        UUID        NOT NULL DEFAULT get_active_phase_id() REFERENCES phases(id) ON DELETE CASCADE,
  influencer_id   UUID        REFERENCES influencers(id) ON DELETE SET NULL,
  display_name    TEXT,
  handle          TEXT,
  email           TEXT,
  followers       INTEGER     DEFAULT 0,
  upload_status   TEXT        DEFAULT 'Pending',  -- 'Pending' | 'Yes' | 'No'
  upload_link     TEXT,
  repost          TEXT,
  phone           TEXT,
  content_type    TEXT,
  address_line_1  TEXT,
  address_line_2  TEXT,
  city            TEXT,
  state           TEXT,
  zip             TEXT,
  country         TEXT,
  UNIQUE (phase_id, email)
);

CREATE INDEX idx_confirmed_phase ON confirmed_influencers(phase_id);

-- ============================================================
--  3. EMS Tracking
-- ============================================================
CREATE TABLE ems_tracking (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT now(),
  confirmed_influencer_id UUID        NOT NULL REFERENCES confirmed_influencers(id) ON DELETE CASCADE,
  ems_number              TEXT,
  registered_date         TEXT,
  status                  TEXT        DEFAULT 'Preparing', -- 'Preparing' | 'In Transit' | 'Delivered' | 'Pending' | 'Exception'
  last_update             TEXT,
  email_sent              BOOLEAN     DEFAULT false
);

CREATE INDEX idx_ems_confirmed ON ems_tracking(confirmed_influencer_id);
CREATE INDEX idx_ems_status    ON ems_tracking(status);

CREATE TABLE ems_reshipments (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT now(),
  confirmed_influencer_id UUID        NOT NULL REFERENCES confirmed_influencers(id) ON DELETE CASCADE,
  original_tracking_id    UUID        REFERENCES ems_tracking(id) ON DELETE SET NULL,
  ems_number              TEXT,
  registered_date         TEXT,
  application_number      TEXT,
  carrier_status          TEXT        DEFAULT 'Preparing',
  last_update             TEXT,
  email_sent              BOOLEAN     DEFAULT false,
  error_reason            TEXT,
  status                  TEXT        DEFAULT '처리 대기',
  CONSTRAINT ems_reshipments_one_per_influencer UNIQUE (confirmed_influencer_id)
);

CREATE INDEX idx_ems_reshipments_confirmed ON ems_reshipments(confirmed_influencer_id);
CREATE INDEX idx_ems_reshipments_status    ON ems_reshipments(status);

-- ============================================================
--  4. Monitoring
-- ============================================================
CREATE TABLE monitoring (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT now(),
  confirmed_influencer_id UUID        NOT NULL REFERENCES confirmed_influencers(id) ON DELETE CASCADE,
  platform                TEXT,
  date                    DATE,
  media                   TEXT,       -- 'photo' | 'video'
  content                 TEXT,       -- 'review video' | 'unboxing' | 'other'
  brand                   TEXT,
  repost                  TEXT,
  review_link             TEXT,
  views                   INTEGER     DEFAULT 0,
  likes                   INTEGER     DEFAULT 0,
  comments                INTEGER     DEFAULT 0,
  keywords                TEXT,
  updated                 DATE
);

CREATE INDEX idx_monitoring_confirmed ON monitoring(confirmed_influencer_id);
CREATE INDEX idx_monitoring_brand     ON monitoring(brand);
CREATE INDEX idx_monitoring_date      ON monitoring(date);

-- ============================================================
--  5. Monitoring Keywords
-- ============================================================
CREATE TABLE monitoring_keywords (
  id       UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  brand    TEXT  UNIQUE NOT NULL,
  keywords TEXT[] DEFAULT '{}'
);

INSERT INTO monitoring_keywords (brand, keywords) VALUES
  ('mimuse',  ARRAY['mimuse',  '미뮤즈']),
  ('aesthen', ARRAY['aesthen', '에스텐']),
  ('joodoc',  ARRAY['joodoc',  '주독']),
  ('nesh',    ARRAY['nesh',    '네쉬']),
  ('varuza',  ARRAY['varuza',  '바루자'])
ON CONFLICT (brand) DO NOTHING;

-- ============================================================
--  6. Beauty News Archives
-- ============================================================
CREATE TABLE beauty_news_archives (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now(),
  windows_start DATE        NOT NULL,
  windows_end   DATE,
  report_title  TEXT,
  categories    JSONB       NOT NULL DEFAULT '[]',
  keywords      JSONB       DEFAULT '[]',
  UNIQUE (windows_start)
);

CREATE INDEX idx_archives_date ON beauty_news_archives(windows_start DESC);

-- ============================================================
--  7. Email Recipients
-- ============================================================
CREATE TABLE email_recipients (
  id    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name  TEXT,
  UNIQUE (email)
);

-- ============================================================
--  Row Level Security
-- ============================================================
ALTER TABLE phases                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ems_tracking          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ems_reshipments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring            ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_keywords   ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_news_archives  ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_recipients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config            ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['phases','tiers','influencers','outreach_messages','confirmed_influencers','ems_tracking','ems_reshipments','monitoring','monitoring_keywords','beauty_news_archives','email_recipients','app_config']
  LOOP
    EXECUTE format('CREATE POLICY "allow_all_%s" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
--  Trigger: auto-fill phase_id + tier_id on INSERT
--  (Supabase CSV importer sends explicit NULL which bypasses DEFAULT;
--   a BEFORE INSERT trigger intercepts it reliably)
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
