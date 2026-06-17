-- ============================================================
--  email_templates — shared templates for influencer / brand / ems
--  Run in: Supabase Dashboard → SQL Editor
--
--  Columns:
--    name  — template label (sidebar / dropdown, e.g. "1차 기프트 리마인더")
--    title — email subject line sent to recipient (may include {{이름}} etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  domain      TEXT        NOT NULL CHECK (domain IN ('influencer', 'brand', 'ems')),
  name        TEXT        NOT NULL,
  title       TEXT        NOT NULL DEFAULT '',
  body        TEXT        NOT NULL DEFAULT '',
  category    TEXT        NOT NULL DEFAULT '기타',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_default  BOOLEAN     NOT NULL DEFAULT false,
  is_active   BOOLEAN     NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_email_templates_domain ON email_templates(domain);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_domain_name
  ON email_templates(domain, name)
  WHERE is_active = true;

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_email_templates" ON email_templates;
CREATE POLICY "allow_all_email_templates" ON email_templates
  FOR ALL USING (true) WITH CHECK (true);

-- Seed defaults (skip if domain already has rows)
INSERT INTO email_templates (domain, name, title, body, category, sort_order, is_default)
SELECT v.domain, v.name, v.title, v.body, v.category, v.sort_order, true
FROM (VALUES
  ('influencer', '신제품 기프트 제안', '[MiMuse] {{이름}}님, 미뮤즈 신제품 VIP 기프트 증정 제안',
   E'안녕하세요 {{이름}}님!\n프리미엄 뷰티 브랜드 MiMuse(미뮤즈) 글로벌 커뮤니케이션 팀입니다.\n\n평소 {{이름}}님의 TikTok 채널({{핸들}})을 통해 전달하시는 세련된 감성과 독창적인 리뷰 스타일에 깊은 인상을 받았습니다.\n\n이번 론칭하는 수분 세럼 패키지를 맞이하여 기프팅 선물을 전달드리고자 메일 드립니다.\n\n배송을 위해 성함, 연락처, 배송 정보를 회신 주시면 조속히 발송하겠습니다.\n\nMiMuse 드림.',
   '첫 컨택', 1),
  ('influencer', '1차 기프트 리마인더', '[MiMuse] {{이름}}님, 이전 기프트 패키지 증정 관련 재문의',
   E'안녕하세요 {{이름}}님, MiMuse 글로벌 팀입니다.\n\n이전 메일을 통해 전달해 드렸던 신제품 선물 기프팅 제안에 대해 재문의 드립니다.\n\n{{이름}}님 채널({{핸들}})이 저희 제품과 잘 어울릴 것 같아 특별히 연락드립니다.\n\n배송 정보를 회신 주시면 즉시 절차를 진행하겠습니다.\n감사합니다.',
   '리마인더', 2),
  ('brand', '협업 제안 (첫 컨택)', '[MiMuse] {{브랜드명}} 담당자님, 미뮤즈 협업 제안드립니다',
   E'안녕하세요 {{담당자}}님,\n\n프리미엄 뷰티 브랜드 MiMuse(미뮤즈) 글로벌 커뮤니케이션 팀입니다.\n\n{{브랜드명}}의 제품과 미뮤즈가 함께 시너지를 낼 수 있을 것이라 생각하여 협업을 제안드립니다.\n\n자세한 내용은 아래와 같으며, 검토 후 회신 주시면 감사하겠습니다.\n\n미뮤즈 드림.',
   '첫 컨택', 1),
  ('brand', '협업 리마인더', '[MiMuse] {{브랜드명}} 담당자님, 이전 협업 제안 관련 재문의',
   E'안녕하세요 {{담당자}}님, MiMuse 글로벌 팀입니다.\n\n이전에 발송드린 협업 제안 메일 관련하여 재문의 드립니다.\n\n{{브랜드명}}과의 협업에 여전히 큰 기대를 가지고 있으며, 편하실 때 회신 주시면 감사하겠습니다.\n\n감사합니다.',
   '리마인더', 2),
  ('ems', '기본 오류 안내', '[MiMuse] 배송 오류 안내 — {운송장번호}',
   E'안녕하세요, {이름}님.\n\nMiMuse 팀입니다.\n\n{이름}님께 발송된 패키지({운송장번호})의 배송 과정에서 문제가 발생하여 연락드립니다.\n\n■ 오류 내용: {오류_사유}\n■ 운송장 번호: {운송장번호}\n■ 발송일: {발송일}\n\n현재 해당 건을 확인 중이며, 빠른 시일 내에 재발송 또는 해결 방안을 안내해 드리겠습니다.\n불편을 드려 대단히 죄송합니다.\n\n감사합니다,\nMiMuse 팀',
   '초기 안내', 1),
  ('ems', '재발송 안내', '[MiMuse] 패키지 재발송 안내 — {이름}님',
   E'안녕하세요, {이름}님.\n\nMiMuse 팀입니다.\n\n이전 배송 오류로 인해 불편을 드린 점 진심으로 사과드립니다.\n아래와 같이 패키지를 재발송하였습니다.\n\n■ 새 운송장 번호: {새_운송장번호}\n■ 재발송일: {재발송일}\n■ 예상 도착일: {예상_도착일}\n\n이번에는 정상적으로 수령하실 수 있도록 최선을 다하겠습니다.\n궁금하신 점은 언제든지 연락해 주세요.\n\n감사합니다,\nMiMuse 팀',
   '재발송 안내', 2),
  ('ems', '반송 처리 완료', '[MiMuse] 반송 처리 완료 — {이름}님',
   E'안녕하세요, {이름}님.\n\nMiMuse 팀입니다.\n\n{이름}님의 패키지({운송장번호})가 반송 처리되어 저희 측에 도착하였습니다.\n\n■ 반송 도착일: {반송_도착일}\n■ 반송 사유: {오류_사유}\n\n빠른 시일 내에 재발송 일정을 안내드리겠습니다.\n불편을 드려 대단히 죄송합니다.\n\n감사합니다,\nMiMuse 팀',
   '반송 처리', 3)
) AS v(domain, name, title, body, category, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates et WHERE et.domain = v.domain
);
