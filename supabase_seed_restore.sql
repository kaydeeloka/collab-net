-- ============================================================
--  MiMuse — Data Restore Seed
--  Run in Supabase SQL Editor (tables must already exist).
--  Execute all blocks in order.
-- ============================================================

-- ============================================================
--  1. TIERS
-- ============================================================
INSERT INTO tiers (rank, label, category, tags, min_followers, max_followers, sort_order) VALUES
  ('1순위', '마이크로 (10K~50K)',  'K-뷰티',   'kbeauty', 10000,  50000,  1),
  ('2순위', '마이크로 (10K~50K)',  '일반뷰티', 'beauty',  10000,  50000,  2),
  ('3순위', '나노 (3K~10K)',       'K-뷰티',   'kbeauty', 3000,   9999,   3),
  ('4순위', '나노 (3K~10K)',       '일반뷰티', 'beauty',  3000,   9999,   4),
  ('5순위', '마이크로 (60K~100K)', 'K-뷰티',   'kbeauty', 60000,  100000, 5)
ON CONFLICT (rank) DO NOTHING;

-- ============================================================
--  2. PHASE
-- ============================================================
INSERT INTO phases (name, is_active, started_at)
VALUES ('1차', true, '2026-05-20')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
--  3. APP CONFIG
-- ============================================================
INSERT INTO app_config (key, value) VALUES
  ('kbeauty_keywords', '["glass skin","kbeauty","korean beauty","korean skincare","kbeauty review","kbeauty routine","korean skincare routine","kbeauty products","kbeauty addict","korean makeup","olive young","kbeauty skincare"]'::jsonb),
  ('beauty_keywords',  '["beauty review","skincare","makeup tips","beauty creator","beautytok","makeup haul","beauty hacks","beauty influencer"]'::jsonb),
  ('filter_conditions','[{"cat":"중복","desc":"1~5순위까지의 중복 계정 필터링"},{"cat":"영상 퀄리티","desc":"영상 콘텐츠 퀄리티 기준 수기 검토 예정"}]'::jsonb),
  ('search_filters',   '{"maxRatio":70,"maxUploadDays":30,"proxyCountry":"US"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value)
SELECT 'active_phase_id', to_jsonb(id::text)
FROM phases WHERE name = '1차' LIMIT 1
ON CONFLICT (key) DO NOTHING;

-- ============================================================
--  4. MONITORING KEYWORDS
-- ============================================================
INSERT INTO monitoring_keywords (brand, keywords) VALUES
  ('mimuse',  ARRAY['mimuse',  '미뮤즈']),
  ('aesthen', ARRAY['aesthen', '에스텐']),
  ('joodoc',  ARRAY['joodoc',  '주독']),
  ('nesh',    ARRAY['nesh',    '네쉬']),
  ('varuza',  ARRAY['varuza',  '바루자'])
ON CONFLICT (brand) DO NOTHING;

-- ============================================================
--  5. EMAIL RECIPIENTS
-- ============================================================
INSERT INTO email_recipients (phase_id, email, name)
VALUES (get_active_phase_id(), 'nexanetraventures@gmail.com', 'Admin')
ON CONFLICT (phase_id, email) DO NOTHING;

-- ============================================================
--  6. INFLUENCERS — from CSV (tier auto-assigned by trigger)
-- ============================================================
INSERT INTO influencers (
  created_at, phase_id, handle, display_name, email,
  followers, following, following_ratio, total_likes,
  video_count, engagement_rate, profile_url, outreach
) VALUES
  -- Batch 1: 2026-05-20 (micro 10K–50K)
  ('2026-05-20', get_active_phase_id(), 'kaydeeloka',           'Kaydee',                     'kaydee@cranecomm.com',                  26375, 2039,  '7.70%',  2991375,  660,  0.33, NULL,                                      'target'),
  ('2026-05-20', get_active_phase_id(), 'nexanetra',            'neaxa',                      'nexanetraventures@gmail.com',            26375, 2039,  '7.70%',  2991375,  660,  0.33, NULL,                                      'reply'),
  ('2026-05-20', get_active_phase_id(), 'raisingbruin',         'Raising Bruin',              'raisingbruin@onsocialscreators.com',     26375, 2039,  '7.70%',  2991375,  660,  0.33, 'https://www.tiktok.com/@raisingbruin',    'accept'),
  ('2026-05-20', get_active_phase_id(), 'carewithmi',           'mi',                         'carewithmi@gmail.com',                   41692, 203,   '0.50%',  8622245, 1272,  0.33, 'https://www.tiktok.com/@carewithmi',      'negotiate'),
  ('2026-05-20', get_active_phase_id(), 'asia.nha',             'asia & toshi',               'ajnhativong@gmail.com',                  24593, 2093,  '8.50%',   928105,  842,  0.33, 'https://www.tiktok.com/@asia.nha',        'yes'),
  ('2026-05-20', get_active_phase_id(), 'cessavila_',           'Cessy',                      'cessavila98@gmail.com',                  16042, 554,   '3.50%',   161256,  614,  0.33, 'https://www.tiktok.com/@cessavila_',      'accept'),
  ('2026-05-20', get_active_phase_id(), 'peytsoutfit',          'peytsoutfit',                'peyrosaliaugc@gmail.com',                29087, 1123,  '3.90%',  3654907, 1933,  0.33, 'https://www.tiktok.com/@peytsoutfit',     'reject'),
  ('2026-05-20', get_active_phase_id(), 'pinkglossed',          NULL,                         'lovexcourt@gmail.com',                   38315, 639,   '1.70%',  2506975,  819,  0.33, 'https://www.tiktok.com/@pinkglossed',     'yes'),
  ('2026-05-20', get_active_phase_id(), 'alegrachetti',         'Alegra Chetti Beauty',       'alegrachetti@gmail.com',                 31553, 974,   '3.10%',   305358,  994,  0.33, 'https://www.tiktok.com/@alegrachetti',    'yes'),
  ('2026-05-20', get_active_phase_id(), 'becsreview',           'Becs | Asian Beauty Diary',  'becs@jadegroup.co',                      36218, 644,   '1.80%',  2404057, 1181,  0.33, 'https://www.tiktok.com/@becsreview',      'yes'),
  ('2026-05-20', get_active_phase_id(), 'lexi_ugc',             'alexus | life + ugc',        'mgmt.lexi@gmail.com',                    26211, 71,    '0.30%',  3309767,  821,  0.33, 'https://www.tiktok.com/@lexi_ugc',        'yes'),
  ('2026-05-20', get_active_phase_id(), 'theohiogirljaz',       'Theohiogirljaz',             'jasmyn@socialmediacollabs.com',           48051, 699,   '1.50%',   697840, 1617,  0.33, 'https://www.tiktok.com/@theohiogirljaz',  'yes'),
  ('2026-05-20', get_active_phase_id(), 'nailsxnazira',         'Nazira',                     'nailsxnazira@gmail.com',                 35903, 173,   '0.50%',  3899955,  563,  0.33, 'https://www.tiktok.com/@nailsxnazira',    'yes'),
  ('2026-05-20', get_active_phase_id(), 'livinluckey_',         'nicole',                     'livinluckey@gmail.com',                  25576, 3568,  '14.00%', 1511129, 4343,  0.33, 'https://www.tiktok.com/@livinluckey_',    NULL),
  ('2026-05-20', get_active_phase_id(), 'lesettey',             'Lesette',                    'lesette@webwealth.org',                   36615, 1119,  '3.10%',  1271665, 2459,  0.33, 'https://www.tiktok.com/@lesettey',        'target'),
  ('2026-05-20', get_active_phase_id(), 'bridgettesbuys',       'bridgettesbuys',             'Bridgettesbuys@gmail.com',                31591, 378,   '1.20%',   607116, 3712,  0.33, 'https://www.tiktok.com/@bridgettesbuys',  'target'),
  ('2026-05-20', get_active_phase_id(), 'mavilagaj',            'Mavil',                      'Suemebb@gmail.com',                       19310, 1017,  '5.30%',  1161864, 1346,  0.33, 'https://www.tiktok.com/@mavilagaj',       'target'),
  ('2026-05-20', get_active_phase_id(), 'jpjpleeee',            'Jpjpleeee',                  'Jpjpleeee@gmail.com',                     30895, 565,   '1.80%',  5846629, 2815,  0.33, 'https://www.tiktok.com/@jpjpleeee',       'target'),
  ('2026-05-20', get_active_phase_id(), 'misssmaddy_',          'Maddy',                      'madelyndubon@gmail.com',                  26018, 5605,  '21.50%',  413330, 1588,  0.33, 'https://www.tiktok.com/@misssmaddy_',     NULL),
  ('2026-05-20', get_active_phase_id(), 'ashleybaiamonte',      'Ashley Baiamonte',           'afcoker9@gmail.com',                      12538, 1897,  '15.10%',  963605,  446,  0.33, 'https://www.tiktok.com/@ashleybaiamonte', NULL),
  ('2026-05-20', get_active_phase_id(), 'from_lumi',            'fromlumi',                   'itslunakim@gmail.com',                    16864, 249,   '1.50%',   791945,  355,  0.33, 'https://www.tiktok.com/@from_lumi',       NULL),
  ('2026-05-20', get_active_phase_id(), 'pamamairani',          'Pam Ramirez',                'Pamamairanicollab@gmail.com',              18523, 508,   '2.70%',  1273668,  545,  0.33, 'https://www.tiktok.com/@pamamairani',     NULL),
  ('2026-05-20', get_active_phase_id(), 'misskbeautylife',      'misskbeautylife',            'Kanylahk5@gmail.com',                     33493, 1376,  '4.10%',   186432,  825,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'leanne.bretanha',      'Leanne',                     'Leanne.bretanha@yahoo.com',               49334, 120,   '0.20%',  2490100,  911,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'braveleebrownlee',     'bravelee',                   'braveleebrownlee@gmail.com',              49348, 993,   '2.00%',  1331240,  835,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'bevydiy',              'Bevy | DIY Beauty',          'Bevydiybeauty@gmail.com',                 32861, 1739,  '5.30%',   252250,  355,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'mackkosborne',         'Mackk',                      'mack.collabs@outlook.com',                17898, 1846,  '10.30%', 6485880, 1431,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'spicedbydanii',        'Danii',                      'spicedbydanii@gmail.com',                 36869, 978,   '2.70%',  3586271,  473,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'ajlittle0902',         'Aaron',                      'aaronlittlejohn756@gmail.com',             31040, 134,   '0.40%',   476219, 1473,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'graciesecrist',        'grace',                      'pointlessmakeupemail@gmail.com',           16209, 296,   '1.80%',  3472182, 2245,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'l0vergirlari',         NULL,                         'ccontactari@gmail.com',                   47618, 2175,  '4.60%',  3105801, 5764,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'holisticallyjulia',    'Julia',                      'Juliadavisttshop@gmail.com',               23064, 159,   '0.70%',  1126604,  415,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'jen.chae',             'Jen Chae',                   'jenchae@select.co',                       30652, 258,   '0.80%',  1027342,  372,  0.33, NULL,                                      NULL),
  -- Nano (3K–10K)
  ('2026-05-20', get_active_phase_id(), 'dylansdeals05',        'DylansDeals',                'martymeade.ugc@gmail.com',                 7324, 1704,  '23.30%',    23305,  994,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'izzyinrealife',        'Izzyinrealife | ATX Creator','Izzydilubusiness@gmail.com',               4662, 2665,  '57.20%',  124749,  506,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'lazymxchi',            'liv',                        'oliviaxcollabs@gmail.com',                 4716, 2290,  '48.60%',  605067,  515,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'raimym1',              'RAIMY MEDRANO',              'medranoraimy690@gmail.com',                6705, 1141,  '17.00%',  289215, 1249,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'dollfunke',            'Doll Funke',                 'dollfunke@gmail.com',                      9950, 756,   '7.60%',   287924,  379,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'jesuisbienbien',       'Jenny',                      'jennyngbusiness@gmail.com',                7815, 600,   '7.70%',  1550128, 2761,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'christine.dawn',       'Christine Dawn',             'christinelapuma3@gmail.com',               4494, 555,   '12.30%', 1240437, 2595,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'hehehohoxd',           'hanah',                      'hellohanahk@gmail.com',                    5438, 3189,  '58.60%',  136893,  417,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'bri_sea',              'Bri | NYC Beauty Creator',   'BriSea2024@gmail.com',                     3126, 937,   '30.00%', 1104921,  378,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'avericano',            'Averi Cano',                 'partnerships@averiugc.com',                8654, 858,   '9.90%',  1238749, 2493,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), '_serahmichelle',       'Serah Michelle',             'serahmichellecreates@gmail.com',            9943, 2569,  '25.80%',  807027,  645,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'nadiyafinds',          'Nadiya',                     'nadiyai0711@gmail.com',                    8096, 360,   '4.40%',   217215, 1169,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'wandaugc',             'Wanda UGC Creator',          'Octobermommie@gmail.com',                  7527, 2907,  '38.60%',    66825, 1116,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'authentic.kayla',      'authentic.kayla',            'Yaniquehylton09@gmail.com',                9891, 2071,  '20.90%',  390458, 1018,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'alena.reelsdreamer',   'alena.casablanca',           'alena.pr2025@gmail.com',                   6879, 1686,  '24.50%',  388011, 1769,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'thatchick.kat',        'Kat',                        'Kathrynrossthompson27@gmail.com',           7937, 243,   '3.10%',  3352501, 1342,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'evamariefashion',      'evamariefashion',            'evachapmann@onsocialscreators.com',         7361, 525,   '7.10%',   255405, 2101,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'morg_lucas',           'Morgan',                     'Morgsfinds@gmail.com',                     5656, 1566,  '27.70%',  747323, 2258,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'stillwithjas',         'Jasmine Chen',               'stillwithjas@gmail.com',                   5001, 166,   '3.30%',   367487, 1254,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'nicchooleee',          'alycia',                     'nicchooleee@gmail.com',                    4112, 1030,  '25.00%',  524974,  291,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'lily.lasalle',         'lily',                       'lily.lasalle@gmail.com',                   4181, 835,   '20.00%',  701380, 1571,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'caesydilla',           'Caesy-dilla',                'Caesy32192@gmail.com',                     7972, 4240,  '53.20%',  172011, 2207,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'supptammy',            'Tammy.Mom.H',                'tsmartin1215@gmail.com',                   5787, 2805,  '48.50%',  311743, 2934,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'geminigems02',         'GeminiGems',                 'Tiktokdeals24@yahoo.com',                  9908, 78,    '0.80%',   574991, 2157,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'iamemilypineda_',      'emily tts beauty creator',   'ugcemilypineda@gmail.com',                 3576, 1823,  '51.00%',  104421, 1357,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'claraoshiroo',         'clara',                      'claoshiro99@gmail.com',                    4171, 813,   '19.50%',  162730, 2086,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'heyallieraye',         'Allie Raye',                 'midlifeglowupmode@gmail.com',              7275, 1765,  '24.30%',    54533, 1033,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'liarecs',              NULL,                         'Collabs.oaa@gmail.com',                    6474, 2760,  '42.60%', 1021815,  427,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'asalsetora',           'A S A L',                    'bebeasaal@gmail.com',                      7557, 1606,  '21.30%',  595512, 1524,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'haz.alia',             'Alia Haz',                   'aliahazpro@gmail.com',                     3083, 214,   '6.90%',  1528905, 2026,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'herewegrow24',         'Emily',                      'EmilyonTiktok25@gmail.com',                5979, 1566,  '26.20%',    33709,  523,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'maiii.finds',          'mai',                        'btiktokfinds@gmail.com',                   6112, 17,    '0.30%',  3144873,  785,  0.33, NULL,                                      NULL),
  -- Macro (60K+, no tier in schema)
  ('2026-05-20', get_active_phase_id(), 'dazi990',              'Jan',                        'blueprintbyj@gmail.com',                   5588, 324,   '5.80%',   242756,  484,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'kbeautymom75',         'Kbeautymom75',               'Kbeautyskincare75@gmail.com',             85078, 9909,  '11.60%', 1368535, 1749,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'summercooljinny',      'Jinny | Kbeauty',            'jinny@hugsandpeaches.com',                77594, 93,    '0.10%',  1882504,  392,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'eileenhernandezm',     'Eileen Hernandez',           'h.eileen29@icloud.com',                   77626, 269,   '0.30%',  3444715,  299,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'planetpaulc',          'Planet Paul',                'planetpaulchoi@gmail.com',                95264, 205,   '0.20%',  9531505,  398,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'ashlynjlopez',         'Ash',                        'teamash@stregagroup.com',                 94383, 406,   '0.40%',  6079355,  503,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'emma__ashleyy',        'EMMA ASHLEYY',               'contact@emmaashleyy.com',                 67214, 736,   '1.10%',  5151841,  130,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'sydneyychambers',      'sydneyy',                    'bettina.mahoney@grail-talent.com',         91599, 74,    '0.10%',  7616359,  212,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'gracezyzhang',         'grace zhang',                'gracezhiyi@gmail.com',                    94138, 86,    '0.10%',  5690877,  909,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'thelydiahall',         'Lydia Hall',                 'thelydiahall@gmail.com',                   85637, 138,   '0.20%',  2963212,  696,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'kennybsn',             'kenny',                      'kennybsn@outlook.com',                    70409, 9,     '0.00%',  7044862,  250,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'loginjudy',            'loginjudy',                  'loginjudychoi@gmail.com',                  63174, 34,    '0.10%',   935848,   31,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'mallysunos',           'mallysunos',                 'mallysunos@gmail.com',                     89452, 123,   '0.10%',  4395969,  141,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'yvetteciao',           'Yvette',                     'its.yvettechau@gmail.com',                 90872, 339,   '0.40%',  5759877,  861,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'amayanicolej',         'amayanicolej',               'amayanicolej02@gmail.com',                 66563, 102,   '0.20%',  3970559,   37,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'bibbinv',              'bibbinv',                    'bibbinvmanagement@gmail.com',              91204, 122,   '0.10%',  5456225, 2205,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'sarasstudies',         'Sara Megan',                 'smjmua4@gmail.com',                        88149, 536,   '0.60%',  3994642,  466,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'kyliekake',            'KYLIE KAKE',                 'kyliekake@thesociablesociety.com',         96853, 1461,  '1.50%',  3501618, 1214,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'wendybenson51',        'Wendy Benson',               'wendybenson51@iflytalent.com',             90699, 124,   '0.10%',  1288996,  566,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'chaly.garcia6',        'Chaly Garcia',               'chalianyelis@icloud.com',                  75491, 394,   '0.50%',  5656379, 1834,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'serinkongg',           'Serin Kong',                 'teamserin@glowgroup.studio',               93474, 107,   '0.10%',  4541669,  563,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'maiaaamarieee',        'Maia',                       'collabwmaia@gmail.com',                    78707, 91,    '0.10%',  4081926,  209,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'deathstatequilibrium', 'sebin',                      'sebin@dulcedo.com',                        69966, 297,   '0.40%',  1590546,  289,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'samanthakayy21',       'samanthakayy21',             'samantha@superstir.co',                    98581, 210,   '0.20%', 17733195,  386,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'therealbeatrixramosaj','Beatrix Ramosaj',            'beatrix@caagency.com',                     74934, 228,   '0.30%',  1662909,  263,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'sabrinahassann',       'IG Sabrinahassaan',          'sabrina@halotalentgroup.com',              98660, 774,   '0.80%', 12815512,  918,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'momopill',             'MOMOPILL',                   'momopilltheceo@gmail.com',                 90103, 593,   '0.70%',  5419617,  775,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'juliannahoffman4',     'Jules',                      'juliannahoffman@dulcedo.com',              64914, 672,   '1.00%',  4921625,  669,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'janeezhao',            'jane zhao',                  'janeezzhao@dulcedo.com',                   84150, 83,    '0.10%',  3531867,  431,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'slaybymunaa',          'slaybymunaa',                'muna@ykwtalent.com',                       66028, 239,   '0.40%',  3341676,  554,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'bear5784',             'EJB',                        'estherjung2024@gmail.com',                 68308, 564,   '0.80%',  6252402,  462,  0.33, NULL,                                      NULL),
  ('2026-05-20', get_active_phase_id(), 'orleannysjimenez_',    'Orleannys Jimenez',          'bookorleannys@gmail.com',                  88350, 136,   '0.20%', 18342437,  868,  0.33, NULL,                                      NULL),
  -- Batch 2: 2026-05-22
  ('2026-05-22', get_active_phase_id(), 'balette',              'balette',                    'baletteu@gmail.com',                       12475, 538,   '4.30%',  2581394,  337,  0.33, 'https://www.tiktok.com/@balette',         NULL),
  ('2026-05-22', get_active_phase_id(), 'notsofunnyany',        'notsofunnyany',              'any@mayvilleagency.com',                   22393, 196,   '0.90%',   517379,  218,  0.33, 'https://www.tiktok.com/@notsofunnyany',   NULL),
  ('2026-05-22', get_active_phase_id(), 'sunnnyluv',            NULL,                         '3maria.horta3@gmail.com',                  10876, 1102,  '10.10%', 1430600,  580,  0.33, 'https://www.tiktok.com/@sunnnyluv',       NULL),
  ('2026-05-22', get_active_phase_id(), 'greenreaper.xo',       NULL,                         'missreaper13@gmail.com',                   26559, 1725,  '6.50%',  1035164, 1128,  0.33, 'https://www.tiktok.com/@greenreaper.xo',  NULL),
  ('2026-05-22', get_active_phase_id(), 'kaiahtull',            'Kaiah Tull',                 'kaiahtull.business@gmail.com',             10654, 3383,  '31.80%',  126996,   82,  0.33, 'https://www.tiktok.com/@kaiahtull',       NULL),
  ('2026-05-22', get_active_phase_id(), 'edenmarquis',          'Eden Marquis',               'partnerships@quisagency.com',              41190, 1197,  '2.90%',  1626529,  843,  0.33, 'https://www.tiktok.com/@edenmarquis',     NULL),
  ('2026-05-22', get_active_phase_id(), 'realtalkwithrene',     'RealTalkWithRene',           'Renerheubottom@outlook.com',               14158, 973,   '6.90%',   966251, 1266,  0.33, 'https://www.tiktok.com/@realtalkwithrene',NULL),
  ('2026-05-22', get_active_phase_id(), 'dvn3ry.luvs.chae',     'Danery',                     'dvn3ry.collabs@gmail.com',                 17232, 2283,  '13.20%', 1314170,  356,  0.33, 'https://www.tiktok.com/@dvn3ry.luvs.chae',NULL),
  ('2026-05-22', get_active_phase_id(), 'asiangirlswrld',       'lindy | ugc',                'lindy.osborn7@gmail.com',                  16876, 362,   '2.10%',  3168107,  852,  0.33, 'https://www.tiktok.com/@asiangirlswrld',  NULL),
  ('2026-05-22', get_active_phase_id(), 'carolynvo',            'caro',                       'carolynvobeauty@gmail.com',                35466, 246,   '0.70%',  2206777,  672,  0.33, 'https://www.tiktok.com/@carolynvo',       NULL),
  ('2026-05-22', get_active_phase_id(), 'heidiann__',           'heidiann',                   'HeidiannUGC@gmail.com',                    43942, 573,   '1.30%',  2195568, 4494,  0.33, 'https://www.tiktok.com/@heidiann__',      NULL),
  ('2026-05-22', get_active_phase_id(), 'meskideribu',          'Meski',                      'Meskeremderibu44@gmail.com',               32623, 3680,  '11.30%',  259704, 1634,  0.33, 'https://www.tiktok.com/@meskideribu',     NULL),
  ('2026-05-22', get_active_phase_id(), 'tlynanxio',            'Teri Anxio',                 'terianxio.ugc@gmail.com',                  33803, 103,   '0.30%',  2473781,  414,  0.33, 'https://www.tiktok.com/@tlynanxio',       NULL),
  ('2026-05-22', get_active_phase_id(), 'lillasdiary',          'Lilla',                      'contact.lillasdiary@gmail.com',            26254, 416,   '1.60%',  2315889,  818,  0.33, 'https://www.tiktok.com/@lillasdiary',     NULL),
  ('2026-05-22', get_active_phase_id(), 'courtney__blake',      'Courtney Blake',             'courtneyblakecollabs@gmail.com',           36201, 287,   '0.80%',  2477903,  462,  0.33, 'https://www.tiktok.com/@courtney__blake', NULL),
  ('2026-05-22', get_active_phase_id(), 'lucasmarcie5',         'Marcie beautiful-UGC CREATOR','lucasmarcie5@gmail.com',                  44975, 841,   '1.90%',   115729,  166,  0.33, 'https://www.tiktok.com/@lucasmarcie5',    NULL),
  ('2026-05-22', get_active_phase_id(), 'playboymariie',        'B U N N Y',                  'contact.withlovemariie@gmail.com',         12848, 292,   '2.30%',    59667,  127,  0.33, 'https://www.tiktok.com/@playboymariie',   NULL),
  ('2026-05-22', get_active_phase_id(), 'beautywithtayy_',      'Taylor Tharp',               'taylor@pagermgmt.com',                     15077, 232,   '1.50%',   477023, 3455,  0.33, 'https://www.tiktok.com/@beautywithtayy_', NULL),
  ('2026-05-22', get_active_phase_id(), 'theone_finds',         'theonefinds',                'seenlate1@gmail.com',                      44223, 34,    '0.10%',  5443100, 2497,  0.33, 'https://www.tiktok.com/@theone_finds',    NULL),
  ('2026-05-22', get_active_phase_id(), 'kellylandsman',        'Kelly',                      'kellylandsman24@gmail.com',                19798, 817,   '4.10%',  1877903, 3607,  0.33, 'https://www.tiktok.com/@kellylandsman',   NULL),
  ('2026-05-22', get_active_phase_id(), 'mjvillafradez',        'mjvillafradez',              'mvillafradez88@gmail.com',                 35627, 458,   '1.30%',   725341,  713,  0.33, 'https://www.tiktok.com/@mjvillafradez',   NULL),
  ('2026-05-22', get_active_phase_id(), 'krealitygrace',        'Gracelyn',                   'krealitygrace@gmail.com',                  22252, 720,   '3.20%',  3307293,  976,  0.33, 'https://www.tiktok.com/@krealitygrace',   NULL),
  ('2026-05-22', get_active_phase_id(), 'sarajanewarner',       'SaraJane Warner',            'team@jenniferpowell.com',                  15394, 161,   '1.00%',   459637,  309,  0.33, 'https://www.tiktok.com/@sarajanewarner',  NULL),
  ('2026-05-22', get_active_phase_id(), 'leigha_chrstine',      'leigha chrstine',            'helloleighachrstine@gmail.com',            27718, 1811,  '6.50%',  1398954, 1165,  0.33, 'https://www.tiktok.com/@leigha_chrstine', NULL),
  ('2026-05-22', get_active_phase_id(), 'xojeimy',              'Jeimy',                      'jeimymartinez57630@gmail.com',             37288, 3926,  '10.50%', 1712625,  545,  0.33, 'https://www.tiktok.com/@xojeimy',         NULL),
  ('2026-05-22', get_active_phase_id(), 'itsmeyolandab',        'Yolanda B',                  'itsyolandab@gmail.com',                    38568, 2002,  '5.20%',   559715, 4891,  0.33, 'https://www.tiktok.com/@itsmeyolandab',   NULL),
  ('2026-05-22', get_active_phase_id(), 'neaveem',              'NEAVE',                      'nm80036@gmail.com',                        11552, 976,   '8.40%',  1059258, 1175,  0.33, 'https://www.tiktok.com/@neaveem',         NULL),
  ('2026-05-22', get_active_phase_id(), 'morganalisonstewart',  'Morgan | The Beauty Breakdown','morgan@thebeautybreakdown.com',           23494, 482,   '2.10%',   412701,  366,  0.33, 'https://www.tiktok.com/@morganalisonstewart',NULL),
  ('2026-05-22', get_active_phase_id(), 'kaylenedivinee',       'KAYLENE DIVINEE',            'kaylenedivinee@gmail.com',                 21875, 611,   '2.80%',  1153444, 1402,  0.33, 'https://www.tiktok.com/@kaylenedivinee',  NULL),
  ('2026-05-22', get_active_phase_id(), 'elainazli',            'elaina',                     'elainazli14@gmail.com',                    10592, 289,   '2.70%',   605922,  322,  0.33, 'https://www.tiktok.com/@elainazli',       NULL),
  ('2026-05-22', get_active_phase_id(), 'eli.ann21',            'Eliii Ann',                  'elisha@nowadaystalent.com',                31144, 1172,  '3.80%',  1396464, 2537,  0.33, 'https://www.tiktok.com/@eli.ann21',       NULL),
  ('2026-05-22', get_active_phase_id(), 'justacouple155',       'Cassi',                      'cassinunes155@gmail.com',                  20292, 465,   '2.30%',  1586963, 3029,  0.33, 'https://www.tiktok.com/@justacouple155',  NULL),
  ('2026-05-22', get_active_phase_id(), 'sseptemmberr',         's e p t e m b e r',          'september@sevengenesis.co',                46531, 515,   '1.10%',  3110470, 2911,  0.33, 'https://www.tiktok.com/@sseptemmberr',    NULL),
  ('2026-05-22', get_active_phase_id(), 'stephanie.centeno_',   'S T E P H A N I E',          'stephaniecenteno004@gmail.com',            15204, 4538,  '29.80%',  251260,  503,  0.33, 'https://www.tiktok.com/@stephanie.centeno_',NULL),
  ('2026-05-22', get_active_phase_id(), 'nainakate11',          'Naina',                      'Collab-naina.katel@gmail.com',             49896, 583,   '1.20%',   636440,  239,  0.33, 'https://www.tiktok.com/@nainakate11',     NULL),
  ('2026-05-22', get_active_phase_id(), 'tuti.fit',             'TUTI FIT',                   'tutifit@yahoo.com.Mira',                   49577, 4284,  '8.60%',   970013, 4150,  0.33, 'https://www.tiktok.com/@tuti.fit',        NULL),
  ('2026-05-22', get_active_phase_id(), 'daniellamagee',        'Daniella Magee',             'daniellamageecollab@gmail.com',            27973, 2214,  '7.90%',  1346841, 3869,  0.33, 'https://www.tiktok.com/@daniellamagee',   NULL),
  ('2026-05-22', get_active_phase_id(), 'brooklyntaylorxoxo',   'brooklyn',                   'inquiries@brooklyntaylorllc.com',          47477, 1150,  '2.40%',  1655573, 1147,  0.33, 'https://www.tiktok.com/@brooklyntaylorxoxo',NULL),
  ('2026-05-22', get_active_phase_id(), 'smilingrn',            'Megan | NJ/NYC',             'prsmilingrn@gmail.com',                    48228, 6660,  '13.80%', 1567014,  934,  0.33, 'https://www.tiktok.com/@smilingrn',       NULL),
  ('2026-05-22', get_active_phase_id(), 'beauty4ssma',          'bassma',                     'beautybybassma@gmail.com',                 14037, 845,   '6.00%',   622119,  392,  0.33, 'https://www.tiktok.com/@beauty4ssma',     NULL),
  ('2026-05-22', get_active_phase_id(), 'kimberlyyy.cat',       'kim',                        'kimberlyyycat@gmail.com',                  45155, 143,   '0.30%',  2724286,  245,  0.33, 'https://www.tiktok.com/@kimberlyyy.cat',  NULL),
  ('2026-05-22', get_active_phase_id(), 'keylattfinds',         'Keyla Espinal Finds',        'keylaespinaltiktok@gmail.com.Mira',        14666, 4656,  '31.70%',  243155, 2797,  0.33, 'https://www.tiktok.com/@keylattfinds',    NULL),
  -- Batch 3: 2026-05-26
  ('2026-05-26', get_active_phase_id(), 'blossom.bonds',        'Blossom Bonds',              '3peastiktokshop@gmail.com',                39807, 615,   '1.50%',  4677064, 3939,  0.33, 'https://www.tiktok.com/@blossom.bonds',   NULL),
  ('2026-05-26', get_active_phase_id(), 'stephsimons',          'Steph',                      'StephsimonsUGC@gmail.com',                 27571, 4330,  '15.70%',  854461, 5440,  0.84, 'https://www.tiktok.com/@stephsimons',     NULL),
  ('2026-05-26', get_active_phase_id(), 'itslexichristine',     'lexi',                       'alexiachristine.x@gmail.com',              30828, 793,   '2.60%',  3435408, 2327,  0.33, 'https://www.tiktok.com/@itslexichristine',NULL)
ON CONFLICT (phase_id, handle) DO NOTHING;

-- ============================================================
--  7. CONFIRMED ACCEPT INFLUENCERS — added 2026-06-09
-- ============================================================
INSERT INTO influencers (created_at, phase_id, platform, handle, display_name, followers, outreach)
VALUES
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'thatgirlkierstin',      'Kierstin Sedlak',           33000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'lovebylexis',           'Alexis Beasley',            23100, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'itskristv',             'Kristen Jones',              3300, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'stephssocute',          'Stephanie Perez',            3800, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'charity_017',           'Charity Luster',             4500, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'elssielee',             'Elssie Lee',                 7100, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'Creativvely',           'Luna Malfabon',              3200, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'anikafong',             'Anika Fong',                 3100, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'crazybeautifulmakeup',  'Heather Jannett',            4600, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'MGoldCreative',         'Marni Gold',                20700, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'jadetillman0',          'Jade Tillman',               7000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'victoriaxali',          'Alicia Cruz',                4400, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'Instagram', 'mamalifewali',          NULL,                         4200, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'renu_tamang22',         'Renu Taman',                 5500, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    '_.bxbydxll.x',         'Brianna Potts',              5000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'kelly_anne_81',         'Kelly Messier',              4300, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'alohabriee',            'Brieanna Welch-Chenier',     7400, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'hearherix',             'Heather Johnson',            8800, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'itsjudyshin',           'Judy Shin',                 10500, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'tinaangelinaaa',        'Tina Angelina',             22100, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'losernamedl',           'Lauren Mack',                6000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    '505afrolatina.barbiee', 'Kelsey Apodaca',            32300, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'yohannauc',             'Yohanna Urena',              5100, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'Kelsey.skincareee',     'Kelsey Nash',                5000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'whoisasxa',             'Asia Monique Mays',          1100, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'Pearlsearcher',         'Cindy Gahr',                 5000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'britta.loves',          'Britta Fernandes',          10000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'thelifeofruthie',       'Ruth Escamilla',             4300, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'burseygirl84reviews',   'Heather G. Bursey',          5000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'beccaa.mor',            'Rebecca Parker',             8000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    '_morchelle',            'Morchelle Plange',           5000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'bunnidollyy',           'Chelsea Rojas',             37400, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'Jordykaoir',            'Jordann La Fleur',          21200, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'tiltedtiramisu',        'Jessica Giang',             55700, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'vxmpirebunni',          'Nicole Lorenzo',             9000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'linlxvs',               'Soolin Hong',               63100, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'sarampena',             'Sara Smith-Pena',            5300, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'Holykaran',             'Jone Karan',                 5000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'Anahiiv._',             'Anahi Macias',               3200, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'sammiechennara',        'Somnang Dork',               9000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'visualsbyaverie',       'Averie Seno',               13200, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'Faces.by.Jamari',       'Jamari Johnson',             5200, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'Dainaxox',              'Ridaina Inayat',            11000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'ladyluck779',           'Sabina Gurung',             11000, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'xoxoluvjoan',           'Joan Kosisky',              13100, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'TikTok',    'laurentressler',        'Lauren Tressler',           18300, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'Magazine',  'a good hue',            'Amanda Morrow',              NULL, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'Magazine',  'Byrdie',                'Derek Deng',                 NULL, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'Magazine',  'Bust',                  'Bust',                       NULL, 'accept'),
  ('2026-06-09T00:00:00Z', get_active_phase_id(), 'Magazine',  'Allure',                'Dianna Singh',               NULL, 'accept')
ON CONFLICT (phase_id, handle) DO UPDATE SET
  platform     = EXCLUDED.platform,
  display_name = EXCLUDED.display_name,
  followers    = EXCLUDED.followers,
  outreach     = EXCLUDED.outreach;

-- ============================================================
--  8. CONFIRMED INFLUENCERS — auto-populate from accept rows
-- ============================================================
INSERT INTO confirmed_influencers (influencer_id, phase_id, email, upload_status)
SELECT i.id, i.phase_id, i.email, 'Pending'
FROM influencers i
WHERE i.outreach = 'accept'
  AND NOT EXISTS (
    SELECT 1 FROM confirmed_influencers c WHERE c.influencer_id = i.id
  );

-- ============================================================
--  9. CONFIRMED INFLUENCERS — bulk form data update
-- ============================================================
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
  ('thatgirlkierstin',      'Pending', 'O', '440-850-1231', '',                               '5220 Jaycee Ave',         'Apt 20',          'Ashtabula',            'OH', '44004', 'US'),
  ('lovebylexis',           'Pending', 'O', '972-921-9411', 'alexisbeasley84@gmail.com',       '730 FM 876',              '',                'Waxahachie',           'TX', '75167', 'US'),
  ('itskristv',             'Yes',     '▲', '512-584-4618', 'kristenmjones26@gmail.com',       '235 Tall Grass Dr',       '',                'Georgetown',           'TX', '78628', 'US'),
  ('stephssocute',          'Pending', 'O', '209-534-4413', 'steph.beauty97@gmail.com',        '470 W Wall Rd',           'Apt 121',         'Imperial',             'CA', '92252', 'US'),
  ('charity_017',           'Yes',     'O', '662-891-0628', 'collabswithcharity20@gmail.com',  '1180 County Rd 87',       '',                'New Albany',           'MS', '38652', 'US'),
  ('elssielee',             'Pending', 'O', '626-434-5818', 'elssiexlee@gmail.com',            '246 Amberwood Dr',        '',                'Walnut',               'CA', '91789', 'US'),
  ('Creativvely',           'Pending', 'X', '510-905-4672', 'creativvelyugc@gmail.com',        '128 N Humboldt St',       'Apt 4',           'San Mateo',            'CA', '94401', 'US'),
  ('anikafong',             'Yes',     'O', '940-315-9019', 'anikaafong@gmail.com',            '11025 Aledo Ln',          '',                'Aubrey',               'TX', '76227', 'US'),
  ('crazybeautifulmakeup',  'Yes',     'O', '865-386-4784', 'crazybeautifulmakeup@gmail.com',  '2408 Casona Ln',          'Apt 8107',        'Melbourne',            'FL', '32940', 'US'),
  ('MGoldCreative',         'Pending', '▲', '201-240-9006', 'marnivoice@gmail.com',            '482 Glenwood Ave',        '1st Floor',       'Teaneck',              'NJ', '07666', 'US'),
  ('jadetillman0',          'Yes',     'O', '478-972-4600', 'collabswithjadet@gmail.com',      '205 Meadow Run Dr',       '',                'Warner Robins',        'GA', '31088', 'US'),
  ('victoriaxali',          'Pending', '▲', '209-353-5662', 'aliciavcruz21@gmail.com',         '5333 10th St',            '',                'Keyes',                'CA', '95328', 'US'),
  ('renu_tamang22',         'Yes',     'O', '253-737-0539', 'renumangta1114@gmail.com',        '9807 S 248th St',         'Apt B6',          'Kent',                 'WA', '98030', 'US'),
  ('_.bxbydxll.x',         'Pending', 'O', '785-260-1938', 'briannapotts1717@gmail.com',      '5333 SW 15th Ct',         'Apt 2',           'Topeka',               'KS', '66604', 'US'),
  ('kelly_anne_81',         'Yes',     'O', '508-642-3793', 'Kellyannemgmt@gmail.com',         '470 Eastern Ave',         '',                'Fall River',           'MA', '02723', 'US'),
  ('alohabriee',            'Yes',     'O', '408-646-4640', 'brieanna.welch@gmail.com',        '180 South Brook Dr',      'Unit 2112',       'Leander',              'TX', '78641', 'US'),
  ('hearherix',             'Yes',     'O', '216-246-9619', 'heatherix127@gmail.com',          '19307 Wickfield Ave',     '',                'Warrensville Heights', 'OH', '44122', 'US'),
  ('itsjudyshin',           'Pending', 'X', '562-409-4559', 'itsjudyshin@gmail.com',           '511 Tamarind Way',        'Unit C',          'West Covina',          'CA', '91791', 'US'),
  ('tinaangelinaaa',        'Yes',     'O', '818-274-4575', 'partnerships@tinaangelina.com',   '95 Wall St',              'Unit 812',        'New York',             'NY', '10005', 'US'),
  ('losernamedl',           'Yes',     'O', '817-521-8412', 'losernamedl02@gmail.com',         '6070 Copperfield Dr',     'Apt 617',         'Fort Worth',           'TX', '76132', 'US'),
  ('505afrolatina.barbiee', 'Yes',     '▲', '505-755-3372', '505afrolatina.barbiee@gmail.com', '821 Los Arboles Ave NW',  '',                'Albuquerque',          'NM', '87107', 'US'),
  ('yohannauc',             'Yes',     '▲', '908-463-8306', 'yohannauc27@gmail.com',           '5 E Gibbons St',          '',                'Linden',               'NJ', '07036', 'US'),
  ('Kelsey.skincareee',     'Yes',     'O', '435-559-9048', 'pr_kelseynash@yahoo.com',         '1414 W 1650 S',           '',                'Cedar City',           'UT', '84720', 'US'),
  ('lazymxchi',             'Pending', 'O', '626-786-1187', 'oliviaxcollabs@gmail.com',        '413 NW 19th St',          '',                'Grand Prairie',        'TX', '75050', 'US'),
  ('whoisasxa',             'Pending', 'O', '708-565-0123', 'asiamonique.mays@gmail.com',      '19404 Oak Ave',           '',                'Country Club Hills',   'IL', '60478', 'US'),
  ('Pearlsearcher',         'Pending', 'O', '909-653-7113', 'cindyagahr@gmail.com',            '9417 Palo Verde Dr',      '',                'Hesperia',             'CA', '92344', 'US'),
  ('britta.loves',          'Yes',     'O', '618-419-0618', 'britta2477@gmail.com',            '2 High Crest Dr',         '',                'Belleville',           'IL', '62221', 'US'),
  ('thelifeofruthie',       'Pending', 'O', '979-398-0000', 'thelifeofruthie@gmail.com',       '178 Hilldale Dr',         '',                'Nederland',            'TX', '77627', 'US'),
  ('burseygirl84reviews',   'Pending', 'O', '978-967-7386', 'burseygirl@gmail.com',            '2 Carmena Rd',            '',                'Billerica',            'MA', '01821', 'US'),
  ('beccaa.mor',            'Pending', '▲', '954-588-0128', 'rebeccaparker290@gmail.com',      '6800 NW 39th Ave',        'Lot 228',         'Coconut Creek',        'FL', '33073', 'US'),
  ('_morchelle',            'Yes',     '▲', '813-618-0633', 'morchellie@gmail.com',            '6907 Neopolitan Ct',      '',                'Apollo Beach',         'FL', '33572', 'US'),
  ('bunnidollyy',           'Pending', 'O', '929-536-4038', 'xo.bunnidolly@gmail.com',         '4706 4th Ave',            'Apt 6',           'Brooklyn',             'NY', '11220', 'US'),
  ('Jordykaoir',            'Pending', 'O', '725-246-7756', 'jordykaoir@gmail.com',            '4360 Terrace Hill Rd',    'Bldg 12 Apt 102', 'Las Vegas',            'NV', '89103', 'US'),
  ('tiltedtiramisu',        'Pending', 'O', '215-570-8748', 'jessisamess.tiktok@gmail.com',    '1257 Heather Rd',         '',                'Ambler',               'PA', '19002', 'US'),
  ('vxmpirebunni',          'Pending', '▲', '219-546-3331', 'pxpnini@gmail.com',               '1207 Kiersted St',        '',                'Morris',               'IL', '60450', 'US'),
  ('linlxvs',               'Pending', 'O', '469-690-6187', 'soolinhong@gmail.com',            '306 Colusa Dr',           '',                'Lewisville',           'TX', '75056', 'US'),
  ('sarampena',             'Pending', '▲', '949-769-4834', 'saramarissa0505@gmail.com',       '100 Danforth Ave',        'Unit 216',        'Dobbs Ferry',          'NY', '10522', 'US'),
  ('Holykaran',             'Pending', 'O', '470-877-4282', 'jonekaran@hotmail.com',           '250 Battery Park Cir',    'Unit 531',        'Anderson',             'SC', '29621', 'US'),
  ('Anahiiv._',             'Yes',     'O', '559-5770508',  'maciasanahi1216@yahoo.com',       '1550 E Church Ave',       'Apt 211',         'Fresno',               'CA', '93706', 'US'),
  ('sammiechennara',        'Pending', 'O', '840-204-5985', 'babieprecious08@gmail.com',       '2988 S Clifton Ave',      '',                'Wichita',              'KS', '67210', 'US'),
  ('visualsbyaverie',       'Yes',     'O', '840-233-3764', 'averiecollabs@gmail.com',         '12927 Moreno Beach Dr',   'Apt 5108',        'Moreno Valley',        'CA', '92555', 'US'),
  ('Faces.by.Jamari',       'Yes',     'O', '336-942-4393', 'johnsonjamari484@gmail.com',      '3644 Mosby Dr',           '',                'Greensboro',           'NC', '27407', 'US'),
  ('Dainaxox',              'Yes',     '▲', '346-254-2871', 'ridianaxox@gmail.com',            '24615 Celestial Lily Dr', '',                'Katy',                 'TX', '77493', 'US'),
  ('ladyluck779',           'Yes',     'O', '716-342-9698', 'sobnamalone@gmail.com',           '109 Palmer Ave',          'Front',           'Kenmore',              'NY', '14217', 'US'),
  ('xoxoluvjoan',           'Pending', 'O', '410-660-7395', 'Joankosisky1998@gmail.com',       '15411 Potomac River Dr',  'Unit 448',        'Cobb Island',          'MD', '20625', 'US'),
  ('laurentressler',        'Yes',     'O', '904-514-9968', 'laurenmtressler@gmail.com',       '13050 Gran Bay Pkwy',     'Unit 438',        'Jacksonville',         'FL', '32258', 'US'),
  ('a good hue',            'Yes',     '',  '',             'amanda@agoodhueblog.com',          '3140 Buffalo Rd',         '',                'Ontario',              'CA', '91761', 'US'),
  ('Byrdie',                'Pending', '',  '626-695-9882', 'derekdeng888@gmail.com',           '180 Front St',            'Unit 7F',         'Brooklyn',             'NY', '11201', 'US'),
  ('Bust',                  'Pending', '',  '',             'edomash@laweekly.com',             '227 Sandy Springs Pl',    'Unit D102',       'Sandy Springs',        'GA', '30328', 'US'),
  ('Allure',                'Pending', '',  '518-935-7195', 'dianna_mazzone@condenast.com',     '1 World Trade Center',    '24th Floor',      'New York',             'NY', '10007', 'US')
) AS d(handle, upload_status, repost, phone, email, address_line_1, address_line_2, city, state, zip, country)
JOIN influencers i ON i.handle = d.handle
WHERE ci.influencer_id = i.id;

-- ============================================================
--  10. BRAND GENERAL & BRAND PERSONAL
--
--  These tables contain 300+ Korean-language brand records.
--  Import them via Supabase Dashboard → Table Editor → Import CSV.
--
--  IMPORTANT: The CSV files have a phase_id column with the OLD
--  UUID. After importing, run this one-liner to fix phase_id:
--
--    UPDATE brand_general
--    SET phase_id = get_active_phase_id()
--    WHERE phase_id IS NULL OR phase_id != get_active_phase_id();
--
--    UPDATE brand_personal
--    SET phase_id = get_active_phase_id()
--    WHERE phase_id IS NULL OR phase_id != get_active_phase_id();
--
--  CSV files to import:
--    brand_general.csv  → brand_general table
--      columns: brand_name, email, telephone, website  (skip phase_id — fix after)
--    brand_personal.csv → brand_personal table
--      columns: brand_name, contact_name, department, position,
--               personal_email, personal_phone, telephone, website
-- ============================================================

-- ============================================================
--  11. CONFIRMED BRANDS — backfill from brand tables after CSV import
-- ============================================================
-- Run after brand_general and brand_personal are imported and phase_id is fixed.

INSERT INTO confirmed_brands (brand_name, phase_id, email, phone, website)
SELECT bg.brand_name, bg.phase_id, bg.email[1], bg.telephone, bg.website
FROM brand_general bg
WHERE bg.status = 'accept'
  AND NOT EXISTS (
    SELECT 1 FROM confirmed_brands cb
    WHERE cb.brand_name = bg.brand_name AND cb.phase_id = bg.phase_id
  );

INSERT INTO confirmed_brands (brand_name, phase_id, email, contact_name, position, phone, website)
SELECT COALESCE(bp.brand_name, bp.company), bp.phase_id, bp.personal_email[1], bp.contact_name, bp.position, bp.personal_phone, bp.website
FROM brand_personal bp
WHERE bp.status = 'accept'
  AND NOT EXISTS (
    SELECT 1 FROM confirmed_brands cb
    WHERE cb.brand_name = COALESCE(bp.brand_name, bp.company) AND cb.phase_id = bp.phase_id
  );

-- ============================================================
--  12. BACKFILL MISSING PROFILE URLs (TikTok)
-- ============================================================
UPDATE influencers
SET profile_url = 'https://www.tiktok.com/@' || handle
WHERE (profile_url IS NULL OR profile_url = '')
  AND handle IS NOT NULL
  AND (platform IS NULL OR LOWER(platform) = 'tiktok');
