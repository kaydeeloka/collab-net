-- ============================================================
--  ems_reshipments — 재발송 table
--
--  ems_tracking.status           → carrier (접수완료 | Preparing | In Transit | Delivered | Exception)
--  ems_reshipments.status        → workflow (처리 대기 | 처리 중 | 확인 중 | 재발송 예정 | 재발송 완료)
--  ems_reshipments.carrier_status → carrier for the NEW shipment
-- ============================================================

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
