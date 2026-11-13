-- MiMuse dashboard demo data
-- Run in Supabase SQL Editor after supabase_migration.sql.
-- This uses a dedicated phase so demo rows never mix with a real campaign.
-- Re-running the script updates the same rows instead of creating duplicates.

BEGIN;

INSERT INTO phases (
  id, name, is_active, started_at, ended_at, kit_send_date, project_concept
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Demo · Dashboard',
  true,
  '2026-11-01',
  '2026-12-31',
  '2026-11-20',
  'Demo data for the MiMuse dashboard'
)
ON CONFLICT (id) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  started_at = EXCLUDED.started_at,
  ended_at = EXCLUDED.ended_at,
  kit_send_date = EXCLUDED.kit_send_date,
  project_concept = EXCLUDED.project_concept;

INSERT INTO app_config (key, value)
VALUES (
  'active_phase_id',
  '"00000000-0000-0000-0000-000000000001"'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

INSERT INTO influencers (
  id, phase_id, handle, display_name, email, followers, following,
  following_ratio, total_likes, video_count, engagement_rate, profile_url,
  status, contacted, created_at
) VALUES
  ('00000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'demo.glowbyava', 'Ava Kim', 'ava@example.com', 28400, 640, '2.25%', 812000, 142, 0.071, 'https://www.tiktok.com/@demo.glowbyava', 'yes', true, '2026-11-02'),
  ('00000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'demo.skinwithmia', 'Mia Park', 'mia@example.com', 19300, 410, '2.12%', 490000, 98, 0.064, 'https://www.tiktok.com/@demo.skinwithmia', 'reply', true, '2026-11-03'),
  ('00000000-0000-0000-0000-000000000013'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'demo.beautybyzoe', 'Zoe Lee', 'zoe@example.com', 12700, 520, '4.09%', 251000, 76, 0.052, 'https://www.tiktok.com/@demo.beautybyzoe', 'negotiate', true, '2026-11-04'),
  ('00000000-0000-0000-0000-000000000014'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'demo.routinebylia', 'Lia Chen', 'lia@example.com', 8600, 330, '3.84%', 174000, 61, 0.048, 'https://www.tiktok.com/@demo.routinebylia', 'target', false, '2026-11-05'),
  ('00000000-0000-0000-0000-000000000015'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'demo.glowwithnoa', 'Noa Smith', 'noa@example.com', 7200, 290, '4.03%', 138000, 54, 0.046, 'https://www.tiktok.com/@demo.glowwithnoa', 'target', false, '2026-11-06'),
  ('00000000-0000-0000-0000-000000000016'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'demo.kbeautywithsam', 'Sam Rivera', 'sam@example.com', 5600, 250, '4.46%', 92000, 42, 0.041, 'https://www.tiktok.com/@demo.kbeautywithsam', 'target', false, '2026-11-07')
ON CONFLICT (id) DO UPDATE SET
  handle = EXCLUDED.handle,
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  followers = EXCLUDED.followers,
  following = EXCLUDED.following,
  following_ratio = EXCLUDED.following_ratio,
  total_likes = EXCLUDED.total_likes,
  video_count = EXCLUDED.video_count,
  engagement_rate = EXCLUDED.engagement_rate,
  profile_url = EXCLUDED.profile_url,
  status = EXCLUDED.status,
  contacted = EXCLUDED.contacted;

INSERT INTO confirmed_influencers (
  id, phase_id, influencer_id, email, upload_status, form_submitted, platform, seq
) VALUES
  ('00000000-0000-0000-0000-000000000021'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000011'::uuid, 'ava@example.com', 'Delivered', true, 'TikTok', 1),
  ('00000000-0000-0000-0000-000000000022'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000012'::uuid, 'mia@example.com', 'In Transit', true, 'TikTok', 2),
  ('00000000-0000-0000-0000-000000000023'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000013'::uuid, 'zoe@example.com', 'Exception', true, 'TikTok', 3),
  ('00000000-0000-0000-0000-000000000024'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000014'::uuid, 'lia@example.com', 'Pending', false, 'TikTok', 4)
ON CONFLICT (id) DO UPDATE SET
  upload_status = EXCLUDED.upload_status,
  form_submitted = EXCLUDED.form_submitted,
  seq = EXCLUDED.seq;

INSERT INTO influencer_platform (id, confirmed_influencer_id, platform, handle, followers, profile_url) VALUES
  ('00000000-0000-0000-0000-000000000031'::uuid, '00000000-0000-0000-0000-000000000021'::uuid, 'TikTok', 'demo.glowbyava', 28400, 'https://www.tiktok.com/@demo.glowbyava'),
  ('00000000-0000-0000-0000-000000000032'::uuid, '00000000-0000-0000-0000-000000000022'::uuid, 'TikTok', 'demo.skinwithmia', 19300, 'https://www.tiktok.com/@demo.skinwithmia'),
  ('00000000-0000-0000-0000-000000000033'::uuid, '00000000-0000-0000-0000-000000000023'::uuid, 'TikTok', 'demo.beautybyzoe', 12700, 'https://www.tiktok.com/@demo.beautybyzoe'),
  ('00000000-0000-0000-0000-000000000034'::uuid, '00000000-0000-0000-0000-000000000024'::uuid, 'TikTok', 'demo.routinebylia', 8600, 'https://www.tiktok.com/@demo.routinebylia')
ON CONFLICT (id) DO UPDATE SET
  handle = EXCLUDED.handle,
  followers = EXCLUDED.followers,
  profile_url = EXCLUDED.profile_url;

INSERT INTO ems_tracking (
  id, confirmed_influencer_id, phase_id, ems_number, registered_date, status, last_update
) VALUES
  ('00000000-0000-0000-0000-000000000041'::uuid, '00000000-0000-0000-0000-000000000021'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'DEMO100001', '2026-11-08', 'Delivered', '2026-11-12'),
  ('00000000-0000-0000-0000-000000000042'::uuid, '00000000-0000-0000-0000-000000000022'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'DEMO100002', '2026-11-09', 'In Transit', '2026-11-12'),
  ('00000000-0000-0000-0000-000000000043'::uuid, '00000000-0000-0000-0000-000000000023'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'DEMO100003', '2026-11-10', 'Exception', '2026-11-12'),
  ('00000000-0000-0000-0000-000000000044'::uuid, '00000000-0000-0000-0000-000000000024'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'DEMO100004', '2026-11-11', 'Preparing', '2026-11-11')
ON CONFLICT (id) DO UPDATE SET
  ems_number = EXCLUDED.ems_number,
  registered_date = EXCLUDED.registered_date,
  status = EXCLUDED.status,
  last_update = EXCLUDED.last_update;

INSERT INTO brand_contacts (
  id, phase_id, brand_name, brand_en, company, email, product_category,
  overseas, status, contacted, send_count, reply_count
) VALUES
  ('00000000-0000-0000-0000-000000000051'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '루미나', 'Lumina', 'Lumina Beauty', ARRAY['hello@lumina.example'], 'Skincare', true, 'yes', true, 1, 0),
  ('00000000-0000-0000-0000-000000000052'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '어반글로우', 'Urban Glow', 'Urban Glow Inc.', ARRAY['partnerships@urbanglow.example'], 'Makeup', true, 'reply', true, 1, 1),
  ('00000000-0000-0000-0000-000000000053'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '세이지랩', 'Sage Lab', 'Sage Lab Co.', ARRAY['team@sagelab.example'], 'Haircare', true, 'positive', true, 1, 1),
  ('00000000-0000-0000-0000-000000000054'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '포레스트온', 'Forest On', 'Forest On', ARRAY['hello@foreston.example'], 'Bodycare', false, 'target', false, 0, 0),
  ('00000000-0000-0000-0000-000000000055'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '클라우드나인', 'Cloud Nine', 'Cloud Nine Beauty', ARRAY['hello@cloudnine.example'], 'Skincare', true, 'target', false, 0, 0)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  contacted = EXCLUDED.contacted,
  send_count = EXCLUDED.send_count,
  reply_count = EXCLUDED.reply_count;

INSERT INTO confirmed_brands (id, phase_id, brand_name, contact_name, email, product, received)
VALUES
  ('00000000-0000-0000-0000-000000000061'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '루미나', 'Jina Lee', 'hello@lumina.example', 'Barrier Cream', true),
  ('00000000-0000-0000-0000-000000000062'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '어반글로우', 'Chris Park', 'partnerships@urbanglow.example', 'Glow Tint', false)
ON CONFLICT (id) DO UPDATE SET
  contact_name = EXCLUDED.contact_name,
  email = EXCLUDED.email,
  product = EXCLUDED.product,
  received = EXCLUDED.received;

INSERT INTO monitoring (
  id, influencer_platform_id, phase_id, date, media, content, brand, review_link, views, likes, comments
) VALUES
  ('00000000-0000-0000-0000-000000000071'::uuid, '00000000-0000-0000-0000-000000000031'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '2026-11-10', 'video', 'unboxing', 'mimuse', 'https://example.com/demo-review-1', 12400, 840, 62),
  ('00000000-0000-0000-0000-000000000072'::uuid, '00000000-0000-0000-0000-000000000032'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '2026-11-11', 'video', 'review video', 'mimuse', 'https://example.com/demo-review-2', 8700, 512, 38),
  ('00000000-0000-0000-0000-000000000073'::uuid, '00000000-0000-0000-0000-000000000033'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '2026-11-11', 'photo', 'routine', 'mimuse', 'https://example.com/demo-review-3', 4200, 290, 21),
  ('00000000-0000-0000-0000-000000000074'::uuid, '00000000-0000-0000-0000-000000000034'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '2026-11-12', 'video', 'review video', '루미나', 'https://example.com/demo-brand-review-1', 6300, 410, 19),
  ('00000000-0000-0000-0000-000000000075'::uuid, '00000000-0000-0000-0000-000000000031'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '2026-11-12', 'video', 'review video', '어반글로우', 'https://example.com/demo-brand-review-2', 5100, 330, 17)
ON CONFLICT (id) DO UPDATE SET
  date = EXCLUDED.date,
  media = EXCLUDED.media,
  content = EXCLUDED.content,
  brand = EXCLUDED.brand,
  review_link = EXCLUDED.review_link,
  views = EXCLUDED.views,
  likes = EXCLUDED.likes,
  comments = EXCLUDED.comments;

INSERT INTO monitoring_keywords (phase_id, brand, keywords)
VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, '루미나', ARRAY['barrier cream', 'glass skin']),
  ('00000000-0000-0000-0000-000000000001'::uuid, '어반글로우', ARRAY['glow tint', 'dewy makeup'])
ON CONFLICT (phase_id, brand) DO UPDATE SET keywords = EXCLUDED.keywords;

INSERT INTO beauty_news_archives (
  id, windows_start, windows_end, report_title, categories, keywords
) VALUES (
  '00000000-0000-0000-0000-000000000081'::uuid,
  '2026-11-09',
  '2026-11-15',
  '이번 주 뷰티 브리핑 — Demo',
  '[{"emoji":"🧴","name":"스킨케어","count":2,"items":[{"title":"Barrier-first routines gain momentum","source":"Demo insight"}]}]'::jsonb,
  '[{"tag":"#BarrierFirst","explanation":"피부 장벽 케어와 보습 루틴이 미국 뷰티 크리에이터 콘텐츠에서 주목받고 있습니다."},{"tag":"#GlowTint","explanation":"가볍고 촉촉한 베이스 메이크업 제품이 데일리 콘텐츠의 핵심 포맷으로 자리 잡고 있습니다."}]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  windows_start = EXCLUDED.windows_start,
  windows_end = EXCLUDED.windows_end,
  report_title = EXCLUDED.report_title,
  categories = EXCLUDED.categories,
  keywords = EXCLUDED.keywords;

COMMIT;
