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

-- confirmed_influencers — Google Form data
-- NOTE: handle, display_name, email, profile_url (account_url) and platform
--       are fetched via JOIN on influencer_id — do not duplicate here
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS repost         TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS phone          TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS content_type   TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS address_line_1 TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS address_line_2 TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS city           TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS state          TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS zip            TEXT;
ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS country        TEXT;

-- ALTER TABLE ems_tracking          ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;
-- ALTER TABLE monitoring            ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;
-- ALTER TABLE outreach_messages     ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;
-- ALTER TABLE beauty_news_archives  ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;
-- ALTER TABLE email_recipients      ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;
-- ALTER TABLE phases                ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;
-- ALTER TABLE tiers                 ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;

-- ============================================================
--  DROP COLUMN
-- ============================================================

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

-- ALTER TABLE influencers RENAME COLUMN <old_name> TO <new_name>;

-- ============================================================
--  CHANGE COLUMN TYPE
-- ============================================================

-- ALTER TABLE influencers ALTER COLUMN <column> TYPE <new_type> USING <column>::<new_type>;

-- ============================================================
--  SEED / UPDATE DATA
-- ============================================================

-- Seed: confirmed influencers (outreach = 'accept')
INSERT INTO influencers (created_at, phase_id, platform, handle, display_name, followers, outreach)
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
  outreach     = EXCLUDED.outreach;

-- Run this immediately after the INSERT above to sync confirmed_influencers
INSERT INTO confirmed_influencers (influencer_id, phase_id, email, upload_status)
SELECT i.id, i.phase_id, i.email, 'Pending'
FROM influencers i
WHERE i.outreach = 'accept'
  AND NOT EXISTS (
    SELECT 1 FROM confirmed_influencers c WHERE c.influencer_id = i.id
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
--  POST-IMPORT UTILITIES
-- ============================================================

-- Add unique constraint on influencer_id (one confirmed row per influencer)
ALTER TABLE confirmed_influencers ADD CONSTRAINT confirmed_influencers_influencer_id_key UNIQUE (influencer_id);

-- Backfill confirmed_influencers for influencers already marked 'accept'
INSERT INTO confirmed_influencers (influencer_id, phase_id, email, upload_status)
SELECT i.id, i.phase_id, i.email, 'Pending'
FROM influencers i
WHERE i.outreach = 'accept'
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
