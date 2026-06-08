-- ============================================================
--  MiMuse Supabase Schema
-- ============================================================

-- Drop existing tables (reverse dependency order)
DROP TABLE IF EXISTS outreach_messages      CASCADE;
DROP TABLE IF EXISTS influencers            CASCADE;
DROP TABLE IF EXISTS confirmed_influencers  CASCADE;
DROP TABLE IF EXISTS ems_tracking           CASCADE;
DROP TABLE IF EXISTS monitoring             CASCADE;
DROP TABLE IF EXISTS monitoring_keywords    CASCADE;
DROP TABLE IF EXISTS beauty_news_archives   CASCADE;
DROP TABLE IF EXISTS email_recipients       CASCADE;
DROP TABLE IF EXISTS app_config             CASCADE;

-- 1. Influencers (replaces K-뷰티 / 일반뷰티 tier sheets)
CREATE TABLE IF NOT EXISTS influencers (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at        TIMESTAMPTZ DEFAULT now(),
  rank              TEXT        NOT NULL,          -- '1순위' ~ '5순위'
  category          TEXT        NOT NULL,          -- 'K-뷰티' | '일반뷰티'
  handle            TEXT        NOT NULL UNIQUE,
  display_name      TEXT,
  email             TEXT,
  followers         INTEGER     DEFAULT 0,
  following         INTEGER     DEFAULT 0,
  following_ratio   TEXT,
  total_likes       INTEGER     DEFAULT 0,
  video_count       INTEGER     DEFAULT 0,
  avg_views         INTEGER     DEFAULT 0,
  engagement_rate   NUMERIC(6,2) DEFAULT 0,
  profile_url       TEXT,
  outreach          TEXT        DEFAULT ''         -- '' | 'target' | 'yes' | 'reply' | 'negotiate' | 'accept' | 'reject'
);

CREATE INDEX IF NOT EXISTS idx_influencers_rank      ON influencers(rank);
CREATE INDEX IF NOT EXISTS idx_influencers_outreach  ON influencers(outreach);
CREATE INDEX IF NOT EXISTS idx_influencers_category  ON influencers(category);

-- 1a. Outreach Messages (email thread per influencer)
CREATE TABLE IF NOT EXISTS outreach_messages (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now(),
  influencer_id   UUID        NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  direction       TEXT        NOT NULL,  -- 'outbound' | 'inbound'
  subject         TEXT,
  body            TEXT        NOT NULL,
  sent_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_messages_influencer ON outreach_messages(influencer_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_sent_at    ON outreach_messages(sent_at);

-- 2. Confirmed Influencers (replaces 확정인플루언서 sheet)
CREATE TABLE IF NOT EXISTS confirmed_influencers (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now(),
  influencer_id   UUID        REFERENCES influencers(id) ON DELETE SET NULL,
  display_name    TEXT,
  handle          TEXT,
  email           TEXT        UNIQUE,
  followers       INTEGER     DEFAULT 0,
  upload_status   TEXT        DEFAULT 'Pending',  -- 'Pending' | 'Yes' | 'No'
  upload_link     TEXT,
  full_address    TEXT
);

-- 3. EMS Tracking (replaces 배송추적 sheet)
CREATE TABLE IF NOT EXISTS ems_tracking (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT now(),
  confirmed_influencer_id UUID        NOT NULL REFERENCES confirmed_influencers(id) ON DELETE CASCADE,
  ems_number              TEXT,
  us_arrival              TEXT,
  registered_date         TEXT,
  status                  TEXT        DEFAULT 'Preparing', -- 'Preparing' | 'In Transit' | 'Delivered' | 'Pending' | 'Exception'
  last_update             TEXT,
  email_sent              BOOLEAN     DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_ems_confirmed    ON ems_tracking(confirmed_influencer_id);
CREATE INDEX IF NOT EXISTS idx_ems_status       ON ems_tracking(status);

-- 4. Monitoring (replaces 모니터링 sheet)
CREATE TABLE IF NOT EXISTS monitoring (
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

CREATE INDEX IF NOT EXISTS idx_monitoring_confirmed ON monitoring(confirmed_influencer_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_brand     ON monitoring(brand);
CREATE INDEX IF NOT EXISTS idx_monitoring_date      ON monitoring(date);

-- 5. Monitoring Keywords config
CREATE TABLE IF NOT EXISTS monitoring_keywords (
  id       UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  brand    TEXT  UNIQUE NOT NULL,
  keywords TEXT[] DEFAULT '{}'
);

-- Seed default brands
INSERT INTO monitoring_keywords (brand, keywords) VALUES
  ('mimuse',   ARRAY['mimuse', '미뮤즈']),
  ('aesthen',  ARRAY['aesthen', '에스텐']),
  ('joodoc',   ARRAY['joodoc', '주독']),
  ('nesh',     ARRAY['nesh', '네쉬']),
  ('varuza',   ARRAY['varuza', '바루자'])
ON CONFLICT (brand) DO NOTHING;

-- 6. Beauty News Archives (replaces GAS archive storage)
CREATE TABLE IF NOT EXISTS beauty_news_archives (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  date_key   TEXT        UNIQUE NOT NULL,         -- 'YYYY-MM-DD'
  data       JSONB       NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_archives_date_key ON beauty_news_archives(date_key DESC);

-- 7. Email Recipients (trend email distribution list)
CREATE TABLE IF NOT EXISTS email_recipients (
  id         UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT  UNIQUE NOT NULL,
  name       TEXT
);

-- 8. App Config (replaces localStorage for shared team settings)
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default config
INSERT INTO app_config (key, value) VALUES
  ('tiers', '[
    {"rank":"1순위","label":"마이크로 (10K~50K)","minF":10000,"maxF":50000,"tags":"kbeauty","category":"K-뷰티"},
    {"rank":"2순위","label":"마이크로 (10K~50K)","minF":10000,"maxF":50000,"tags":"beauty","category":"일반뷰티"},
    {"rank":"3순위","label":"나노 (3K~10K)","minF":3000,"maxF":9999,"tags":"kbeauty","category":"K-뷰티"},
    {"rank":"4순위","label":"나노 (3K~10K)","minF":3000,"maxF":9999,"tags":"beauty","category":"일반뷰티"},
    {"rank":"5순위","label":"마이크로 (60K~100K)","minF":60000,"maxF":100000,"tags":"kbeauty","category":"K-뷰티"}
  ]'::jsonb),
  ('kbeauty_keywords', '["glass skin","kbeauty","korean beauty","korean skincare","kbeauty review","kbeauty routine","korean skincare routine","kbeauty products","kbeauty addict","korean makeup","olive young","kbeauty skincare"]'::jsonb),
  ('beauty_keywords',  '["beauty review","skincare","makeup tips","beauty creator","beautytok","makeup haul","beauty hacks","beauty influencer"]'::jsonb),
  ('filter_conditions','[{"cat":"중복","desc":"1~5순위까지의 중복 계정 필터링"},{"cat":"영상 퀄리티","desc":"영상 콘텐츠 퀄리티 기준 수기 검토 예정"}]'::jsonb),
  ('search_filters',   '{"maxRatio":70,"maxUploadDays":30,"proxyCountry":"US"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
--  Row Level Security — enable but allow all for anon key
--  (tighten later when auth is added)
-- ============================================================
ALTER TABLE influencers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_influencers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ems_tracking           ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring             ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_keywords    ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_news_archives   ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_recipients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config             ENABLE ROW LEVEL SECURITY;

-- Full access policies (replace with auth-based policies later)
DO $$ DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['influencers','outreach_messages','confirmed_influencers','ems_tracking','monitoring','monitoring_keywords','beauty_news_archives','email_recipients','app_config']
  LOOP
    EXECUTE format('CREATE POLICY "allow_all_%s" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;
