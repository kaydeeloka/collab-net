-- ============================================================
--  beauty_news_archives — Seed data
--  Source: GAS PropertiesService BN_ARCH_* keys
--  Run in: Supabase Dashboard → SQL Editor → Run
--
--  Note on keywords shape:
--    Old entries sent keywords as a plain string.
--    New entries send an array of { tag, explanation }.
--    Both are valid JSONB. The template handles both.
-- ============================================================

INSERT INTO beauty_news_archives (windows_start, windows_end, report_title, categories, keywords)
VALUES

-- ── 2026-05-19 ────────────────────────────────────────────────
(
  '2026-05-19',
  '2026-05-19',
  '이번 주 뷰티 브리핑 — 2026년 05월 19일',
  '[
    {"name":"스킨케어","emoji":"🧴","count":1,"items":[
      {"title":"Multi-use viral skincare product beauty fans are using to simplify routines","source":"NationalWorld","link":"https://news.google.com/rss/articles/CBMi1gFBVV95cUxQMW9NMENoVFVDRnQwOFJmSzZWeEZkR3A0aFdBcDhERktZM2FRRUpCWU9lLWJRV1FlTTB1QS1sMnZ5Z0hONDNtMFhZaThERlptRTh6RzlsTk5DNWJpc2NYOGVrWUdRTDZKUGlhTDhwUWR2OTNtY01kajJWUF95alA5bEptemdhcVNXVnk1ZmdhUDFmNlo1SFNnY3ZBNlRqZHVhaENvRm43NVZuR1dxNlFUaGhJNmRpRHpCc2V3VXV1ZTdJWDZFUTRLTHhWblNTX3lSLW5GZVB3?oc=5","summary":"미국 소비자들은 지금 Multi-use 제품을 주목하고 있다. NationalWorld에 따르면 이 제품은 스킨케어 루틴을 단순화하는 데 도움이 된다. 한국 뷰티 브랜드는 이 트렌드를 활용하여 자체 Multi-use 제품을 출시하고 미국 시장에서 경쟁력을 높일 수 있다."}
    ]},
    {"name":"메이크업","emoji":"💋","count":1,"items":[
      {"title":"The Vogue Business Beauty Trend Tracker","source":"vogue.com","link":"https://news.google.com/rss/articles/CBMicEFVX3lxTE96eFRtR1g5NG15VmJxdk9GX3B1V1FJdWRDdkJPb1pHMWk3d2pwMV81WFBURlJxaHRadVZTWUFKR1VSc21KX1lyVTUxa2NSa05nRmxUU1FRb1hFVWNvc2hDZ25YYUQ0Y09jMzNhLTZuWGk?oc=5","summary":"현재 미국 소비자들은 자연성과 지속가능성을 강조하는 메이크업 브랜드와 제품에 관심을 보인다. Clean Beauty와 Sustainable Beauty를 강조하는 브랜드들이 인기를 끌고 있다."}
    ]},
    {"name":"퍼스널케어","emoji":"🚿","count":1,"items":[
      {"title":"The Vogue Business Beauty Trend Tracker","source":"vogue.com","link":"https://news.google.com/rss/articles/CBMicEFVX3lxTE96eFRtR1g5NG15VmJxdk9GX3B1V1FJdWRDdkJPb1pHMWk3d2pwMV81WFBURlJxaHRadVZTWUFKR1VSc21KX1lyVTUxa2NSa05nRmxUU1FRb1hFVWNvc2hDZ25YYUQ0Y09jMzNhLTZuWGk?oc=5","summary":"The Vogue Business Beauty Trend Tracker에 따르면 미국 소비자들은 자연성분을 강조하는 브랜드와 제품에 관심을 보인다. 스킨케어 루틴에서 자연성분을 강조하는 제품이 인기다."}
    ]},
    {"name":"K-뷰티","emoji":"🇰🇷","count":3,"items":[
      {"title":"[PHOTO] Ulta Beauty meets K-beauty","source":"The Korea Times","link":"https://news.google.com/rss/articles/CBMimAFBVV95cUxQOG9JS09WclNJaVhMc1V5SFc0SGJhdjNhVGMyMGw1UDE0NlVaZUU4ZFNNQlNNcC1tNGV6SmNaaTFES0RUWktCanE4YkZkakZkNlRnSFY1Ui1VYW84Wm1WN0d1al96UUlCdHMycWNjZVotSUZtbXBnaFdDMlFwTnpCQmtmVGRxLWpadEt5eW1nTVZJTXhwTUYwTdIBmAFB?oc=5","summary":"미국 소비자들은 현재 K-beauty의 자연성분과 글로우업 루틴에 주목한다. Ulta Beauty와 같은 미국 뷰티 리테일러들은 K-beauty 브랜드와 협력하고 있다."},
      {"title":"Your Guide to K-Beauty: Medicube, Dr. Groot and More Picks Worth the Hype","source":"TODAY.com","link":"https://news.google.com/rss/articles/CBMiekFVX3lxTE5pRWtfNmxFQ01KczlrR1JyaTBXNEFXVENmcU1kbnZGXzBNalU3MDd6R1FTMk5td25WaWd4RlBvcjFIcklOWnVoUGhiZ2l0dFg3WFd0blZ2cjJubGxTMWtFYm9rNlF2VXg5RExMeFZEdFpRUmg2LUl5WW9n?oc=5","summary":"미국 소비자들은 현재 K-뷰티 브랜드인 Medicube와 Dr. Groot를 주목하고 있다. 이들 브랜드는 자연성분과 과학적 연구를 결합한 제품을 제공하여 인기를 얻었다."},
      {"title":"TikTok viral Medicube beauty gadget slashed by more than £100 on Amazon","source":"NationalWorld","link":"https://news.google.com/rss/articles/CBMivgFBVV95cUxQUWRObnBPN2MzNFNIYnJXMGRrMHEtVXJKWWphdDhJc1ZtM25lb090TXhnQ0dsX3R2WUpPMUpicmFEdXVpQlNuZklwYy1JVFZIZjc4aGIwZ0p6ZllHT25wX1RGazRHWGViWXQtZWdscTBuRkR1Q2VLVS1KdHFCQ3pfNnZrakJHUXQyYzU1dVBZYmVuY2lUclN5S1dMa1UwNVdvWkthcFNaTlhFYkh1SGZKMWU0SWhyVUVSVHZ2MGJ3?oc=5","summary":"미국 소비자들은 현재 TikTok에서 인기 있는 Medicube 뷰티 가젯에 주목하고 있다. Amazon에서 할인 판매 중이다."}
    ]},
    {"name":"기타","emoji":"✨","count":0,"items":[]}
  ]'::jsonb,
  '[
    {"tag":"#MultiUseProduct","explanation":"소비자들이 스킨케어 루틴을 단순화하기 위해 하나의 제품으로 여러 기능을 수행하는 제품을 찾는 트렌드. 한국 브랜드는 이를 활용해 Multi-use 제품을 출시하고 미국 시장 경쟁력을 높일 수 있다."},
    {"tag":"#SustainablePackaging","explanation":"환경적으로 친화적인 패키지를 강조하는 트렌드. 소비자들이 제품의 환경적 영향에 관심을 가지고 있다."},
    {"tag":"#NaturalGlowUp","explanation":"자연적인 글로우업 루틴을 강조하는 트렌드. 소비자들이 자연적인 제품과 방법을 찾고 있다."}
  ]'::jsonb
),

-- ── 2026-05-22 ────────────────────────────────────────────────
(
  '2026-05-22',
  '2026-05-22',
  '이번 주 뷰티 브리핑 — 2026년 05월 22일',
  '[
    {"name":"스킨케어","emoji":"🧴","count":0,"items":[]},
    {"name":"메이크업","emoji":"💋","count":1,"items":[
      {"title":"The Vogue Business Beauty Trend Tracker","source":"Vogue","link":"https://news.google.com/rss/articles/CBMicEFVX3lxTE96eFRtR1g5NG15VmJxdk9GX3B1V1FJdWRDdkJPb1pHMWk3d2pwMV81WFBURlJxaHRadVZTWUFKR1VSc21KX1lyVTUxa2NSa05nRmxUU1FRb1hFVWNvc2hDZ25YYUQ0Y09jMzNhLTZuWGk?oc=5","summary":"최근 미국 뷰티 시장에서 Charlotte Tilbury의 Walk of Shame 같은 립스틱 제품들이 인기를 끌고 있으며, 틴트와 세럼, 마스크팩을 선호하는 경향이 있다."}
    ]},
    {"name":"퍼스널케어","emoji":"🚿","count":1,"items":[
      {"title":"The Vogue Business Beauty Trend Tracker","source":"Vogue","link":"https://news.google.com/rss/articles/CBMicEFVX3lxTE96eFRtR1g5NG15VmJxdk9GX3B1V1FJdWRDdkJPb1pHMWk3d2pwMV81WFBURlJxaHRadVZTWUFKR1VSc21KX1lyVTUxa2NSa05nRmxUU1FRb1hFVWNvc2hDZ25YYUQ0Y09jMzNhLTZuWGk?oc=5","summary":"Drunk Elephant의 Protini Polypeptide Cream이 출시됐다. 미국 소비자들은 히알루론산과 비타민C 함유 제품에 관심을 보이고 있으며 멀티 유즈 제품이 인기다."}
    ]},
    {"name":"K-뷰티","emoji":"🇰🇷","count":3,"items":[
      {"title":"Olive Young launches 1st US K-beauty store in California as Sephora and Ulta expand Korean skincare shelves","source":"koreabiomed.com","link":"https://news.google.com/rss/articles/CBMibkFVX3lxTE5hS0o2Si1UbVFnTndULTdOZF9uamFrMWgyOXctUjNOaVpkRGpUazF1SVhlQ3NvcEhYNVk3ZVNnQzRhaFlWZWhZTXdGM3VCVlE2R1FsNWxNTWJENk5zN1JMb2RFZ2FEMTBCYS1ZRVZn0gFy?oc=5","summary":"올리브영이 미국 캘리포니아에 첫 K-뷰티 매장을 오픈했다. 세포라와 울타는 한국 스킨케어 제품의 판매를 확대하고 있다."},
      {"title":"Landing International wraps first K-Beauty Week with Nasdaq closing bell ceremony","source":"The Korea Times","link":"https://news.google.com/rss/articles/CBMi1AFBVV95cUxPZ3Z2LW5jeGprVm5CS3FrRExXVkEtMzhqdGZvcGNaRjNGazVuMmQycW9nUXhzYUJuOVNsMTk5LTJhZ0NCbGlpd2g0VEJDaDU1RUl5RWNkZ1R3ZXlhN3k3NzNKSDd6djNSd1F0WUFIZmtfTDZhLVdVd2R5ck9KcEJxQ2RLLWJ3aWZjQ0hyZ2g2NGhtUEdLbGZUQlE0XzlTVW8yRVBvNi13Z2FLNnh6SHA3U1FrRjAzZk5WWVFJMFFzeTBfdHZlc25yZmVybThfTE5PMjNFYg?oc=5","summary":"K-뷰티 위크가 나스닥 종례 타종 행사로 마무리됐다. 미국 소비자들은 히알루론산 성분 제품과 피부 광채 루틴에 관심을 보인다."},
      {"title":"Your Guide to K-Beauty: Medicube, Dr. Groot and More Picks Worth the Hype","source":"TODAY.com","link":"https://news.google.com/rss/articles/CBMiekFVX3lxTE5pRWtfNmxFQ01KczlrR1JyaTBXNEFXVENmcU1kbnZGXzBNalU3MDd6R1FTMk5td25WaWd4RlBvcjFIcklOWnVoUGhiZ2l0dFg3WFd0blZ2cjJubGxTMWtFYm9rNlF2VXg5RExMeFZEdFpRUmg2LUl5WW9n?oc=5","summary":"Medicube, Dr. Groot 등이 미국 시장에서 주목받고 있다. 나이아신아미드, 히알루론산 성분 제품과 세럼, 립스틱을 선호하는 추세다."}
    ]},
    {"name":"기타","emoji":"✨","count":0,"items":[]}
  ]'::jsonb,
  '[
    {"tag":"#히알루론산멀티유즈제품","explanation":"히알루론산과 비타민C가 함유된 멀티유즈 제품이 인기. 보습 효과와 항산화 효과를 동시에 제공하는 제품 수요 증가."},
    {"tag":"#나이아신아미드루틴","explanation":"나이아신아미드 함유 제품에 대한 관심 증가. 피부 개선 효과와 안정성으로 인기."},
    {"tag":"#맞춤형스킨케어","explanation":"자신의 피부 타입과 고민에 맞는 맞춤형 스킨케어 제품 수요 증가."},
    {"tag":"#광채루틴","explanation":"건강하고 빛나는 피부를 위한 광채 루틴에 대한 관심 증가."}
  ]'::jsonb
),

-- ── 2026-05-26 ────────────────────────────────────────────────
(
  '2026-05-26',
  '2026-05-26',
  '이번 주 뷰티 브리핑 — 2026년 05월 26일',
  '[
    {"name":"스킨케어","emoji":"🧴","count":0,"items":[]},
    {"name":"메이크업","emoji":"💋","count":1,"items":[
      {"title":"The Vogue Business Beauty Trend Tracker","source":"Vogue","link":"https://news.google.com/rss/articles/CBMicEFVX3lxTE96eFRtR1g5NG15VmJxdk9GX3B1V1FJdWRDdkJPb1pHMWk3d2pwMV81WFBURlJxaHRadVZTWUFKR1VSc21KX1lyVTUxa2NSa05nRmxUU1FRb1hFVWNvc2hDZ25YYUQ0Y09jMzNhLTZuWGk?oc=5","summary":"Charlotte Tilbury의 Walk of Shame과 같은 립스틱 제품 판매가 증가하고 있으며 틴트와 세럼, 마스크팩이 선호된다."}
    ]},
    {"name":"퍼스널케어","emoji":"🚿","count":2,"items":[
      {"title":"The Vogue Business Beauty Trend Tracker","source":"Vogue","link":"https://news.google.com/rss/articles/CBMicEFVX3lxTE96eFRtR1g5NG15VmJxdk9GX3B1V1FJdWRDdkJPb1pHMWk3d2pwMV81WFBURlJxaHRadVZTWUFKR1VSc21KX1lyVTUxa2NSa05nRmxUU1FRb1hFVWNvc2hDZ25YYUQ0Y09jMzNhLTZuWGk?oc=5","summary":"히알루론산, 비타민C, 레티놀 성분 제품에 관심이 높으며 틴트된 립밤 같은 멀티 컬러 제품이 인기다."},
      {"title":"We Have Split Opinions on Summer''s Most Controversial Fragrance Trend","source":"Marie Claire","link":"https://news.google.com/rss/articles/CBMiZ0FVX3lxTE55Q1o5M2FwNkR0UVNmMWx2YUQ4MkdwTVlTTGh0bGNBY1BrV3NaWE00eXh0NW5zanBnTUFkMndlbUJOY3QwZVdZenpkeVhLMzRWMC0za3o1dU1GWTN5akxjWjJCT0tabDg?oc=5","summary":"여름철 향수 트렌드가 소개됐다. Jo Malone London과 Le Labo의 Fruity Florals 제품이 인기. 시트러스 향료 사용 제품과 오일 성분 루틴이 확산 중이다."}
    ]},
    {"name":"K-뷰티","emoji":"🇰🇷","count":4,"items":[
      {"title":"Last-Minute K-Beauty Memorial Day Sales: Medicube, Hero Cosmetics, Beauty of Joseon & More","source":"E! News","link":"https://news.google.com/rss/articles/CBMimAFBVV95cUxQWGVxSFpSdUtyMDBFdDEzWDgzUEtsZUFHODRLZUI2RThRVUZoenlMcHNmZGFjOEtidHc5MTVBaklPbHFjaUd2eUVWRDE0V25yVnM5UGlVR0JOV21fNzYwRVdIcmRRSzM2dDEyNHgydWM3bzVlYzBsS05meTNxVk45TWI5VDc2MHI3bDZhN0c5QnFTZUI2WEdXVg?oc=5","summary":"메디큐브, 히로 코스메틱스, 뷰티 오브 조슨 등 K-뷰티 브랜드가 메모리얼 데이 할인 판매를 진행한다. 히알루론산, 나이아신아미드, 세럼, 립스틱 등이 인기다."},
      {"title":"Olive Young launches 1st US K-beauty store in California","source":"koreabiomed.com","link":"https://news.google.com/rss/articles/CBMibkFV?oc=5","summary":"올리브영이 미국 캘리포니아에 첫 K-뷰티 매장을 오픈했다. 세포라와 울타는 한국 스킨케어 제품의 판매를 확대하고 있다."},
      {"title":"K-Beauty giant Olive Young opening first US store in Pasadena","source":"Pasadena Star News","link":"https://news.google.com/rss/articles/CBMiqAFB?oc=5","summary":"올리브영이 미국 캘리포니아 파사데나에 첫 매장을 오픈한다. 미국 소비자들 사이에서 립스틱, 스킨케어 제품에 대한 관심이 높다."},
      {"title":"Landing International wraps first K-Beauty Week with Nasdaq closing bell ceremony","source":"The Korea Times","link":"https://news.google.com/rss/articles/CBMi1AFB?oc=5","summary":"K-뷰티 위크가 나스닥 종소리 행사로 마무리됐다. 히알루론산 성분 제품과 피부 광채 루틴에 관심이 집중되고 있다."}
    ]},
    {"name":"기타","emoji":"✨","count":1,"items":[
      {"title":"The Vogue Business Beauty Trend Tracker","source":"Vogue","link":"https://news.google.com/rss/articles/CBMicEFV?oc=5","summary":"Glossier가 뷰티 트렌드를 선도하고 있다. 퍼징 립스틱, 데일리 선크림, 프로바이오틱 스킨케어 제품에 관심이 높다."}
    ]}
  ]'::jsonb,
  '[
    {"tag":"#히알루론산멀티컬러제품","explanation":"히알루론산과 비타민C를 함유한 멀티 컬러 제품에 소비자 관심 집중."},
    {"tag":"#퍼징립스틱","explanation":"퍼징 립스틱에 대한 관심이 높아지고 있어 제품 개발에 집중 필요."},
    {"tag":"#프로바이오틱스킨케어","explanation":"프로바이오틱 스킨케어 제품에 대한 수요 증가."},
    {"tag":"#틴트된립밤","explanation":"틴트된 립밤 같은 멀티 컬러 제품이 인기를 끌고 있다."}
  ]'::jsonb
),

-- ── 2026-05-28 ────────────────────────────────────────────────
(
  '2026-05-28',
  '2026-05-28',
  '이번 주 뷰티 브리핑 — 2026년 05월 28일',
  '[
    {"name":"스킨케어","emoji":"🧴","count":4,"items":[
      {"title":"La Mer Launches Rapid Renewing Serum for Instant Skin Renewal","source":"Allure (AI)","link":"","summary":"La Mer가 Rapid Renewing Serum을 출시했다. 비타민C 기반의 트리트먼트로 하룻밤 만에 피부를 밝고 부드럽게 만들어준다. 한국 뷰티 브랜드는 비타민C 성분을 활용한 인스턴트 스킨 케어 제품을 개발하여 시장 트렌드를 선점할 수 있다."},
      {"title":"Herbivore Botanicals Debuts Lapis Blue Toner with Turmeric and Blue Algae","source":"Byrdie (AI)","link":"","summary":"Herbivore Botanicals에서 Lapis Blue Toner를 출시했다. 항산화 성분이 풍부한 블루 알gae와 강황이 특징이며 피부를 해독하고 균형을 맞추는 효과가 있다."},
      {"title":"Snail Mucin Trend Drives The Inkey List''s New Snail Mucin Serum Sales","source":"Refinery29 (AI)","link":"","summary":"The Inkey List의 Snail Mucin Serum이 틱톡 사용자들에게 호평을 받으며 베스트셀러가 됐다. 달팽이 점액질 성분으로 만들어졌으며 히알루론산, 레티놀 등과 함께 스킨케어 루틴에 자주 등장한다."},
      {"title":"Q2 2024 Skincare Sales Rise 12% Amid CeraVe''s Record Growth","source":"WWD (AI)","link":"","summary":"CeraVe의 기록적인 성장으로 Q2 2024 스킨케어 매출이 12% 증가했다. 하이드로콜로이드, 글리콜릭산, 나이아신아마이드 성분이 주목받고 있다."}
    ]},
    {"name":"메이크업","emoji":"💋","count":1,"items":[
      {"title":"The Vogue Business Beauty Trend Tracker","source":"Vogue","link":"https://news.google.com/rss/articles/CBMicEFV?oc=5","summary":"Fenty Beauty의 새로운 립스틱 라인과 Drunk Elephant의 베스트셀러 세럼이 인기. 히알루론산, 레티놀, 비타민 C 함유 제품과 틴트된 자외선 차단제 같은 멀티 기능 제품이 인기다."}
    ]},
    {"name":"퍼스널케어","emoji":"🚿","count":2,"items":[
      {"title":"The Vogue Business Beauty Trend Tracker","source":"Vogue","link":"https://news.google.com/rss/articles/CBMicEFV?oc=5","summary":"히알루론산과 비타민C 성분이 함유된 제품에 관심이 높으며 세럼과 크림을 함께 사용하는 스킨케어 루틴이 인기다."},
      {"title":"We Have Split Opinions on Summer''s Most Controversial Fragrance Trend","source":"Marie Claire","link":"https://news.google.com/rss/articles/CBMiZ0FV?oc=5","summary":"지속 가능한 성분을 사용한 향수와 틴티드 립밤 같은 가볍고 지속가능한 향수 제품이 SNS에서 확산 중이다."}
    ]},
    {"name":"K-뷰티","emoji":"🇰🇷","count":2,"items":[
      {"title":"Buzzy K-beauty brand is popping up in NYC Thursday","source":"New York Post","link":"https://news.google.com/rss/articles/CBMi1AFB?oc=5","summary":"K뷰티 브랜드가 뉴욕에서 팝업 이벤트를 진행한다. 립스틱, 스킨케어 제품들이 미국 소비자 사이에서 확산 중이다."},
      {"title":"Last-Minute K-Beauty Memorial Day Sales: Medicube, Hero Cosmetics, Beauty of Joseon & More","source":"E! News","link":"https://news.google.com/rss/articles/CBMimAFB?oc=5","summary":"메디큐브, 히로 코스메틱스, 뷰티 오브 조슨이 메모리얼 데이 할인을 진행한다. 히알루론산, 나이아신아마이드, 레티놀 함유 제품이 인기다."}
    ]},
    {"name":"기타","emoji":"✨","count":1,"items":[
      {"title":"The Vogue Business Beauty Trend Tracker","source":"Vogue","link":"https://news.google.com/rss/articles/CBMicEFV?oc=5","summary":"Glossier가 뷰티 트렌드를 선도하고 있다. 퍼징 립스틱, 데일리 선크림, 민감성 피부용 스킨케어 제품에 관심이 높다."}
    ]}
  ]'::jsonb,
  '[
    {"tag":"#InstantSkinRenewal","explanation":"La Mer의 Rapid Renewing Serum 출시로 하룻밤 만에 피부를 밝고 부드럽게 하는 인스턴트 스킨케어 트렌드가 주목받고 있다."},
    {"tag":"#BlueAlgaeSkincare","explanation":"블루 알gae와 강황을 활용한 스킨케어 제품이 인기. 항산화 성분 기반 제품 수요 증가."},
    {"tag":"#SnailMucinSerum","explanation":"달팽이 점액질 성분 세럼이 틱톡에서 호평받으며 베스트셀러가 됐다."},
    {"tag":"#BarrierFirstLayering","explanation":"CeraVe의 성장으로 하이드로콜로이드, 글리콜릭산, 나이아신아마이드를 활용한 스킨케어 루틴이 주목받고 있다."},
    {"tag":"#MochiSkin","explanation":"Fenty Beauty와 Drunk Elephant가 선도하는 촉촉하고 건강한 피부 트렌드. 히알루론산과 레티놀 성분 강조."}
  ]'::jsonb
),

-- ── 2026-05-27 ~ 2026-06-03 ──────────────────────────────────
(
  '2026-05-27',
  '2026-06-03',
  '이번 주 뷰티 브리핑 — 05월 27일 – 06월 03일',
  '[
    {"name":"스킨케어","emoji":"🧴","count":5,"items":[
      {"title":"Clean Beauty Pioneer Karen Behnke Returns With Beauty Crush Skincare","source":"WWD","link":"https://wwd.com/beauty-industry-news/skin-care/karen-behnke-beauty-crush-skincare-regenerative-biotech-1238990818/","pubDate":"2026-06-03","summary":"Karen Behnke가 재생 생명공학, 독자적 포도 엑소좀, 유기농 소노마 카운티 포도밭에서 얻은 성분을 결합한 Beauty Crush Skincare를 선보였다. 클린 뷰티 수요가 증가하는 북미 시장의 방향 신호다."},
      {"title":"SkinCeuticals Is Scuderia Ferrari HP''s First Skin Care Partner","source":"WWD","link":"https://wwd.com/beauty-industry-news/skin-care/skinceuticals-scuderia-ferrari-hp-skin-care-partner-1238990618/","pubDate":"2026-06-03","summary":"스킨세유티컬스가 스쿠데리아 페라리 HP의 첫 스킨케어 파트너가 됐다. 럭셔리 스킨케어 브랜드 간의 협업이 새로운 방향 신호다."},
      {"title":"Are Peptides Poised To Go From Gray Market To Gold Rush?","source":"Beauty Independent","link":"https://www.beautyindependent.com/peptides-poised-gray-market-gold-rush/","pubDate":"2026-06-03","summary":"펩타이드 기반 제품이 회색 시장에서 금 러시로 전환될 준비가 됐다. BPC-157, GHK-Cu 펩타이드 등이 소비자들에게 주목받고 있다."},
      {"title":"These Lactic Acid Serums Prove That Everyone Can Exfoliate","source":"Allure","link":"https://www.allure.com/story/best-lactic-acid-serums","pubDate":"2026-06-03","summary":"락틱산 세럼이 각광받으며 모든 피부 타입이 각질 제거를 할 수 있다는 인식이 확산되고 있다. 밝고 매끄러운 피부를 위한 성분으로 인기다."},
      {"title":"Obagi Medical Sells To Bridgepoint For $460M As Beauty''s Ties To Aesthetics Deepen","source":"Beauty Independent","link":"https://www.beautyindependent.com/obagi-medical-sells-bridgepoint-460m-beauty-ties-aesthetics-deepen/","pubDate":"2026-06-02","summary":"Obagi Medical이 Bridgepoint Group에 4억 6천만 달러에 매각됐다. 미용과 미학, 웰빙의 경계가 모호해지는 트렌드를 반영한다."}
    ]},
    {"name":"메이크업","emoji":"💋","count":4,"items":[
      {"title":"All That Glitters Is Olandria''s Gilded Birthday Makeup","source":"Allure","link":"https://www.allure.com/story/olandria-carthen-golden-birthday-makeup","pubDate":"2026-06-02","summary":"러브 아일랜드 스타 올랜디아의 생일 메이크업이 화제. 글리터 메이크업이 다시 주목받고 있음을 보여주는 방향 신호다."},
      {"title":"10 Best False Lashes of 2026, According to Makeup Artists","source":"Allure","link":"https://www.allure.com/gallery/best-false-eyelashes","pubDate":"2026-06-02","summary":"Huda Beauty의 Lash Silk 제품이 2026년 최고의 가짜 속눈썹으로 선정됐다. 자연스럽고 고급스러운 메이크업에 대한 수요 증가."},
      {"title":"Kat Dennings Did Her Pierced Chrome French Manicure Herself","source":"Allure","link":"https://www.allure.com/story/kat-dennings-pierced-chrome-manicure","pubDate":"2026-06-02","summary":"크로미 네일 아트가 포함된 프렌치 매니큐어가 트렌드로 떠올랐다. DIY 뷰티로의 전환을 보여준다."},
      {"title":"Matte Is Back! The Summer 2026 Lip Trends You Need to Know","source":"Elle","link":"https://www.elle.com/beauty/makeup-skin-care/a71363078/summer-2026-lip-trends/","pubDate":"2026-05-31","summary":"2026년 여름 북미 뷰티 시장에서 마티 립 제품이 인기를 끌고 있다. 지속 가능한 뷰티 제품에 대한 관심 증가."}
    ]},
    {"name":"퍼스널케어","emoji":"🚿","count":5,"items":[
      {"title":"Phlur names Suni Lee its first-ever celebrity ambassador","source":"Glossy","link":"https://www.glossy.co/beauty/phlur-names-suni-lee-its-first-ever-celebrity-ambassador/","pubDate":"2026-06-03","summary":"퍼스널케어 브랜드 플루어가 올림픽 체조 선수 수니 리를 첫 번째 셀러브리티 앰배서더로 선정했다. 인플루언서와 셀러브리티 협업을 통한 브랜드 성장 가능성을 보여준다."},
      {"title":"Bond-Building Haircare Brand Filament Raises $2M Seed Round","source":"Beauty Independent","link":"https://www.beautyindependent.com/bond-building-haircare-brand-filament-raises-seed-round/","pubDate":"2026-06-02","summary":"Filament가 채권 형성 헤어케어 제품으로 2백만 달러 시드 라운드를 유치했다. 모발 건강과 손상된 모발 복구에 대한 관심 증가."},
      {"title":"Summer 2026 Is Set to Smell Soft, Salty, and Skin-Like","source":"Elle","link":"https://www.elle.com/beauty/makeup-skin-care/a71394957/summer-2026-perfume-trends/","pubDate":"2026-05-30","summary":"여름 향수 트렌드가 소프트하고 짭조름하며 피부와 유사한 향으로 변화하고 있다."},
      {"title":"My Secret to Smelling Good Longer? A Perfume Balm","source":"Elle","link":"https://www.elle.com/beauty/makeup-skin-care/a71423779/best-perfume-balms/","pubDate":"2026-05-29","summary":"롱래스팅 향수 밤 제품이 인기를 끌고 있다. 지속성이 뛰어나고 여행하기에 편리한 제품이 선호된다."},
      {"title":"These Second-Skin Scents Are the Ultimate Compliment Magnets","source":"Elle","link":"https://www.elle.com/beauty/a71396212/best-second-skin-perfumes/","pubDate":"2026-05-28","summary":"Jo Malone London의 Second-Skin 향수 라인이 인기. 자연스럽고 편안한 향기를 선호하는 소비자 경향이 나타나고 있다."}
    ]},
    {"name":"K-뷰티","emoji":"🇰🇷","count":2,"items":[
      {"title":"Olive Young''s U.S. Debut Draws Overnight Line and a Weekend Crowd of 6,000","source":"WWD","link":"https://wwd.com/beauty-industry-news/beauty-features/olive-young-first-us-store-pasadena-6000-visitors-1238988523/","pubDate":"2026-06-02","summary":"올리브영이 캘리포니아 패서디나에 첫 미국 매장을 오픈했다. 오픈 주말 6,000명 이상 방문. K-뷰티의 북미 진출에 있어 중요한 방향 신호다."},
      {"title":"I Found the Best Foundation for People Who Hate Foundation","source":"Elle","link":"https://www.elle.com/beauty/makeup-skin-care/a71365127/ysl-skin-affair-soft-glow-cushion-foundation-review/","pubDate":"2026-05-29","summary":"YSL의 새로운 쿠션 제품이 K-뷰티의 전략을 차용하고 있다. K-뷰티 쿠션 포맷이 글로벌 프레스티지 시장에서 표준으로 자리 잡고 있다."}
    ]},
    {"name":"기타","emoji":"✨","count":3,"items":[
      {"title":"Sephora Integrates With Google AI for In-Search Shopping","source":"CEW","link":"https://cew.org/beauty_news/beautys-top-headlines-june-9-2026/","pubDate":"2026-06-03","summary":"세포라가 구글 AI 플랫폼에서 쇼핑 통합을 구현했다. 뷰티 소비자의 제품 발견 채널이 AI 어시스턴트로 이동하는 패러다임 전환이다."},
      {"title":"Poom Cosmetics TikTok Transparency Strategy","source":"CEW","link":"https://cew.org/beauty_news/","pubDate":"2026-06-03","summary":"창업자 Irene Ham이 TikTok에 사업 운영 전 과정을 공개하는 투명성 마케팅으로 Ulta MUSE 엑셀러레이터에 선발됐다."},
      {"title":"Caldera + Lab Enters Nordstrom","source":"CEW","link":"https://cew.org/beauty_news/","pubDate":"2026-06-03","summary":"남성 스킨케어 Caldera + Lab이 노드스트롬에 입점했다. 남성 소비자의 자발적 스킨케어 구매 전환이 프레스티지 리테일 진입을 이끌고 있다."}
    ]}
  ]'::jsonb,
  '[
    {"tag":"#PeptideSkincare","explanation":"BPC-157, GHK-Cu 펩타이드 기반 제품이 소비자 시장으로 확산 중."},
    {"tag":"#LacticAcidExfoliation","explanation":"락틱산 세럼이 모든 피부 타입에 적합한 각질 제거제로 각광받고 있다."},
    {"tag":"#CleanBeautyRegeneration","explanation":"재생 생명공학과 클린 성분을 결합한 제품 수요 증가."},
    {"tag":"#SkinScentTrend","explanation":"피부와 유사한 소프트하고 짭조름한 향수 트렌드가 여름 시즌을 주도하고 있다."},
    {"tag":"#AIBeautyDiscovery","explanation":"세포라의 구글 AI 통합으로 AI가 뷰티 구매 여정의 새 진입점이 되고 있다."}
  ]'::jsonb
),

-- ── 2026-06-04 ~ 2026-06-10 ──────────────────────────────────
(
  '2026-06-04',
  '2026-06-10',
  '이번 주 뷰티 브리핑 — 2026-06-04 – 2026-06-10',
  '[
    {"name":"스킨케어","emoji":"🧴","count":5,"stories":[
      {"rank":1,"headline":"FDA Approves Bemotrizinol — First New Sunscreen Ingredient in Over 25 Years","date":"2026-06-09","source":"CBS News","url":"https://www.cbsnews.com/news/fda-new-sunscreen-ingredient-bemotrizinol/","pubDate":"June 9, 2026","summary":"FDA가 25년 만에 처음으로 새로운 자외선 차단 성분 베모트리지놀을 승인했다. UVA·UVB를 동시 차단하며 대분자 구조로 혈류 흡수율이 낮아 안전성이 높다. 미국 선케어 포뮬레이션 전략 전반을 재편할 규제 전환점이다."},
      {"rank":2,"headline":"PCA Skin Launches Triple Exfoliation Peel Pads","date":"2026-06-04","source":"NewBeauty","url":"https://www.newbeauty.com/view/best-new-beauty-products-june-2026","pubDate":"June 4, 2026","summary":"PCA 스킨이 AHA·BHA·PHA를 결합한 트리플 박리 패드를 홈케어용으로 출시했다. 더마코스메틱급 클리니컬 기술을 소비자가 직접 사용할 수 있게 한 것."},
      {"rank":3,"headline":"The INKEY List Reformulates Oat Balm Cleanser","date":"2026-06-04","source":"NewBeauty","url":"https://www.newbeauty.com/view/best-new-beauty-products-june-2026","pubDate":"June 4, 2026","summary":"베스트셀러 오트 밤 클렌저를 리포뮬레이션해 재출시했다. 장벽 케어·마이크로바이옴 친화 클렌징 수요가 엔트리급 브랜드까지 침투했음을 보여준다."},
      {"rank":4,"headline":"ciele Cosmetics Shade & PROTECT SPF 45+ Powder Bronzer","date":"2026-06-04","source":"NewBeauty","url":"https://www.newbeauty.com/view/best-new-beauty-products-june-2026","pubDate":"June 4, 2026","summary":"SPF 45+를 탑재한 파우더 브론저로 선케어와 컬러 메이크업의 경계를 완전히 허물었다."},
      {"rank":5,"headline":"Versed Everything Balm Complexion Color — $16 Skincare-Makeup Hybrid","date":"2026-06-04","source":"NewBeauty","url":"https://www.newbeauty.com/view/best-new-beauty-products-june-2026","pubDate":"June 4, 2026","summary":"Versed가 스킨케어·메이크업 이중 기능의 컴플렉션 밤을 $16에 출시했다. 뷰티 다운트레이딩 기조 속 가성비와 다기능을 동시에 충족하는 제품 수요가 증명되고 있다."}
    ]},
    {"name":"메이크업","emoji":"💋","count":5,"stories":[
      {"rank":1,"headline":"Rhode Drops Pocket Bronze & Highlight Milk","date":"2026-06-09","source":"Hypebae","url":"https://hypebae.com/2026/6/rhode-summer-collection-pocket-bronze-highlight-milk-where-to-buy","pubDate":"June 9, 2026","summary":"Rhode가 브랜드 최초의 브론저·하이라이터를 출시하며 역대 최대 규모의 시즌 드롭을 선보였다. 스킨케어 성분을 컬러 메이크업에 통합하는 전략을 유지했다."},
      {"rank":2,"headline":"Kiko Milano Debuts at Macy''s with Madonna as Global Ambassador","date":"2026-06-09","source":"WWD","url":"https://wwd.com/beauty-industry-news/color-cosmetics/madonna-kiko-milano-makeup-ambassador-launch-macys-1238997885/","pubDate":"June 9, 2026","summary":"이탈리아 1위 메이크업 브랜드 Kiko Milano가 마돈나를 글로벌 앰배서더로 기용하며 Macy''s에 650개 SKU로 미국 시장에 공식 진출했다."},
      {"rank":3,"headline":"Hourglass Phantom Blur Balm","date":"2026-06-09","source":"The Zoe Report","url":"https://www.thezoereport.com/beauty/june-2026-best-new-beauty-products","pubDate":"June 9, 2026","summary":"Hourglass가 립 스킨케어와 블러링 메이크업을 결합한 팬텀 블러 밤을 출시했다."},
      {"rank":4,"headline":"YSL Beauty Skin Affair Soft Glow Cushion Foundation","date":"2026-06-04","source":"NewBeauty","url":"https://www.newbeauty.com/view/best-new-beauty-products-june-2026","pubDate":"June 4, 2026","summary":"YSL 뷰티가 쿠션 파운데이션 포맷을 채택하며 K-뷰티 포맷이 글로벌 프레스티지의 새로운 표준으로 자리 잡은 현실을 확인했다."},
      {"rank":5,"headline":"Laura Mercier Reimagines Secret Camouflage as Complexion Perfector","date":"2026-06-09","source":"The Zoe Report","url":"https://www.thezoereport.com/beauty/june-2026-best-new-beauty-products","pubDate":"June 9, 2026","summary":"Laura Mercier가 아이코닉 컨실러 시크릿 카모플라주를 현대화해 재출시했다."}
    ]},
    {"name":"퍼스널케어","emoji":"🚿","count":4,"stories":[
      {"rank":1,"headline":"RŌZ Wave Texturizing Mist","date":"2026-06-09","source":"The Zoe Report","url":"https://www.thezoereport.com/beauty/june-2026-best-new-beauty-products","pubDate":"June 9, 2026","summary":"RŌZ가 웨이브 텍스처링 미스트를 출시하며 헤어 건강과 스타일링을 동시 추구하는 스킨케어화된 헤어케어 트렌드를 반영했다."},
      {"rank":2,"headline":"Redken All Soft All-In Mask","date":"2026-06-09","source":"The Zoe Report","url":"https://www.thezoereport.com/beauty/june-2026-best-new-beauty-products","pubDate":"June 9, 2026","summary":"Redken이 컨디셔닝·수분·강화 기능을 하나로 결합한 올인원 헤어 마스크를 출시했다. 헤어 루틴 간소화 수요를 정조준한 전략이다."},
      {"rank":3,"headline":"Gisou Honey Gloss Collagen Drops","date":"2026-06-04","source":"NewBeauty","url":"https://www.newbeauty.com/view/best-new-beauty-products-june-2026","pubDate":"June 4, 2026","summary":"Gisou가 꿀 성분과 콜라겐을 결합한 헤어 드롭을 출시했다. 스킨케어의 핵심 성분 콜라겐이 헤어케어로 이동하는 트렌드를 보여준다."},
      {"rank":4,"headline":"Beauty Pie Nice Legs Tinted Super Blur Body Lotion","date":"2026-06-04","source":"NewBeauty","url":"https://www.newbeauty.com/view/best-new-beauty-products-june-2026","pubDate":"June 4, 2026","summary":"Beauty Pie가 틴티드 블러링 바디 로션을 출시하며 메이크업 기술을 바디케어에 적용하는 트렌드를 공략했다."}
    ]},
    {"name":"K-뷰티","emoji":"🇰🇷","count":2,"stories":[
      {"rank":1,"headline":"Rael Brings Glutathione + PDRN Hydrogel Masks to Ulta Beauty at $4.99","date":"2026-06-08","source":"PR Newswire","url":"https://www.prnewswire.com/news-releases/rael-brings-k-beautys-most-advanced-skincare-ingredients-to-us-shelves-with-two-new-hydrogel-masks-at-ulta-beauty-302793090.html","pubDate":"June 8, 2026","summary":"Rael이 글루타치온·PDRN·트라넥삼산 탑재 하이드로겔 마스크 2종을 단품 $4.99에 Ulta Beauty 론칭했다. K-뷰티 고급 의료성분을 메인스트림 가격대로 접근 가능하게 하는 전략이다."},
      {"rank":2,"headline":"Cosmobeauty Seoul 2026: PDRN, Microneedle, and Freeze-Dried Actives Go Mass","date":"2026-06-06","source":"Premium Beauty News","url":"https://www.premiumbeautynews.com/en/k-beauty-top-10-innovative,27719","pubDate":"June 6, 2026","summary":"코스모뷰티서울 2026에서 PDRN이 올해 돌파구 성분으로 부상했다. K-뷰티의 메디코스메틱 트렌드가 글로벌 시장 전반으로 확산되고 있다."}
    ]},
    {"name":"기타","emoji":"✨","count":5,"stories":[
      {"rank":1,"headline":"Sephora Becomes First Prestige Retailer to Integrate Shopping Into Google AI","date":"2026-06-09","source":"CEW","url":"https://cew.org/beauty_news/beautys-top-headlines-june-9-2026/","pubDate":"June 9, 2026","summary":"세포라가 구글 AI 플랫폼 내에서 제품 탐색·루틴 구성·구매 완결을 가능하게 하는 통합을 구현했다. 뷰티 소비자의 제품 발견 채널이 AI 어시스턴트로 이동하는 패러다임 전환이 가속화되고 있다."},
      {"rank":2,"headline":"Poom Cosmetics TikTok Transparency Strategy Lands Ulta MUSE Accelerator","date":"2026-06-09","source":"CEW","url":"https://cew.org/beauty_news/beautys-top-headlines-june-9-2026/","pubDate":"June 9, 2026","summary":"창업자 Irene Ham이 TikTok에 사업 운영 전 과정을 공개하는 투명성 마케팅으로 4개월 만에 흑자를 달성, Ulta MUSE 엑셀러레이터에 선발됐다."},
      {"rank":3,"headline":"Caldera + Lab Enters Nordstrom — Prestige Men''s Skincare Hits Department Store","date":"2026-06-09","source":"CEW","url":"https://cew.org/beauty_news/beautys-top-headlines-june-9-2026/","pubDate":"June 9, 2026","summary":"남성 스킨케어 Caldera + Lab이 노드스트롬에 입점했다. 2022년 $700만 → 2025년 $4,000만 매출 성장 브랜드로, 남성 소비자의 자발적 스킨케어 구매 전환이 확인된다."},
      {"rank":4,"headline":"E.l.f. Beauty Named Top Brand on Social by Sprout Social Index","date":"2026-06-09","source":"CEW","url":"https://cew.org/beauty_news/beautys-top-headlines-june-9-2026/","pubDate":"June 9, 2026","summary":"e.l.f. 뷰티가 Sprout Social Index에서 소셜 미디어 최고 브랜드로 선정됐다. 소셜 우선 전략이 프레스티지·매스 경계를 허무는 성과를 보여준다."},
      {"rank":5,"headline":"Benefit Cosmetics Names Kim Kardashian as Global Brand Ambassador","date":"2026-06-07","source":"CEW","url":"https://cew.org/beauty_news/beautys-top-headlines-june-9-2026/","pubDate":"June 7, 2026","summary":"Benefit Cosmetics가 Kim Kardashian을 글로벌 브랜드 앰배서더로 발탁했다. 셀러브리티 협업이 레거시 브랜드 재활성화의 핵심 전략으로 부상하고 있다."}
    ]}
  ]'::jsonb,
  '[
    {"tag":"#Bemotrizinol","explanation":"FDA 승인 25년 만의 새 자외선 차단 성분. 미국 선케어 시장 전략을 재편할 규제 전환점."},
    {"tag":"#PDRNMasksMainstream","explanation":"Rael의 Ulta 론칭으로 PDRN 등 의료코스메틱 성분이 $5 이하 메인스트림 가격대로 진입."},
    {"tag":"#SkincareHybridFormat","explanation":"선케어+메이크업, 스킨케어+헤어케어 하이브리드 포맷이 2026년 여름 뷰티 시장의 핵심 트렌드."},
    {"tag":"#AIBeautyShopping","explanation":"세포라·구글 AI 통합으로 AI가 뷰티 구매 여정의 새 진입점. 제품 발견 채널 패러다임 전환 가속화."},
    {"tag":"#KBeautyFormatGlobal","explanation":"YSL 쿠션 파운데이션 채택 등 K-뷰티 발원 포맷이 글로벌 프레스티지 표준으로 확산 중."}
  ]'::jsonb
)

ON CONFLICT (windows_start) DO UPDATE
  SET windows_end  = EXCLUDED.windows_end,
      report_title = EXCLUDED.report_title,
      categories   = EXCLUDED.categories,
      keywords     = EXCLUDED.keywords;
