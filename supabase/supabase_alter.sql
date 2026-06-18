-- ============================================================
--  MiMuse — Schema Alterations
--  Run individual blocks here to modify tables safely.
--  This file does NOT drop or recreate tables.
-- ============================================================

-- ============================================================
--  ADD COLUMN — copy a block and fill in the details
-- ============================================================

-- influencers — platform is a core attribute, used by confirmed join
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS platform TEXT;

-- influencers — contact tracking fields
-- NOTE: status is the existing backend column (values: accept/yes/reply/negotiate/reject/target) — do NOT modify
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT '';
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS contact_count   INTEGER DEFAULT 0;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS last_contact_at   TIMESTAMPTZ;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS reply_count     INTEGER DEFAULT 0;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS progress_stage  TEXT DEFAULT '';
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS progress_count  INTEGER;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS memo            TEXT DEFAULT '';

-- Seed status from existing status data (run once after adding the column)
UPDATE influencers SET status = CASE status
  WHEN 'target'    THEN 'target'
  WHEN 'yes'       THEN 'yes'
  WHEN 'reply'     THEN 'reply'
  WHEN 'positive'  THEN 'positive'
  WHEN 'negative'  THEN 'negative'
  WHEN 'reject'    THEN 'reject'
  WHEN 'accept'    THEN 'accept'
  WHEN 'noreply'   THEN 'noreply'
  WHEN 'paid'      THEN 'paid'
  WHEN 'negotiate' THEN 'positive'
  ELSE ''
END WHERE (status IS NULL OR status = '');

-- confirmed_influencers — Google Form data
-- NOTE: handle, display_name, email, profile_url come from influencers JOIN.
--       content_platforms + platform store per-creator multi-platform accounts.
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS content_platforms JSONB DEFAULT '[]'::jsonb;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'TikTok';
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS repost         TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS phone          TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS content_type   TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS address_line_1 TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS address_line_2 TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS city           TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS state          TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS zip            TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS country        TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS review_link     TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS notes           TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS form_submitted  BOOLEAN DEFAULT FALSE;

-- confirmed_influencers — fixed sequence number (1-N), same across all pages
-- STEP 1: run this first
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS seq INTEGER;

-- STEP 2: run this separately after step 1 completes
WITH numbered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY phase_id ORDER BY created_at, id) AS rn
  FROM confirmed_influencers
)
UPDATE confirmed_influencers ci
SET seq = n.rn
FROM numbered n
WHERE ci.id = n.id;

-- ems_tracking — columns matching current schema
ALTER TABLE ems_tracking ADD COLUMN IF NOT EXISTS registered_date   DATE;         -- 신청일
ALTER TABLE ems_tracking ADD COLUMN IF NOT EXISTS application_number TEXT;        -- 접수번호
ALTER TABLE ems_tracking ADD COLUMN IF NOT EXISTS email_sent        BOOLEAN DEFAULT false;
ALTER TABLE ems_tracking ADD COLUMN IF NOT EXISTS error_reason      TEXT;   -- 오류 사유 (배송 오류 관리)
ALTER TABLE ems_tracking ADD COLUMN IF NOT EXISTS registered_17track TEXT;  -- 'Y' when registered on 17track
-- Remove old columns not in schema
ALTER TABLE ems_tracking DROP COLUMN IF EXISTS product;
ALTER TABLE ems_tracking DROP COLUMN IF EXISTS application_date;

ALTER TABLE ems_tracking DROP COLUMN IF EXISTS us_arrival;
ALTER TABLE ems_reshipments DROP COLUMN IF EXISTS us_arrival;

CREATE TABLE IF NOT EXISTS ems_reshipments (
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

CREATE INDEX IF NOT EXISTS idx_ems_reshipments_confirmed ON ems_reshipments(confirmed_influencer_id);
CREATE INDEX IF NOT EXISTS idx_ems_reshipments_status    ON ems_reshipments(status);

ALTER TABLE ems_reshipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_ems_reshipments" ON ems_reshipments;
CREATE POLICY "allow_all_ems_reshipments" ON ems_reshipments FOR ALL USING (true) WITH CHECK (true);

-- monitoring — add account (handle) column to match sheet header directly
-- platform|account|date|media|content|brand|repost|review link|조회수|좋아요 수|댓글 수|감지된 키워드|모니터링 실행일
ALTER TABLE monitoring ADD COLUMN IF NOT EXISTS account TEXT;

-- make confirmed_influencer_id optional so rows can exist without a FK match
ALTER TABLE monitoring ALTER COLUMN confirmed_influencer_id DROP NOT NULL;

-- Add a 'brands' aggregate row for the flat UI keyword list (monitoring page)
INSERT INTO monitoring_keywords (brand, keywords)
VALUES ('brands', ARRAY['aesthen', 'joodoc', 'nesh', 'varuza'])
ON CONFLICT (brand) DO NOTHING;

-- ALTER TABLE monitoring            ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;
-- ALTER TABLE status_messages     ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;
-- ALTER TABLE beauty_news_archives  ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;
-- ALTER TABLE email_recipients      ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;
-- ALTER TABLE phases                ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;
-- ALTER TABLE tiers                 ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;

-- ============================================================
--  NEW TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS brand_general (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name       TEXT        NOT NULL,
  email            TEXT,
  phone            TEXT,
  website          TEXT,
  product_category TEXT,
  overseas         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- brand_general — contacted + contact tracking columns
ALTER TABLE brand_general ADD COLUMN IF NOT EXISTS name         TEXT;
ALTER TABLE brand_general ADD COLUMN IF NOT EXISTS contacted    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE brand_general ADD COLUMN IF NOT EXISTS status       TEXT    NOT NULL DEFAULT '';
ALTER TABLE brand_general ADD COLUMN IF NOT EXISTS send_count   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE brand_general ADD COLUMN IF NOT EXISTS reply_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE brand_general ADD COLUMN IF NOT EXISTS notes        TEXT;

-- brand_personal — new table for personal brand contacts
CREATE TABLE IF NOT EXISTS brand_personal (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name       TEXT        NOT NULL,
  contact_name     TEXT        NOT NULL,
  department       TEXT        NOT NULL,
  position         TEXT        NOT NULL,
  personal_email   TEXT        NOT NULL,
  personal_phone   TEXT        NOT NULL,
  website          TEXT        NOT NULL,
  rep_email        TEXT,
  telephone        TEXT,
  product_category TEXT,
  overseas         BOOLEAN     NOT NULL DEFAULT FALSE,
  contacted        BOOLEAN     NOT NULL DEFAULT FALSE,
  status           TEXT        NOT NULL DEFAULT '',
  send_count       INTEGER     NOT NULL DEFAULT 0,
  reply_count      INTEGER     NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brand_personal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_brand_personal" ON brand_personal;
CREATE POLICY "allow_all_brand_personal" ON brand_personal FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for brand_general (run if table already exists and RLS is on)
ALTER TABLE brand_general ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_brand_general" ON brand_general;
CREATE POLICY "allow_all_brand_general" ON brand_general FOR ALL USING (true) WITH CHECK (true);


-- RLS policies for brand_contacts (run if table already exists and RLS is on)
ALTER TABLE brand_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_brand_contacts" ON brand_contacts;
CREATE POLICY "allow_all_brand_contacts" ON brand_contacts FOR ALL USING (true) WITH CHECK (true);

-- If table already exists, add the columns:
ALTER TABLE brand_contacts ADD COLUMN IF NOT EXISTS brand_type  TEXT    NOT NULL DEFAULT 'general';
ALTER TABLE brand_contacts ADD COLUMN IF NOT EXISTS contacted   BOOLEAN NOT NULL DEFAULT FALSE;

-- confirmed_brands — standalone confirmed brand management table
CREATE TABLE IF NOT EXISTS confirmed_brands (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  phase_id         UUID        REFERENCES phases(id),
  brand_name       TEXT        NOT NULL,
  contact_name     TEXT,
  position         TEXT,
  email            TEXT,
  phone            TEXT,
  website          TEXT,
  product          TEXT,
  production_cost  TEXT,
  received         BOOLEAN     NOT NULL DEFAULT FALSE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE confirmed_brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_confirmed_brands" ON confirmed_brands;
CREATE POLICY "allow_all_confirmed_brands" ON confirmed_brands FOR ALL USING (true) WITH CHECK (true);

-- brand_personal — add company column
ALTER TABLE brand_personal ADD COLUMN IF NOT EXISTS company TEXT;

-- ============================================================
--  DROP COLUMN
-- ============================================================

-- confirmed_influencers — remove content_type (not needed)
ALTER TABLE confirmed_influencers DROP COLUMN IF EXISTS content_type;

-- confirmed_influencers — remove duplicated/old columns
-- platform, account_url added by mistake (come from influencers JOIN)
ALTER TABLE confirmed_influencers DROP COLUMN IF EXISTS platform;
ALTER TABLE confirmed_influencers DROP COLUMN IF EXISTS account_url;
-- these come from influencers JOIN via influencer_id
ALTER TABLE confirmed_influencers DROP COLUMN IF EXISTS display_name;
ALTER TABLE confirmed_influencers DROP COLUMN IF EXISTS handle;
ALTER TABLE confirmed_influencers DROP COLUMN IF EXISTS followers;
-- replaced by separate address fields
ALTER TABLE confirmed_influencers DROP COLUMN IF EXISTS full_address;
-- not used
ALTER TABLE confirmed_influencers DROP COLUMN IF EXISTS upload_link;

-- ALTER TABLE influencers DROP COLUMN IF EXISTS <column>;

-- ============================================================
--  RENAME COLUMN
-- ============================================================

-- brand_personal — make all contact fields optional (only brand_name required)
ALTER TABLE brand_personal ALTER COLUMN department     DROP NOT NULL;
ALTER TABLE brand_personal ALTER COLUMN position       DROP NOT NULL;
ALTER TABLE brand_personal ALTER COLUMN personal_phone DROP NOT NULL;
ALTER TABLE brand_personal ALTER COLUMN website        DROP NOT NULL;
ALTER TABLE brand_personal ALTER COLUMN personal_email DROP NOT NULL;

-- brand_general, brand_personal — phase tracking
ALTER TABLE brand_general  ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES phases(id);
ALTER TABLE brand_personal ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES phases(id);

-- brand_general — rename name → company, phone → telephone
ALTER TABLE brand_general RENAME COLUMN name TO company;
ALTER TABLE brand_general RENAME COLUMN phone TO telephone;

-- brand_general — convert email from single TEXT to TEXT[] (preserves existing values)
ALTER TABLE brand_general ALTER COLUMN email TYPE TEXT[] USING CASE WHEN email IS NULL THEN NULL ELSE ARRAY[email] END;

-- ALTER TABLE influencers RENAME COLUMN <old_name> TO <new_name>;

-- ============================================================
--  CHANGE COLUMN TYPE
-- ============================================================

-- ALTER TABLE influencers ALTER COLUMN <column> TYPE <new_type> USING <column>::<new_type>;

-- ============================================================
--  SEED / UPDATE DATA
-- ============================================================

-- Seed: confirmed influencers (status = 'accept')
INSERT INTO influencers (created_at, phase_id, platform, handle, display_name, followers, status)
VALUES
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'thatgirlkierstin',       'Kierstin Sedlak',        33000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'lovebylexis',            'Alexis Beasley',          23100,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'itskristv',              'Kristen Jones',            3300,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'stephssocute',           'Stephanie Perez',          3800,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'charity_017',            'Charity Luster',           4500,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'elssielee',              'Elssie Lee',               7100,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'Creativvely',            'Luna Malfabon',            3200,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'anikafong',              'Anika Fong',               3100,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'crazybeautifulmakeup',   'Heather Jannett',          4600,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'MGoldCreative',          'Marni Gold',              20700,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'jadetillman0',           'Jade Tillman',             7000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'victoriaxali',           'Alicia Cruz',              4400,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'Instagram', 'mamalifewali',           NULL,                       4200,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'renu_tamang22',          'Renu Taman',               5500,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    '_.bxbydxll.x',          'Brianna Potts',            5000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'kelly_anne_81',          'Kelly Messier',            4300,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'alohabriee',             'Brieanna Welch-Chenier',   7400,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'hearherix',              'Heather Johnson',          8800,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'itsjudyshin',            'Judy Shin',               10500,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'tinaangelinaaa',         'Tina Angelina',           22100,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'losernamedl',            'Lauren Mack',              6000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    '505afrolatina.barbiee',  'Kelsey Apodaca',          32300,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'yohannauc',              'Yohanna Urena',            5100,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'Kelsey.skincareee',      'Kelsey Nash',              5000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'lazymxchi',              'Olivia Rinaldo',           4100,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'whoisasxa',              'Asia Monique Mays',        1100,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'Pearlsearcher',          'Cindy Gahr',               5000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'britta.loves',           'Britta Fernandes',        10000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'thelifeofruthie',        'Ruth Escamilla',           4300,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'burseygirl84reviews',    'Heather G. Bursey',        5000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'beccaa.mor',             'Rebecca Parker',           8000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    '_morchelle',             'Morchelle Plange',         5000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'bunnidollyy',            'Chelsea Rojas',           37400,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'Jordykaoir',             'Jordann La Fleur',        21200,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'tiltedtiramisu',         'Jessica Giang',           55700,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'vxmpirebunni',           'Nicole Lorenzo',           9000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'linlxvs',                'Soolin Hong',             63100,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'sarampena',              'Sara Smith-Pena',          5300,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'Holykaran',              'Jone Karan',               5000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'Anahiiv._',              'Anahi Macias',             3200,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'sammiechennara',         'Somnang Dork',             9000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'visualsbyaverie',        'Averie Seno',             13200,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'Faces.by.Jamari',        'Jamari Johnson',           5200,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'Dainaxox',               'Ridaina Inayat',          11000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'ladyluck779',            'Sabina Gurung',           11000,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'xoxoluvjoan',            'Joan Kosisky',            13100,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'TikTok',    'laurentressler',         'Lauren Tressler',         18300,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'Magazine',  'a good hue',             'Amanda Morrow',            NULL,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'Magazine',  'Byrdie',                 'Derek Deng',               NULL,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'Magazine',  'Bust',                   'Bust',                     NULL,  'accept'),
  ('2026-06-09T00:00:00.000Z', get_active_phase_id(), 'Magazine',  'Allure',                 'Dianna Singh',             NULL,  'accept')
ON CONFLICT (phase_id, handle) DO UPDATE SET
  platform     = EXCLUDED.platform,
  display_name = EXCLUDED.display_name,
  followers    = EXCLUDED.followers,
  status     = EXCLUDED.status;

-- Bulk update confirmed_influencers with form data (matched via influencers.handle)
UPDATE confirmed_influencers ci
SET
  upload_status  = d.upload_status,
  repost         = NULLIF(d.repost, ''),
  phone          = NULLIF(d.phone, ''),
  email          = NULLIF(d.email, ''),
  address_line_1 = NULLIF(d.address_line_1, ''),
  address_line_2 = NULLIF(d.address_line_2, ''),
  city           = NULLIF(d.city, ''),
  state          = NULLIF(d.state, ''),
  zip            = NULLIF(d.zip, ''),
  country        = NULLIF(d.country, '')
FROM (VALUES
  ('thatgirlkierstin',      'Pending', 'O', '440-850-1231', '',                                '5220 Jaycee Ave',          'Apt 20',          'Ashtabula',            'OH', '44004', 'US'),
  ('lovebylexis',           'Pending', 'O', '972-921-9411', 'alexisbeasley84@gmail.com',        '730 FM 876',               '',                'Waxahachie',           'TX', '75167', 'US'),
  ('itskristv',             'Yes',     '▲', '512-584-4618', 'kristenmjones26@gmail.com',        '235 Tall Grass Dr',        '',                'Georgetown',           'TX', '78628', 'US'),
  ('stephssocute',          'Pending', 'O', '209-534-4413', 'steph.beauty97@gmail.com',         '470 W Wall Rd',            'Apt 121',         'Imperial',             'CA', '92252', 'US'),
  ('charity_017',           'Yes',     'O', '662-891-0628', 'collabswithcharity20@gmail.com',   '1180 County Rd 87',        '',                'New Albany',           'MS', '38652', 'US'),
  ('elssielee',             'Pending', 'O', '626-434-5818', 'elssiexlee@gmail.com',             '246 Amberwood Dr',         '',                'Walnut',               'CA', '91789', 'US'),
  ('Creativvely',           'Pending', 'X', '510-905-4672', 'creativvelyugc@gmail.com',         '128 N Humboldt St',        'Apt 4',           'San Mateo',            'CA', '94401', 'US'),
  ('anikafong',             'Yes',     'O', '940-315-9019', 'anikaafong@gmail.com',             '11025 Aledo Ln',           '',                'Aubrey',               'TX', '76227', 'US'),
  ('crazybeautifulmakeup',  'Yes',     'O', '865-386-4784', 'crazybeautifulmakeup@gmail.com',   '2408 Casona Ln',           'Apt 8107',        'Melbourne',            'FL', '32940', 'US'),
  ('MGoldCreative',         'Pending', '▲', '201-240-9006', 'marnivoice@gmail.com',             '482 Glenwood Ave',         '1st Floor',       'Teaneck',              'NJ', '07666', 'US'),
  ('jadetillman0',          'Yes',     'O', '478-972-4600', 'collabswithjadet@gmail.com',       '205 Meadow Run Dr',        '',                'Warner Robins',        'GA', '31088', 'US'),
  ('victoriaxali',          'Pending', '▲', '209-353-5662', 'aliciavcruz21@gmail.com',          '5333 10th St',             '',                'Keyes',                'CA', '95328', 'US'),
  ('renu_tamang22',         'Yes',     'O', '253-737-0539', 'renumangta1114@gmail.com',         '9807 S 248th St',          'Apt B6',          'Kent',                 'WA', '98030', 'US'),
  ('_.bxbydxll.x',         'Pending', 'O', '785-260-1938', 'briannapotts1717@gmail.com',       '5333 SW 15th Ct',          'Apt 2',           'Topeka',               'KS', '66604', 'US'),
  ('kelly_anne_81',         'Yes',     'O', '508-642-3793', 'Kellyannemgmt@gmail.com',          '470 Eastern Ave',          '',                'Fall River',           'MA', '02723', 'US'),
  ('alohabriee',            'Yes',     'O', '408-646-4640', 'brieanna.welch@gmail.com',         '180 South Brook Dr',       'Unit 2112',       'Leander',              'TX', '78641', 'US'),
  ('hearherix',             'Yes',     'O', '216-246-9619', 'heatherix127@gmail.com',           '19307 Wickfield Ave',      '',                'Warrensville Heights', 'OH', '44122', 'US'),
  ('itsjudyshin',           'Pending', 'X', '562-409-4559', 'itsjudyshin@gmail.com',            '511 Tamarind Way',         'Unit C',          'West Covina',          'CA', '91791', 'US'),
  ('tinaangelinaaa',        'Yes',     'O', '818-274-4575', 'partnerships@tinaangelina.com',    '95 Wall St',               'Unit 812',        'New York',             'NY', '10005', 'US'),
  ('losernamedl',           'Yes',     'O', '817-521-8412', 'losernamedl02@gmail.com',          '6070 Copperfield Dr',      'Apt 617',         'Fort Worth',           'TX', '76132', 'US'),
  ('505afrolatina.barbiee', 'Yes',     '▲', '505-755-3372', '505afrolatina.barbiee@gmail.com',  '821 Los Arboles Ave NW',   '',                'Albuquerque',          'NM', '87107', 'US'),
  ('yohannauc',             'Yes',     '▲', '908-463-8306', 'yohannauc27@gmail.com',            '5 E Gibbons St',           '',                'Linden',               'NJ', '07036', 'US'),
  ('Kelsey.skincareee',     'Yes',     'O', '435-559-9048', 'pr_kelseynash@yahoo.com',          '1414 W 1650 S',            '',                'Cedar City',           'UT', '84720', 'US'),
  ('lazymxchi',             'Pending', 'O', '626-786-1187', 'oliviaxcollabs@gmail.com',         '413 NW 19th St',           '',                'Grand Prairie',        'TX', '75050', 'US'),
  ('whoisasxa',             'Pending', 'O', '708-565-0123', 'asiamonique.mays@gmail.com',       '19404 Oak Ave',            '',                'Country Club Hills',   'IL', '60478', 'US'),
  ('Pearlsearcher',         'Pending', 'O', '909-653-7113', 'cindyagahr@gmail.com',             '9417 Palo Verde Dr',       '',                'Hesperia',             'CA', '92344', 'US'),
  ('britta.loves',          'Yes',     'O', '618-419-0618', 'britta2477@gmail.com',             '2 High Crest Dr',          '',                'Belleville',           'IL', '62221', 'US'),
  ('thelifeofruthie',       'Pending', 'O', '979-398-0000', 'thelifeofruthie@gmail.com',        '178 Hilldale Dr',          '',                'Nederland',            'TX', '77627', 'US'),
  ('burseygirl84reviews',   'Pending', 'O', '978-967-7386', 'burseygirl@gmail.com',             '2 Carmena Rd',             '',                'Billerica',            'MA', '01821', 'US'),
  ('beccaa.mor',            'Pending', '▲', '954-588-0128', 'rebeccaparker290@gmail.com',       '6800 NW 39th Ave',         'Lot 228',         'Coconut Creek',        'FL', '33073', 'US'),
  ('_morchelle',            'Yes',     '▲', '813-618-0633', 'morchellie@gmail.com',             '6907 Neopolitan Ct',       '',                'Apollo Beach',         'FL', '33572', 'US'),
  ('bunnidollyy',           'Pending', 'O', '929-536-4038', 'xo.bunnidolly@gmail.com',          '4706 4th Ave',             'Apt 6',           'Brooklyn',             'NY', '11220', 'US'),
  ('Jordykaoir',            'Pending', 'O', '725-246-7756', 'jordykaoir@gmail.com',             '4360 Terrace Hill Rd',     'Bldg 12 Apt 102', 'Las Vegas',            'NV', '89103', 'US'),
  ('tiltedtiramisu',        'Pending', 'O', '215-570-8748', 'jessisamess.tiktok@gmail.com',     '1257 Heather Rd',          '',                'Ambler',               'PA', '19002', 'US'),
  ('vxmpirebunni',          'Pending', '▲', '219-546-3331', 'pxpnini@gmail.com',                '1207 Kiersted St',         '',                'Morris',               'IL', '60450', 'US'),
  ('linlxvs',               'Pending', 'O', '469-690-6187', 'soolinhong@gmail.com',             '306 Colusa Dr',            '',                'Lewisville',           'TX', '75056', 'US'),
  ('sarampena',             'Pending', '▲', '949-769-4834', 'saramarissa0505@gmail.com',        '100 Danforth Ave',         'Unit 216',        'Dobbs Ferry',          'NY', '10522', 'US'),
  ('Holykaran',             'Pending', 'O', '470-877-4282', 'jonekaran@hotmail.com',            '250 Battery Park Cir',     'Unit 531',        'Anderson',             'SC', '29621', 'US'),
  ('Anahiiv._',             'Yes',     'O', '559-5770508',  'maciasanahi1216@yahoo.com',        '1550 E Church Ave',        'Apt 211',         'Fresno',               'CA', '93706', 'US'),
  ('sammiechennara',        'Pending', 'O', '840-204-5985', 'babieprecious08@gmail.com',        '2988 S Clifton Ave',       '',                'Wichita',              'KS', '67210', 'US'),
  ('visualsbyaverie',       'Yes',     'O', '840-233-3764', 'averiecollabs@gmail.com',          '12927 Moreno Beach Dr',    'Apt 5108',        'Moreno Valley',        'CA', '92555', 'US'),
  ('Faces.by.Jamari',       'Yes',     'O', '336-942-4393', 'johnsonjamari484@gmail.com',       '3644 Mosby Dr',            '',                'Greensboro',           'NC', '27407', 'US'),
  ('Dainaxox',              'Yes',     '▲', '346-254-2871', 'ridianaxox@gmail.com',             '24615 Celestial Lily Dr',  '',                'Katy',                 'TX', '77493', 'US'),
  ('ladyluck779',           'Yes',     'O', '716-342-9698', 'sobnamalone@gmail.com',            '109 Palmer Ave',           'Front',           'Kenmore',              'NY', '14217', 'US'),
  ('xoxoluvjoan',           'Pending', 'O', '410-660-7395', 'Joankosisky1998@gmail.com',        '15411 Potomac River Dr',   'Unit 448',        'Cobb Island',          'MD', '20625', 'US'),
  ('laurentressler',        'Yes',     'O', '904-514-9968', 'laurenmtressler@gmail.com',        '13050 Gran Bay Pkwy',      'Unit 438',        'Jacksonville',         'FL', '32258', 'US'),
  ('a good hue',            'Yes',     '',  '',             'amanda@agoodhueblog.com',           '3140 Buffalo Rd',          '',                'Ontario',              'CA', '91761', 'US'),
  ('Byrdie',                'Pending', '',  '626-695-9882', 'derekdeng888@gmail.com',            '180 Front St',             'Unit 7F',         'Brooklyn',             'NY', '11201', 'US'),
  ('Bust',                  'Pending', '',  '',             'edomash@laweekly.com',              '227 Sandy Springs Pl',     'Unit D102',       'Sandy Springs',        'GA', '30328', 'US'),
  ('Allure',                'Pending', '',  '518-935-7195', 'dianna_mazzone@condenast.com',      '1 World Trade Center',     '24th Floor',      'New York',             'NY', '10007', 'US')
) AS d(handle, upload_status, repost, phone, email, address_line_1, address_line_2, city, state, zip, country)
JOIN influencers i ON i.handle = d.handle
WHERE ci.influencer_id = i.id;

-- Run this immediately after the INSERT above to sync confirmed_influencers
INSERT INTO confirmed_influencers (influencer_id, phase_id, email, upload_status)
SELECT i.id, i.phase_id, i.email, 'Pending'
FROM influencers i
WHERE i.status = 'accept'
  AND NOT EXISTS (
    SELECT 1 FROM confirmed_influencers c WHERE c.influencer_id = i.id
  );

-- Backfill confirmed_brands from brand_general where status = 'accept'
INSERT INTO confirmed_brands (brand_name, phase_id, email, phone, website)
SELECT
  bg.brand_name,
  bg.phase_id,
  bg.email[1],
  bg.telephone,
  bg.website
FROM brand_general bg
WHERE bg.status = 'accept'
  AND NOT EXISTS (
    SELECT 1 FROM confirmed_brands cb
    WHERE cb.brand_name = bg.brand_name
      AND cb.phase_id   = bg.phase_id
  );

-- Backfill confirmed_brands from brand_personal where status = 'accept'
INSERT INTO confirmed_brands (brand_name, phase_id, email, contact_name, position, phone, website)
SELECT
  bp.brand_name,
  bp.phase_id,
  bp.personal_email,
  bp.contact_name,
  bp.position,
  bp.personal_phone,
  bp.website
FROM brand_personal bp
WHERE bp.status = 'accept'
  AND NOT EXISTS (
    SELECT 1 FROM confirmed_brands cb
    WHERE cb.brand_name = bp.brand_name
      AND cb.phase_id   = bp.phase_id
  );

-- Add a new phase (is_active stays false; switch it in the app)
-- INSERT INTO phases (name, is_active, started_at) VALUES ('2차', false, CURRENT_DATE);

-- Switch active phase (updates app_config so all tables default to new phase)
-- UPDATE app_config SET value = to_jsonb((SELECT id::text FROM phases WHERE name = '2차')), updated_at = now()
-- WHERE key = 'active_phase_id';

-- Add a new tier
-- INSERT INTO tiers (rank, label, category, tags, min_followers, max_followers, sort_order)
-- VALUES ('6순위', '<label>', '<category>', '<tags>', <min>, <max>, 6);

-- Update tiers follower range
-- UPDATE tiers SET min_followers = <min>, max_followers = <max> WHERE rank = '1순위';

-- Add monitoring keyword brand
-- INSERT INTO monitoring_keywords (brand, keywords) VALUES ('<brand>', ARRAY['<kw1>', '<kw2>'])
-- ON CONFLICT (brand) DO UPDATE SET keywords = EXCLUDED.keywords;

-- ============================================================
--  confirmed_influencers — content_platforms backfill
-- ============================================================

-- Seed JSON from linked influencer (recruitment snapshot)
UPDATE confirmed_influencers ci
SET
  content_platforms = jsonb_build_array(
    jsonb_build_object(
      'platform',    COALESCE(i.platform, 'TikTok'),
      'handle',      i.handle,
      'followers',   COALESCE(i.followers, 0),
      'profile_url', COALESCE(i.profile_url, 'https://www.tiktok.com/@' || i.handle),
      'is_primary',  true
    )
  ),
  platform = COALESCE(i.platform, 'TikTok')
FROM influencers i
WHERE ci.influencer_id = i.id
  AND (ci.content_platforms IS NULL OR ci.content_platforms = '[]'::jsonb);

-- Normalize platform casing
UPDATE confirmed_influencers
SET platform = 'TikTok'
WHERE LOWER(platform) = 'tiktok' AND platform <> 'TikTok';

-- Sync platform column from primary entry in JSON
UPDATE confirmed_influencers
SET platform = elem->>'platform'
FROM LATERAL (
  SELECT elem
  FROM jsonb_array_elements(content_platforms) AS elem
  WHERE (elem->>'is_primary')::boolean = true
  LIMIT 1
) AS primary_row
WHERE jsonb_array_length(content_platforms) > 0
  AND primary_row.elem IS NOT NULL;

-- ============================================================
--  POST-IMPORT UTILITIES
-- ============================================================

-- Add unique constraint on influencer_id (one confirmed row per influencer)
ALTER TABLE confirmed_influencers ADD CONSTRAINT confirmed_influencers_influencer_id_key UNIQUE (influencer_id);

-- Backfill confirmed_influencers for influencers already marked 'accept'
INSERT INTO confirmed_influencers (influencer_id, phase_id, email, upload_status)
SELECT i.id, i.phase_id, i.email, 'Pending'
FROM influencers i
WHERE i.status = 'accept'
  AND NOT EXISTS (
    SELECT 1 FROM confirmed_influencers c WHERE c.influencer_id = i.id
  );

-- Auto-assign tier_id after CSV import (based on follower count)
-- UPDATE influencers i SET tier_id = t.id FROM tiers t
-- WHERE i.followers BETWEEN t.min_followers AND t.max_followers AND i.tier_id IS NULL;

-- Reassign all influencers in a phase to a different phase
-- UPDATE influencers SET phase_id = (SELECT id FROM phases WHERE name = '2차')
-- WHERE phase_id = (SELECT id FROM phases WHERE name = '1차');

-- Check which influencers have no tier assigned
-- SELECT id, handle, followers FROM influencers WHERE tier_id IS NULL ORDER BY followers DESC;

-- ============================================================
--  INDEX MANAGEMENT
-- ============================================================

-- CREATE INDEX IF NOT EXISTS idx_influencers_handle ON influencers(handle);
-- DROP INDEX IF EXISTS <index_name>;


-- ============================================================
--  brand_personal — change personal_email TEXT → TEXT[]
-- ============================================================
ALTER TABLE brand_personal
  ALTER COLUMN personal_email TYPE TEXT[]
  USING CASE WHEN personal_email IS NULL THEN NULL ELSE ARRAY[personal_email] END;

-- ============================================================
--  influencer_platform — normalize content_platforms JSONB
--  Run this entire block once in Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS influencer_platform (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at              TIMESTAMPTZ DEFAULT now(),
  confirmed_influencer_id UUID        NOT NULL REFERENCES confirmed_influencers(id) ON DELETE CASCADE,
  platform                TEXT        NOT NULL,
  handle                  TEXT,
  followers               INTEGER     DEFAULT 0,
  profile_url             TEXT
);

CREATE INDEX IF NOT EXISTS idx_influencer_platform_confirmed ON influencer_platform(confirmed_influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_platform_handle    ON influencer_platform(handle);

ALTER TABLE influencer_platform ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_influencer_platform" ON influencer_platform
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Migrate existing content_platforms JSONB → influencer_platform rows
INSERT INTO influencer_platform (confirmed_influencer_id, platform, handle, followers, profile_url)
SELECT
  ci.id,
  COALESCE(NULLIF(TRIM(elem->>'platform'), ''), 'TikTok'),
  NULLIF(TRIM(elem->>'handle'), ''),
  COALESCE((elem->>'followers')::INTEGER, 0),
  NULLIF(TRIM(elem->>'profile_url'), '')
FROM confirmed_influencers ci,
LATERAL jsonb_array_elements(
  CASE
    WHEN ci.content_platforms IS NULL OR ci.content_platforms = '[]'::jsonb
    THEN '[]'::jsonb
    ELSE ci.content_platforms
  END
) AS elem
WHERE TRIM(elem->>'platform') <> ''
ON CONFLICT DO NOTHING;

-- Add influencer_platform_id FK to monitoring
ALTER TABLE monitoring ADD COLUMN IF NOT EXISTS influencer_platform_id UUID
  REFERENCES influencer_platform(id) ON DELETE SET NULL;

-- Backfill: match by handle first
UPDATE monitoring m
SET influencer_platform_id = ip.id
FROM influencer_platform ip
WHERE m.influencer_platform_id IS NULL
  AND ip.handle = m.account;

-- Backfill: remaining by confirmed_influencer_id + platform
UPDATE monitoring m
SET influencer_platform_id = ip.id
FROM influencer_platform ip
WHERE m.influencer_platform_id IS NULL
  AND ip.confirmed_influencer_id = m.confirmed_influencer_id
  AND ip.platform = m.platform;

-- Drop old columns from monitoring (data now in influencer_platform / confirmed_influencers)
ALTER TABLE monitoring DROP COLUMN IF EXISTS account;
ALTER TABLE monitoring DROP COLUMN IF EXISTS confirmed_influencer_id;
ALTER TABLE monitoring DROP COLUMN IF EXISTS repost;

-- Drop JSONB column from confirmed_influencers (replaced by influencer_platform table)
ALTER TABLE confirmed_influencers DROP COLUMN IF EXISTS content_platforms;

-- ============================================================
--  influencer_platform — seed data
--  Lookup: join influencers by handle → confirmed_influencers
--  Secondary Instagram rows use the primary TikTok handle for lookup
-- ============================================================
WITH seed (lookup_handle, platform, handle, followers) AS (
  VALUES
  ('thatgirlkierstin'::text,       'TikTok'::text,    'thatgirlkierstin'::text,        33000::int),
  ('lovebylexis',                  'TikTok',           'lovebylexis',                   23100),
  ('itskristv',                    'TikTok',           'itskristv',                      3300),
  ('itskristv',                    'Instagram',        'itskristv',                         0),
  ('stephssocute',                 'TikTok',           'stephssocute',                   3800),
  ('charity_017',                  'TikTok',           'charity_017',                    4500),
  ('elssielee',                    'TikTok',           'elssielee',                      7100),
  ('Creativvely',                  'TikTok',           'Creativvely',                    3200),
  ('anikafong',                    'TikTok',           'anikafong',                      3100),
  ('crazybeautifulmakeup',         'TikTok',           'crazybeautifulmakeup',           4600),
  ('crazybeautifulmakeup',         'Instagram',        'crazybeautifulmakeup',              0),
  ('MGoldCreative',                'TikTok',           'MGoldCreative',                 20700),
  ('jadetillman0',                 'TikTok',           'jadetillman0',                   7000),
  ('jadetillman0',                 'Instagram',        'jadiet',                            0),
  ('victoriaxali',                 'TikTok',           'victoriaxali',                   4400),
  ('mamalifewali',                 'Instagram',        'mamalifewali',                   4200),
  ('renu_tamang22',                'TikTok',           'renu_tamang22',                  5500),
  ('_.bxbydxll.x',                 'TikTok',           '_.bxbydxll.x',                  5000),
  ('kelly_anne_81',                'TikTok',           'kelly_anne_81',                  4300),
  ('alohabriee',                   'TikTok',           'alohabriee',                     7400),
  ('hearherix',                    'TikTok',           'hearherix',                      8800),
  ('itsjudyshin',                  'TikTok',           'itsjudyshin',                   10500),
  ('tinaangelinaaa',               'TikTok',           'tinaangelinaaa',                22100),
  ('tinaangelinaaa',               'Instagram',        'Tinaangelinaa',                     0),
  ('losernamedl',                  'TikTok',           'losernamedl',                    6000),
  ('505afrolatina.barbiee',        'TikTok',           '505afrolatina.barbiee',         32300),
  ('yohannauc',                    'TikTok',           'yohannauc',                      5100),
  ('Kelsey.skincareee',            'TikTok',           'Kelsey.skincareee',              5000),
  ('lazymxchi',                    'TikTok',           'lazymxchi',                      4100),
  ('whoisasxa',                    'TikTok',           'whoisasxa',                      1100),
  ('Pearlsearcher',                'TikTok',           'Pearlsearcher',                  5000),
  ('britta.loves',                 'TikTok',           'britta.loves',                  10000),
  ('thelifeofruthie',              'TikTok',           'thelifeofruthie',                4300),
  ('burseygirl84reviews',          'TikTok',           'burseygirl84reviews',            5000),
  ('beccaa.mor',                   'TikTok',           'beccaa.mor',                     8000),
  ('_morchelle',                   'TikTok',           '_morchelle',                     5000),
  ('bunnidollyy',                  'TikTok',           'bunnidollyy',                   37400),
  ('Jordykaoir',                   'TikTok',           'Jordykaoir',                    21200),
  ('tiltedtiramisu',               'TikTok',           'tiltedtiramisu',                55700),
  ('vxmpirebunni',                 'TikTok',           'vxmpirebunni',                   9000),
  ('linlxvs',                      'TikTok',           'linlxvs',                       63100),
  ('sarampena',                    'TikTok',           'sarampena',                      5300),
  ('Holykaran',                    'TikTok',           'Holykaran',                      5000),
  ('Anahiiv._',                    'TikTok',           'Anahiiv._',                      3200),
  ('sammiechennara',               'TikTok',           'sammiechennara',                 9000),
  ('visualsbyaverie',              'TikTok',           'visualsbyaverie',               13200),
  ('visualsbyaverie',              'Instagram',        'visualsbyaverie',                   0),
  ('Faces.by.Jamari',              'TikTok',           'Faces.by.Jamari',                5200),
  ('Dainaxox',                     'TikTok',           'Dainaxox',                      11000),
  ('ladyluck779',                  'TikTok',           'ladyluck779',                   11000),
  ('xoxoluvjoan',                  'TikTok',           'xoxoluvjoan',                   13100),
  ('laurentressler',               'TikTok',           'laurentressler',                18300),
  ('a good hue',                   'Magazine',         'a good hue',                        0),
  ('Byrdie',                       'Magazine',         'Byrdie',                            0),
  ('Bust',                         'Magazine',         'Bust',                              0),
  ('Allure',                       'Magazine',         'Allure',                            0)
)
INSERT INTO influencer_platform (confirmed_influencer_id, platform, handle, followers, profile_url)
SELECT ci.id, s.platform, s.handle, s.followers,
  CASE s.platform
    WHEN 'TikTok'    THEN 'https://www.tiktok.com/@' || s.handle
    WHEN 'Instagram' THEN 'https://www.instagram.com/' || s.handle
    ELSE NULL
  END
FROM seed s
JOIN influencers i ON LOWER(i.handle) = LOWER(s.lookup_handle)
JOIN confirmed_influencers ci ON ci.influencer_id = i.id
WHERE NOT EXISTS (
  SELECT 1 FROM influencer_platform ip
  WHERE ip.confirmed_influencer_id = ci.id
    AND ip.platform = s.platform
    AND LOWER(ip.handle) = LOWER(s.handle)
);

-- ============================================================
--  ems_tracking — seed shipping data
--  Lookup by display_name (falls back to handle) → confirmed_influencer_id
--  Some influencers appear twice (Feb + Mar shipments)
-- ============================================================
WITH seed (lookup_name, registered_date, application_number, status, ems_number) AS (
  VALUES
  -- February 2026 shipment (50 influencers)
  ('Kierstin Sedlak'::text,          '2026-02-09'::date, 'E2026020905419'::text, 'Delivered'::text, 'EB090642371KR'::text),
  ('Alexis Beasley',                  '2026-02-09',       'E2026020905420',       'Delivered',       'EB090642385KR'),
  ('Kristen Jones',                   '2026-02-09',       'E2026020905421',       'Delivered',       'EB090642399KR'),
  ('Stephanie Perez',                 '2026-02-09',       'E2026020905422',       'Delivered',       'EB090642408KR'),
  ('Charity Luster',                  '2026-02-09',       'E2026020905423',       'Delivered',       'EB090642411KR'),
  ('Elssie Lee',                      '2026-02-09',       'E2026020905424',       'Delivered',       'EB090642425KR'),
  ('Luna Malfabon',                   '2026-02-09',       'E2026020905425',       'Delivered',       'EB090642439KR'),
  ('Anika Fong',                      '2026-02-09',       'E2026020905426',       'Delivered',       'EB090642442KR'),
  ('Heather Jannett',                 '2026-02-09',       'E2026020905427',       'Delivered',       'EB090642456KR'),
  ('Marni Gold',                      '2026-02-09',       'E2026020905428',       'Delivered',       'EB090642460KR'),
  ('Jade Tillman',                    '2026-02-09',       'E2026020905429',       'Delivered',       'EB090642473KR'),
  ('Alicia Cruz',                     '2026-02-09',       'E2026020905430',       'Delivered',       'EB090642487KR'),
  ('Renu Taman',                      '2026-02-09',       'E2026020905431',       'Delivered',       'EB090642495KR'),
  ('Brianna Potts',                   '2026-02-09',       'E2026020905432',       'Delivered',       'EB090642500KR'),
  ('Kelly Messier',                   '2026-02-09',       'E2026020905433',       'Delivered',       'EB090642513KR'),
  ('Brieanna Welch-Chenier',          '2026-02-09',       'E2026020905434',       'Delivered',       'EB090642527KR'),
  ('Heather Johnson',                 '2026-02-09',       'E2026020905435',       'Delivered',       'EB090642535KR'),
  ('Judy Shin',                       '2026-02-09',       'E2026020905436',       'Delivered',       'EB090642544KR'),
  ('Tina Angelina',                   '2026-02-09',       'E2026020905437',       'Delivered',       'EB090642558KR'),
  ('Lauren Mack',                     '2026-02-09',       'E2026020905438',       'Delivered',       'EB090642561KR'),
  ('Kelsey Apodaca',                  '2026-02-09',       'E2026020905439',       'Delivered',       'EB090642575KR'),
  ('Yohanna Urena',                   '2026-02-09',       'E2026020905440',       'Delivered',       'EB090642589KR'),
  ('Kelsey Nash',                     '2026-02-09',       'E2026020905441',       'Delivered',       'EB090642592KR'),
  ('Olivia Rinaldo',                  '2026-02-09',       'E2026020905442',       'Delivered',       'EB090642601KR'),
  ('Asia Monique Mays',               '2026-02-09',       'E2026020905443',       'Delivered',       'EB090642615KR'),
  ('Cindy Gahr',                      '2026-02-09',       'E2026020905444',       'Delivered',       'EB090642629KR'),
  ('Britta Fernandes',                '2026-02-09',       'E2026020905445',       'Delivered',       'EB090642632KR'),
  ('Ruth Escamilla',                  '2026-02-09',       'E2026020905446',       'Delivered',       'EB090642646KR'),
  ('Heather G. Bursey',               '2026-02-09',       'E2026020905447',       'Delivered',       'EB090642650KR'),
  ('Rebecca Parker',                  '2026-02-09',       'E2026020905448',       'Delivered',       'EB090642663KR'),
  ('Morchelle Plange',                '2026-02-09',       'E2026020905449',       'Delivered',       'EB090642677KR'),
  ('Chelsea Rojas',                   '2026-02-09',       'E2026020905450',       'Delivered',       'EB090642685KR'),
  ('Jordann La Fleur',                '2026-02-09',       'E2026020905451',       'Delivered',       'EB090642694KR'),
  ('Jessica Giang',                   '2026-02-09',       'E2026020905452',       'Delivered',       'EB090642703KR'),
  ('Nicole Lorenzo',                  '2026-02-09',       'E2026020905453',       'Delivered',       'EB090642717KR'),
  ('Soolin Hong',                     '2026-02-09',       'E2026020905454',       'Delivered',       'EB090642725KR'),
  ('Sara Smith-Pena',                 '2026-02-09',       'E2026020905455',       'Delivered',       'EB090642734KR'),
  ('Jone Karan',                      '2026-02-09',       'E2026020905456',       'Delivered',       'EB090642748KR'),
  ('Anahi Macias',                    '2026-02-09',       'E2026020905457',       'Delivered',       'EB090642751KR'),
  ('Somnang Dork',                    '2026-02-09',       'E2026020905458',       'Delivered',       'EB090642765KR'),
  ('Averie Seno',                     '2026-02-09',       'E2026020905459',       'Delivered',       'EB090642779KR'),
  ('Jamari Johnson',                  '2026-02-09',       'E2026020905460',       'Delivered',       'EB090642782KR'),
  ('Ridaina Inayat',                  '2026-02-09',       'E2026020905461',       'Delivered',       'EB090642796KR'),
  ('Sabina Gurung',                   '2026-02-09',       'E2026020905462',       'Delivered',       'EB090642805KR'),
  ('Joan Kosisky',                    '2026-02-09',       'E2026020905463',       'Delivered',       'EB090642819KR'),
  ('Lauren Tressler',                 '2026-02-09',       'E2026020905464',       'Delivered',       'EB090642822KR'),
  ('Amanda Morrow',                   '2026-02-09',       'E2026020905465',       'Delivered',       'EB090642836KR'),
  ('Derek Deng',                      '2026-02-09',       'E2026020905466',       'Delivered',       'EB090642840KR'),
  ('Bust',                            '2026-02-09',       'E2026020905467',       'Delivered',       'EB090642853KR'),
  ('Dianna Singh',                    '2026-02-09',       'E2026020905468',       'Delivered',       'EB090642867KR'),
  -- March 2026 second shipment (4 influencers)
  ('Alexis Beasley',                  '2026-03-09',       'E2026030902046',       'Delivered',       'EB091377806KR'),
  ('Stephanie Perez',                 '2026-03-09',       'E2026030902427',       'Delivered',       'EB091380133KR'),
  ('Anika Fong',                      '2026-03-09',       'E2026030902463',       'Delivered',       'EB091380354KR'),
  ('Lauren Mack',                     '2026-03-09',       'E2026030902512',       'Delivered',       'EB091380751KR')
)
INSERT INTO ems_tracking (confirmed_influencer_id, registered_date, application_number, status, ems_number)
SELECT ci.id, s.registered_date, s.application_number, s.status, s.ems_number
FROM seed s
JOIN influencers i ON LOWER(i.display_name) = LOWER(s.lookup_name)
                   OR LOWER(i.handle)       = LOWER(s.lookup_name)
JOIN confirmed_influencers ci ON ci.influencer_id = i.id
WHERE NOT EXISTS (
  SELECT 1 FROM ems_tracking et
  WHERE et.application_number = s.application_number
);

-- All rows currently marked 접수완료 → Delivered
UPDATE ems_tracking
SET status = 'Delivered'
WHERE status = '접수완료';

-- ============================================================
--  monitoring — fix FK to reference influencer_platform (not confirmed_influencers)
--  Run this once if not already done
-- ============================================================
ALTER TABLE monitoring DROP CONSTRAINT IF EXISTS monitoring_influencer_platform_id_fkey;
ALTER TABLE monitoring ADD CONSTRAINT monitoring_influencer_platform_id_fkey
  FOREIGN KEY (influencer_platform_id) REFERENCES influencer_platform(id);

-- Delete any rows inserted with wrong confirmed_influencer_id values
DELETE FROM monitoring m
WHERE NOT EXISTS (
  SELECT 1 FROM influencer_platform ip WHERE ip.id = m.influencer_platform_id
);

-- ============================================================
--  monitoring — add missing Instagram platform entries
--  (some influencers post on both TikTok & Instagram)
--  Run these 5 inserts first, then run the seed below.
-- ============================================================
INSERT INTO influencer_platform (confirmed_influencer_id, platform, handle)
SELECT ip.confirmed_influencer_id, 'Instagram', 'crazybeautifulmakeup'
FROM influencer_platform ip
WHERE LOWER(ip.handle) = 'crazybeautifulmakeup' AND LOWER(ip.platform) = 'tiktok'
  AND NOT EXISTS (SELECT 1 FROM influencer_platform x WHERE LOWER(x.handle) = 'crazybeautifulmakeup' AND LOWER(x.platform) = 'instagram');

INSERT INTO influencer_platform (confirmed_influencer_id, platform, handle)
SELECT ip.confirmed_influencer_id, 'Instagram', 'itskristv'
FROM influencer_platform ip
WHERE LOWER(ip.handle) = 'itskristv' AND LOWER(ip.platform) = 'tiktok'
  AND NOT EXISTS (SELECT 1 FROM influencer_platform x WHERE LOWER(x.handle) = 'itskristv' AND LOWER(x.platform) = 'instagram');

INSERT INTO influencer_platform (confirmed_influencer_id, platform, handle)
SELECT ip.confirmed_influencer_id, 'Instagram', 'visualsbyaverie'
FROM influencer_platform ip
WHERE LOWER(ip.handle) = 'visualsbyaverie' AND LOWER(ip.platform) = 'tiktok'
  AND NOT EXISTS (SELECT 1 FROM influencer_platform x WHERE LOWER(x.handle) = 'visualsbyaverie' AND LOWER(x.platform) = 'instagram');

INSERT INTO influencer_platform (confirmed_influencer_id, platform, handle)
SELECT ip.confirmed_influencer_id, 'Instagram', 'jadiet'
FROM influencer_platform ip
WHERE LOWER(ip.handle) = 'jadetillman0'
  AND NOT EXISTS (SELECT 1 FROM influencer_platform x WHERE LOWER(x.handle) = 'jadiet');

INSERT INTO influencer_platform (confirmed_influencer_id, platform, handle)
SELECT ip.confirmed_influencer_id, 'Instagram', 'tinaangelinaa'
FROM influencer_platform ip
WHERE LOWER(ip.handle) = 'tinaangelinaaa'
  AND NOT EXISTS (SELECT 1 FROM influencer_platform x WHERE LOWER(x.handle) = 'tinaangelinaa');

-- ============================================================
--  monitoring — seed 50 review rows
--  Lookup: handle + platform → influencer_platform_id
--  'Lauren Tressler' matched by display_name (her TikTok handle differs)
--  Brands normalised to lowercase. Views '-' stored as NULL.
-- ============================================================
WITH seed (lookup_handle, lookup_platform, date, media, content, brand, review_link, views, likes, comments) AS (
  VALUES
  ('Faces.by.Jamari'::text,        'TikTok'::text,    '2026-02-18'::date, 'video'::text, 'unboxing'::text,     'mimuse'::text, 'https://www.tiktok.com/@faces.by.jamari/video/7608001718877457678?_r=1&_t=ZP-93ZaNpwNuKU'::text,                                                                                    200::integer, 11::integer,  3::integer),
  ('Faces.by.Jamari',               'TikTok',           '2026-03-03',       'video',       'review video',       'joodoc',       'https://www.tiktok.com/@faces.by.jamari/video/7612704178598694158?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                    670,          23,           21),
  ('Faces.by.Jamari',               'TikTok',           '2026-03-04',       'photo',       'etc',                'nesh',         'https://www.tiktok.com/@faces.by.jamari/photo/7613067077221354782?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                    203,          21,           16),
  ('_morchelle',                    'TikTok',           '2026-03-16',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@_morchelle/video/7617588792630709534?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                         878,          117,          9),
  ('505afrolatina.barbiee',         'TikTok',           '2026-02-27',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@505afrolatina.barbiee/video/7611293188099296543?_r=1&_t=ZP-92rbZcxzzrD',                                                                                    199,          11,           4),
  ('505afrolatina.barbiee',         'TikTok',           '2026-03-14',       'video',       'review video',       'nesh',         'https://www.tiktok.com/@505afrolatina.barbiee/video/7616841387882941727?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                              192,          10,           1),
  ('505afrolatina.barbiee',         'TikTok',           '2026-04-02',       'video',       'etc',                'joodoc',       'https://www.tiktok.com/@505afrolatina.barbiee/video/7623888365041077534',                                                                                                           206,          28,           2),
  ('505afrolatina.barbiee',         'TikTok',           '2026-04-09',       'video',       'review video',       'joodoc',       'https://www.tiktok.com/@505afrolatina.barbiee/video/7626533706429189407?_r=1&_t=ZP-92rbZcxzzrD',                                                                                    127,          6,            1),
  ('Anahiiv._',                     'TikTok',           '2026-03-18',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@anahiiv._/video/7618330206591257869?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                          642,          151,          13),
  ('anikafong',                     'TikTok',           '2026-03-30',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@anikafong/video/7622878040212770061?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                          529,          50,           2),
  ('crazybeautifulmakeup',          'TikTok',           '2026-02-26',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@crazybeautifulmakeup/video/7610884068388900127',                                                                                                             200,          19,           11),
  ('crazybeautifulmakeup',          'Instagram',        '2026-02-26',       'video',       'unboxing',           'mimuse',       'https://www.instagram.com/reel/DVMVDXsDx-N/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==',                                                                                    251,          18,           7),
  ('Dainaxox',                      'TikTok',           '2026-03-12',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@dainaxox/video/7616134318636764429',                                                                                                                        380,          91,           51),
  ('hearherix',                     'TikTok',           '2026-03-19',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@heatherix/video/7618657463025372446',                                                                                                                       341,          22,           0),
  ('itskristv',                     'TikTok',           '2026-03-17',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@itskristv/video/7618034128235121934',                                                                                                                       226,          13,           0),
  ('itskristv',                     'TikTok',           '2026-03-19',       'video',       'review video',       'joodoc',       'https://www.tiktok.com/@itskristv/video/7618756315069926670',                                                                                                                       423,          43,           4),
  ('itskristv',                     'Instagram',        '2026-03-19',       'video',       'review video',       'joodoc',       'https://www.instagram.com/p/DWC8JRWoAfL/',                                                                                                                                         484,          27,           6),
  ('jadetillman0',                  'TikTok',           '2026-02-25',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@jadetillman0/video/7610487335435750686',                                                                                                                    917,          55,           13),
  ('jadetillman0',                  'TikTok',           '2026-02-27',       'video',       'review video',       'aesthen',      'https://www.tiktok.com/@jadetillman0/video/7611295160890166558',                                                                                                                    840,          43,           4),
  ('jadetillman0',                  'TikTok',           '2026-03-04',       'video',       'review video',       'varuza',       'https://www.tiktok.com/@jadetillman0/video/7613420357109681439',                                                                                                                    174,          12,           5),
  ('jadetillman0',                  'TikTok',           '2026-03-28',       'video',       'review video',       'joodoc',       'https://www.tiktok.com/@jadetillman0/video/7621618776974363935?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                       125,          16,           2),
  ('jadetillman0',                  'TikTok',           '2026-03-29',       'photo',       'etc',                'nesh',         'https://www.tiktok.com/@jadetillman0/photo/7621005574725045534?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                       129,          12,           1),
  ('jadiet',                        'Instagram',        '2026-02-28',       'photo',       'etc',                'mimuse',       'https://www.instagram.com/p/DVRsCybksNI/?img_index=6',                                                                                                                              NULL,         7,            0),
  ('jadiet',                        'Instagram',        '2026-03-27',       'video',       'review video',       'joodoc',       'https://www.instagram.com/p/DWWysAIEbDO/',                                                                                                                                         229,          4,            0),
  ('kelly_anne_81',                 'TikTok',           '2026-03-16',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@kelly_anne_81/video/7617550228098387213?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                      253,          36,           10),
  ('Kelsey.skincareee',             'TikTok',           '2026-02-28',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@kelsey.skincareee/video/7611403403024928031?_r=1&_t=ZP-91m64Z9vqes',                                                                                        184,          21,           11),
  ('Kelsey.skincareee',             'TikTok',           '2026-03-03',       'video',       'review video',       'varuza',       'https://www.tiktok.com/@kelsey.skincareee/video/7612906452155419935?_r=1&_t=ZP-91m64Z9vqes',                                                                                        182,          22,           0),
  ('Kelsey.skincareee',             'TikTok',           '2026-03-06',       'video',       'review video',       'aesthen',      'https://www.tiktok.com/@kelsey.skincareee/video/7614003202706459935',                                                                                                               127,          12,           0),
  ('Kelsey.skincareee',             'TikTok',           '2026-03-14',       'photo',       'etc',                'varuza',       'https://www.tiktok.com/@kelsey.skincareee/photo/7616960348821720350?_r=1&_t=ZP-91m64Z9vqes',                                                                                        213,          11,           4),
  ('Kelsey.skincareee',             'TikTok',           '2026-03-17',       'video',       'review video',       'nesh',         'https://www.tiktok.com/@kelsey.skincareee/video/7618075475272813855?_r=1&_t=ZP-91m64Z9vqes',                                                                                        178,          12,           4),
  ('Kelsey.skincareee',             'TikTok',           '2026-03-18',       'video',       'review video',       'varuza',       'https://www.tiktok.com/@kelsey.skincareee/video/7618444980574555423?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                  160,          19,           2),
  ('Kelsey.skincareee',             'TikTok',           '2026-03-25',       'video',       'review video',       'varuza',       'https://www.tiktok.com/@kelsey.skincareee/video/7620673340067433759?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                  142,          11,           0),
  ('Lauren Tressler',               'TikTok',           '2026-03-05',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@lauren_mt904/video/7613534489939053855?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                       376,          106,          69),
  ('Lauren Tressler',               'TikTok',           '2026-03-07',       'photo',       'unboxing',           'mimuse',       'https://www.tiktok.com/@lauren_mt904/photo/7614196521197767966?_r=1&_t=8fxlQw64TVf',                                                                                               678,          113,          81),
  ('losernamedl',                   'TikTok',           '2026-03-12',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@losernamedl/video/7616084346432130335',                                                                                                                     221,          10,           0),
  ('renu_tamang22',                 'TikTok',           '2026-03-08',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@renu_tamang22/video/7614791630238829854',                                                                                                                    224,          23,           6),
  ('renu_tamang22',                 'TikTok',           '2026-03-08',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@renu_tamang22/video/7614795680560811295',                                                                                                                    300,          30,           4),
  ('tinaangelinaa',                 'Instagram',        '2026-02-22',       'photo',       'unboxing',           'mimuse',       'https://www.instagram.com/p/DVCQTnkj6uW/?img_index=1',                                                                                                                              NULL,         168,          42),
  ('tinaangelinaaa',                'TikTok',           '2026-02-22',       'photo',       'etc',                'mimuse',       'https://www.tiktok.com/@tinaangelinaaa/photo/7609426112984206606',                                                                                                                   379,          26,           0),
  ('tinaangelinaaa',                'TikTok',           '2026-03-03',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@tinaangelinaaa/video/7612751422823714061?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                      350,          35,           4),
  ('visualsbyaverie',               'TikTok',           '2026-03-01',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@visualsbyaverie/video/7612042978386906382?_r=1&_t=ZT-93ZXi60Ewr0',                                                                                          243,          37,           13),
  ('visualsbyaverie',               'Instagram',        '2026-03-01',       'video',       'unboxing',           'mimuse',       'https://www.instagram.com/p/DVUW8buEuGs/',                                                                                                                                         391,          21,           17),
  ('yohannauc',                     'TikTok',           '2026-02-26',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@yohannauc/video/7610966674371546382',                                                                                                                       668,          58,           12),
  ('britta.loves',                  'TikTok',           '2026-03-31',       'video',       'review video',       'varuza',       'https://www.tiktok.com/@britta.loves/video/7622916718964264222?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                       701,          197,          2),
  ('britta.loves',                  'TikTok',           '2026-03-31',       'video',       'review video',       'joodoc',       'https://www.tiktok.com/@britta.loves/video/7622915719973342494',                                                                                                                    80,           6,            0),
  ('ladyluck779',                   'TikTok',           '2026-03-31',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@ladyluck779/video/7623048868174761247?is_from_webapp=1&sender_device=pc&web_id=7601058904848696853',                                                        273,          69,           22),
  ('charity_017',                   'TikTok',           '2026-04-06',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@charity_017/video/7625475714870971678',                                                                                                                     185,          11,           1),
  ('alohabriee',                    'TikTok',           '2026-04-22',       'video',       'unboxing',           'mimuse',       'https://www.tiktok.com/@alohabriee/video/7631355944999390495',                                                                                                                      424,          68,           35),
  ('a good hue',                    'magazine',         '2026-04-18',       'video',       'unboxing',           'mimuse',       'https://www.instagram.com/reel/DXQUacDDquX/',                                                                                                                                      359,          NULL,         8)
)
INSERT INTO monitoring (influencer_platform_id, date, media, content, brand, review_link, views, likes, comments)
SELECT ip.id, s.date, s.media, s.content, s.brand, s.review_link, s.views, s.likes, s.comments
FROM seed s
JOIN influencer_platform ip ON (
  LOWER(ip.handle) = LOWER(s.lookup_handle) AND LOWER(ip.platform) = LOWER(s.lookup_platform)
  OR (
    LOWER(ip.platform) = LOWER(s.lookup_platform)
    AND EXISTS (
      SELECT 1 FROM confirmed_influencers ci
      JOIN influencers i ON i.id = ci.influencer_id
      WHERE ci.id = ip.confirmed_influencer_id
        AND LOWER(i.display_name) = LOWER(s.lookup_handle)
    )
  )
)
WHERE ip.confirmed_influencer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM monitoring m WHERE m.review_link = s.review_link
  );

-- ============================================================
--  monitoring — phase_id (via influencer_platform → confirmed_influencers)
-- ============================================================
ALTER TABLE monitoring
  ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES phases(id) ON DELETE CASCADE;

UPDATE monitoring m
SET phase_id = ci.phase_id
FROM influencer_platform ip
JOIN confirmed_influencers ci ON ci.id = ip.confirmed_influencer_id
WHERE m.influencer_platform_id = ip.id
  AND m.phase_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_monitoring_phase ON monitoring(phase_id);

-- ============================================================
--  influencers — drop legacy contact_round (use contact_count)
-- ============================================================
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS contact_count INTEGER DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'influencers' AND column_name = 'contact_round'
  ) THEN
    UPDATE influencers SET contact_count = CASE
      WHEN contact_round IS NULL OR contact_round = '미컨택' THEN 0
      WHEN contact_round ~ '^[0-9]+차' THEN (regexp_match(contact_round, '^([0-9]+)'))[1]::INTEGER
      WHEN contact_round LIKE '%2차%' THEN 2
      WHEN contact_round LIKE '%1차%' THEN 1
      ELSE COALESCE(contact_count, 0)
    END;

    ALTER TABLE influencers DROP COLUMN contact_round;
  END IF;
END $$;

-- ============================================================
--  confirmed brand archive — assets + storage
-- ============================================================
CREATE TABLE IF NOT EXISTS confirmed_brand_archive_meta (
  confirmed_brand_id UUID PRIMARY KEY REFERENCES confirmed_brands(id) ON DELETE CASCADE,
  archive_memo       TEXT,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS confirmed_brand_assets (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  confirmed_brand_id UUID        NOT NULL REFERENCES confirmed_brands(id) ON DELETE CASCADE,
  category           TEXT        NOT NULL CHECK (category IN ('logo', 'product_main', 'product_sub', 'cutout', 'ingredients')),
  file_name          TEXT        NOT NULL,
  storage_path       TEXT        NOT NULL UNIQUE,
  file_size          INTEGER,
  mime_type          TEXT,
  label              TEXT,
  sort_order         INTEGER     DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_confirmed_brand_assets_brand
  ON confirmed_brand_assets(confirmed_brand_id);
CREATE INDEX IF NOT EXISTS idx_confirmed_brand_assets_brand_cat
  ON confirmed_brand_assets(confirmed_brand_id, category);

ALTER TABLE confirmed_brand_archive_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_brand_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_confirmed_brand_archive_meta" ON confirmed_brand_archive_meta;
CREATE POLICY "allow_all_confirmed_brand_archive_meta" ON confirmed_brand_archive_meta FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_confirmed_brand_assets" ON confirmed_brand_assets;
CREATE POLICY "allow_all_confirmed_brand_assets" ON confirmed_brand_assets FOR ALL USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('brand-archive', 'brand-archive', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "brand_archive_storage_all" ON storage.objects;
CREATE POLICY "brand_archive_storage_all" ON storage.objects
  FOR ALL USING (bucket_id = 'brand-archive') WITH CHECK (bucket_id = 'brand-archive');

-- ============================================================
--  outreach_messages — dedupe Outlook sync (see outreach_messages_dedup.sql)
-- ============================================================

ALTER TABLE outreach_messages ADD COLUMN IF NOT EXISTS outlook_message_id TEXT;
ALTER TABLE outreach_messages ADD COLUMN IF NOT EXISTS template_name TEXT;
ALTER TABLE outreach_messages ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL;

-- ============================================================
--  email_templates — influencer / brand / ems email templates
--  Run supabase/email_templates_schema.sql for DDL + default seed
-- ============================================================

ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
UPDATE email_templates SET name = title WHERE name = '' AND title <> '';

-- influencers — track imports from a previous phase (contact page)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS source_phase_id UUID REFERENCES phases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_influencers_source_phase ON influencers(source_phase_id);

-- contact reply timestamps — sort recently-replied rows to top
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_influencers_last_reply ON influencers(last_reply_at DESC NULLS LAST);
ALTER TABLE brand_general ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ;
ALTER TABLE brand_personal ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ;

-- influencers — Apify profile avatar URL (automation-lab tiktok-profile-scraper avatarUrl)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
