-- ============================================================
--  outreach_messages — optional outbound send log + cleanup
--  Run in Supabase SQL Editor
--
--  Usage: log outbound sends only (발송). Reply sync updates influencers only.
-- ============================================================

ALTER TABLE outreach_messages
  ADD COLUMN IF NOT EXISTS outlook_message_id TEXT;

ALTER TABLE outreach_messages
  ADD COLUMN IF NOT EXISTS template_name TEXT;

ALTER TABLE outreach_messages
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL;

-- Remove old inbound auto-sync rows (reply state lives on influencers table)
DELETE FROM outreach_messages WHERE direction = 'inbound';

-- Optional: remove duplicate outbound rows (same influencer + subject + sent_at)
DELETE FROM outreach_messages a
USING outreach_messages b
WHERE a.id > b.id
  AND a.direction = 'outbound'
  AND b.direction = 'outbound'
  AND a.influencer_id = b.influencer_id
  AND a.sent_at IS NOT DISTINCT FROM b.sent_at
  AND a.subject IS NOT DISTINCT FROM b.subject;
