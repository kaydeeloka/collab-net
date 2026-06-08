-- ============================================================
--  MiMuse — Schema Alterations
--  Run individual blocks here to modify tables safely.
--  This file does NOT drop or recreate tables.
-- ============================================================

-- ============================================================
--  ADD COLUMN — copy a block and fill in the details
-- ============================================================

-- ALTER TABLE influencers           ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;
-- ALTER TABLE confirmed_influencers ADD COLUMN IF NOT EXISTS <column> <type> DEFAULT <default>;
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
