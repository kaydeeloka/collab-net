// ============================================================
//  TCM Creator Listup — TikTok Creator Marketplace API
//  Script Properties required:
//    TIKTOK_ACCESS_TOKEN, TIKTOK_APP_ID, TIKTOK_SECRET_KEY
//
//  One tier per call: params.tierRank + params.targetCount
//  Results saved to K-뷰티 / 일반뷰티 sheets (18 columns each)
// ============================================================

// 17 columns — must match the K-뷰티 / 일반뷰티 sheet headers exactly
const TCM_LISTUP_HEADERS = [
  'Timestamp', '순위', 'Handle', 'Display Name', 'Email',
  'Followers', 'Following', 'Following Ratio (%)',
  'Total Likes', 'Video Count', 'Avg Views',
  'Engagement Rate (%)', 'Bio', 'Profile URL',
  'Outreach', 'Reply Body', 'Reply Date',
];

const TCM_MAX_RATIO = 0.70;

const TCM_KBEAUTY_KEYWORDS = [
  'kbeauty', 'korean skincare', 'glass skin',
  'korean beauty', 'korean makeup', 'kbeauty review',
];
const TCM_BEAUTY_KEYWORDS = [
  'beauty creator', 'beauty influencer', 'makeup tips',
  'skincare', 'skincare routine', 'glow skin',
];
const TCM_TIERS = [
  { rank: '1순위', label: '마이크로 (10K~50K)', minF:  10000, maxF:  50000, tags: 'kbeauty' },
  { rank: '2순위', label: '마이크로 (10K~50K)', minF:  10000, maxF:  50000, tags: 'beauty'  },
  { rank: '3순위', label: '나노 (3K~10K)',      minF:   3000, maxF:  10000, tags: 'kbeauty' },
  { rank: '4순위', label: '나노 (3K~10K)',      minF:   3000, maxF:  10000, tags: 'beauty'  },
  { rank: '5순위', label: '미드 (60K~100K)',    minF:  60000, maxF: 100000, tags: 'kbeauty' },
];

function _tcmCfg() {
  const p = PropertiesService.getScriptProperties();
  return {
    token : p.getProperty('TIKTOK_ACCESS_TOKEN') || '',
    appId : p.getProperty('TIKTOK_APP_ID')       || '',
    secret: p.getProperty('TIKTOK_SECRET_KEY')   || '',
  };
}

// ── One-time token setup ──────────────────────────────────────
// Step 1: open this URL in a browser (replace YOUR_APP_ID and YOUR_REDIRECT_URI):
//   https://business-api.tiktok.com/portal/auth?app_id=YOUR_APP_ID&state=mimuse&redirect_uri=YOUR_REDIRECT_URI
// Step 2: after authorizing, TikTok redirects to your redirect_uri with ?auth_code=XXXX in the URL.
// Step 3: paste that auth_code into the line below and run this function once from the GAS editor.
function tcmExchangeAuthCode() {
  const AUTH_CODE = 'PASTE_AUTH_CODE_HERE';   // ← replace this

  const p      = PropertiesService.getScriptProperties();
  const appId  = p.getProperty('TIKTOK_APP_ID')   || '';
  const secret = p.getProperty('TIKTOK_SECRET_KEY') || '';

  if (AUTH_CODE === 'PASTE_AUTH_CODE_HERE') {
    Logger.log('AUTH_CODE를 먼저 붙여넣으세요.');
    return;
  }

  const res = UrlFetchApp.fetch(
    'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
    {
      method     : 'post',
      contentType: 'application/json',
      payload    : JSON.stringify({ app_id: appId, secret, auth_code: AUTH_CODE }),
      muteHttpExceptions: true,
    }
  );
  const d = JSON.parse(res.getContentText());
  Logger.log('응답: ' + JSON.stringify(d));
  if ((d.code || 0) !== 0) { Logger.log('발급 실패: ' + d.message); return; }

  p.setProperty('TIKTOK_ACCESS_TOKEN', d.data.access_token);
  Logger.log('장기 액세스 토큰 저장 완료 (만료 없음). 광고주 ID: ' + JSON.stringify(d.data.advertiser_ids));
}

function _tcmGet(url, params, token) {
  const qs = Object.entries(params).map(([k, v]) =>
    k + '=' + encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : v)
  ).join('&');
  try {
    const res = UrlFetchApp.fetch(url + '?' + qs, {
      headers: { 'Access-Token': token },
      muteHttpExceptions: true,
    });
    return JSON.parse(res.getContentText());
  } catch(e) {
    return { code: -1, message: e.toString() };
  }
}

function _tcmGetAccountId(cfg) {
  const d = _tcmGet(
    'https://business-api.tiktok.com/open_api/v1.3/tto/oauth2/tcm/',
    { app_id: cfg.appId, secret: cfg.secret },
    cfg.token
  );
  const ids = ((d.data || {}).tto_tcm_account_ids) || [];
  if (!ids.length) throw new Error('TCM account ID 없음: ' + (d.message || JSON.stringify(d)));
  return ids[0];
}

function _tcmSearchPage(accountId, keyword, minF, maxF, page, token, genderRatio) {
  const params = {
    tto_tcm_account_id: accountId,
    keyword_search    : keyword,
    min_followers     : minF,
    max_followers     : maxF,
    country_codes     : ['US'],
    page              : page,
    page_size         : 50,
  };
  // 'FEMALE_50' = >50% female audience, 'FEMALE_60' = >60% female audience
  if (genderRatio) params.follower_gender_ratio = genderRatio;
  return _tcmGet(
    'https://business-api.tiktok.com/open_api/v1.3/tto/tcm/creator/discover/',
    params,
    token
  );
}

function _tcmCollectTier(accountId, keywords, minF, maxF, collectTarget, token, deadline, genderRatio) {
  const pool = {};
  let lastError = null;
  for (const kw of keywords) {
    if (Object.keys(pool).length >= collectTarget) break;
    if (deadline && Date.now() > deadline) break;
    let page = 1;
    while (Object.keys(pool).length < collectTarget) {
      if (deadline && Date.now() > deadline) break;
      const d = _tcmSearchPage(accountId, kw, minF, maxF, page, token, genderRatio);
      if ((d.code || 0) !== 0) {
        lastError = 'code ' + d.code + ': ' + (d.message || JSON.stringify(d));
        break;
      }
      const creators = ((d.data || {}).creators) || [];
      if (!creators.length) break;
      for (const c of creators) {
        const fc = c.followers_count || 0;
        if (fc < minF || fc > maxF) continue;
        const h = c.handle_name || '';
        if (h && !pool[h]) pool[h] = c;
      }
      const totalPages = ((d.data || {}).page_info || {}).total_page || 1;
      if (page >= totalPages) break;
      page++;
      Utilities.sleep(800);
    }
  }
  return { pool, lastError };
}

function _scrapeBio(handle) {
  try {
    const res = UrlFetchApp.fetch('https://www.tiktok.com/@' + handle, {
      headers: {
        'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      muteHttpExceptions: true,
      followRedirects   : true,
    });
    const html = res.getContentText();

    // Try JSON blob first
    const m1 = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (m1) {
      try {
        const data = JSON.parse(m1[1]);
        const user = ((data.__DEFAULT_SCOPE__ || {})['webapp.user-detail'] || {}).userInfo?.user || {};
        if (user.signature) return user.signature;
      } catch(e) {}
    }

    // Fallback: og:description — format: "Name (@h) on TikTok | X Likes. Y Followers. {BIO}.Watch..."
    const m2 = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)/);
    if (m2) {
      let desc = m2[1]
        .replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&').replace(/&#x2F;/g, '/');
      const bioMatch = desc.match(/Followers\.\s*([\s\S]*?)\s*[.。](?:Watch|Join)\s/);
      if (bioMatch) return bioMatch[1].trim();
      return desc;
    }
  } catch(e) {}
  return '';
}

function _regexEmail(bio) {
  const m = (bio || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

function _groqEmail(bio, handle) {
  const key = PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY') || '';
  if (!key || !bio) return '';
  try {
    const res = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
      method     : 'post',
      contentType: 'application/json',
      headers    : { 'Authorization': 'Bearer ' + key },
      payload    : JSON.stringify({
        model   : 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content:
          'Extract the contact email from this TikTok bio for @' + handle + '.\n' +
          'Bio: "' + bio + '"\n' +
          'Reply with ONLY the email address (e.g. name@gmail.com), or "none".'
        }],
        max_tokens : 50,
        temperature: 0,
      }),
      muteHttpExceptions: true,
    });
    const d      = JSON.parse(res.getContentText());
    const result = (((d.choices || [])[0] || {}).message || {}).content || '';
    const trimmed = result.trim();
    if (!trimmed || trimmed.toLowerCase() === 'none') return '';
    return _regexEmail(trimmed) || (trimmed.includes('@') ? trimmed : '');
  } catch(e) {
    return '';
  }
}

function _extractEmailFromBio(c) {
  const bio = c.bio_description || c.signature || c.bio || '';
  return c._email || _regexEmail(bio);
}

function _tcmBuildRow(c, rank, tierLabel, group) {
  const handle    = c.handle_name    || '';
  const followers = c.followers_count || 0;
  const following = c.following_count || 0;
  const avgViews  = c.avg_video_views || c.average_views || c.avg_views || c.averageViews || 0;
  // Prefer API-provided engagement_rate (decimal 0–1); fall back to likes/avg-views calc
  let engRate = '';
  if (c.engagement_rate != null) {
    const raw = Number(c.engagement_rate);
    engRate = parseFloat((raw < 1 ? raw * 100 : raw).toFixed(2));
  } else if (avgViews > 0) {
    engRate = parseFloat(((c.likes_count || 0) / avgViews * 100).toFixed(2));
  }
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return [
    today,                                              // Timestamp
    rank,                                               // 순위
    handle,                                             // Handle
    c.display_name || '',                               // Display Name
    _extractEmailFromBio(c),                            // Email
    followers,                                          // Followers
    following,                                          // Following
    followers ? (following / followers * 100).toFixed(1) + '%' : '', // Following Ratio (%)
    c.likes_count  || 0,                                // Total Likes
    c.videos_count || 0,                                // Video Count
    avgViews,                                           // Avg Views
    engRate,                                            // Engagement Rate (%)
    c.bio_description || c.signature || c.bio || '',    // Bio
    handle ? 'https://www.tiktok.com/@' + handle : '',  // Profile URL
    '',                                                 // Outreach
    '',                                                 // Reply Body
    '',                                                 // Reply Date
  ];
}

function _tcmGetExistingHandles(ss, sheetName) {
  const existing = new Set();
  try {
    const ws = ss.getSheetByName(sheetName);
    if (!ws || ws.getLastRow() < 2) return existing;
    const handleCol = TCM_LISTUP_HEADERS.findIndex(h => h.toLowerCase() === 'handle') + 1;
    if (handleCol < 1) return existing;
    ws.getRange(2, handleCol, ws.getLastRow() - 1, 1)
      .getValues()
      .forEach(r => { if (r[0]) existing.add(r[0].toString().toLowerCase()); });
  } catch(e) {}
  return existing;
}

// ── Main entry ────────────────────────────────────────────────
// params.tierRank   : '1순위' | '2순위' | '3순위' | '4순위' | '5순위'
// params.targetCount: number — how many creators WITH email to return
// params.keyword    : single keyword string (required from UI)
function tcmRunSearch(params) {
  try {
    const cfg = _tcmCfg();
    if (!cfg.token) return { error: 'Script Properties에 TIKTOK_ACCESS_TOKEN을 추가하세요.' };

    const accountId = _tcmGetAccountId(cfg);
    const tierRank  = params.tierRank;
    const target    = parseInt(params.targetCount) || 20;

    const tier = TCM_TIERS.find(t => t.rank === tierRank);
    if (!tier) return { error: '티어를 선택하세요.' };

    const kws         = params.keyword
      ? [params.keyword]
      : (tier.tags === 'kbeauty' ? TCM_KBEAUTY_KEYWORDS : TCM_BEAUTY_KEYWORDS);
    const minF        = parseInt(params.minF) || tier.minF;
    const maxF        = parseInt(params.maxF) || tier.maxF;
    const genderRatio = params.genderRatio || ''; // 'FEMALE_50' | 'FEMALE_60' | ''
    const collect     = target * 8;
    const deadline    = Date.now() + 4.5 * 60 * 1000;

    // Step 1: collect raw pool
    const { pool, lastError } = _tcmCollectTier(accountId, kws, minF, maxF, collect, cfg.token, deadline, genderRatio);

    // Pre-load handles already in the target sheet so duplicates don't consume target slots
    const sheetName = tier.tags === 'kbeauty' ? SHEET_K_BEAUTY : SHEET_GENERAL_BEAUTY;
    let existingHandles;
    try {
      const ssRef = SpreadsheetApp.openById(getActiveOutreachId());
      existingHandles = _tcmGetExistingHandles(ssRef, sheetName);
    } catch(e) {
      existingHandles = new Set();
    }

    const stats = {
      poolSize    : Object.keys(pool).length,
      existing    : existingHandles.size,
      dupes       : 0,
      followRatio : 0,
      noProfile   : 0,
      noEmail     : 0,
      checked     : 0,
      deadlineHit : false,
      apiError    : lastError,
    };

    // Step 2: filter by follow ratio, then fetch /creator/public/ for bio/email.
    // 40100 per creator = that creator has no public TCM profile → skip, try next.
    const rows = [];
    for (const [handle, c] of Object.entries(pool)) {
      if (rows.length >= target) break;
      if (Date.now() > deadline) { stats.deadlineHit = true; break; }

      // Skip creators already saved in the sheet
      if (existingHandles.has(handle.toLowerCase())) { stats.dupes++; continue; }

      const followers = c.followers_count || 0;
      const following = c.following_count || 0;
      if (followers > 0 && following / followers > TCM_MAX_RATIO) { stats.followRatio++; continue; }

      const d = _tcmGet(
        'https://business-api.tiktok.com/open_api/v1.3/tto/tcm/creator/public/',
        { tto_tcm_account_id: accountId, handle_name: handle },
        cfg.token
      );
      stats.checked++;

      // Try /creator/public/ first; fall back to scraping profile page if 40100
      const code = d.code || 0;
      let bio = '';
      if (code === 0) {
        const pub = d.data || {};
        bio = pub.bio_description || pub.signature || pub.bio || pub.introduction || '';
        if (pub.engagement_rate != null) c.engagement_rate = pub.engagement_rate;
      } else {
        stats.noProfile++;
        bio = _scrapeBio(handle);
      }
      c.bio_description = bio;

      // Regex first, Groq fallback for obfuscated emails
      let email = _regexEmail(bio);
      if (!email && bio) email = _groqEmail(bio, handle);
      if (!email) { stats.noEmail++; continue; }

      c._email = email;
      rows.push(_tcmBuildRow(c, tier.rank, tier.label, tier.tags));
      Utilities.sleep(200);
    }

    const category = tier.tags === 'kbeauty' ? 'K-뷰티' : '뷰티';
    return { ok: true, rows, count: rows.length, tier: tier.rank, tierLabel: tier.label, category, stats };
  } catch(e) {
    return { error: e.toString() };
  }
}

function tcmSaveToSheet(kRows, bRows) {
  try {
    const ss = SpreadsheetApp.openById(getActiveOutreachId());
    const kRes = kRows.length ? _tcmAppendTab(ss, SHEET_K_BEAUTY,       kRows, TCM_LISTUP_HEADERS) : { added: 0, dupes: 0 };
    const bRes = bRows.length ? _tcmAppendTab(ss, SHEET_GENERAL_BEAUTY, bRows, TCM_LISTUP_HEADERS) : { added: 0, dupes: 0 };
    return { ok: true, kCount: kRes.added, bCount: bRes.added, kDupes: kRes.dupes, bDupes: bRes.dupes };
  } catch(e) {
    return { error: e.toString() };
  }
}

function _tcmAppendTab(ss, name, rows, headers) {
  let ws = ss.getSheetByName(name);
  if (!ws) ws = ss.insertSheet(name);
  if (ws.getLastRow() === 0) {
    ws.getRange(1, 1, 1, headers.length).setValues([headers]);
    ws.setFrozenRows(1);
  }

  // Deduplicate by Handle — skip rows whose handle already exists in the sheet
  const handleIdx = headers.findIndex(h => h.toLowerCase() === 'handle');
  const existingHandles = new Set();
  if (handleIdx >= 0 && ws.getLastRow() > 1) {
    ws.getRange(2, handleIdx + 1, ws.getLastRow() - 1, 1)
      .getValues()
      .forEach(r => { if (r[0]) existingHandles.add(r[0].toString().toLowerCase()); });
  }
  const newRows = handleIdx >= 0
    ? rows.filter(r => {
        const h = (r[handleIdx] || '').toString().toLowerCase();
        return h && !existingHandles.has(h);
      })
    : rows;

  if (newRows.length > 0) {
    ws.getRange(ws.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  }
  return { added: newRows.length, dupes: rows.length - newRows.length };
}

function routeTcmListup(action, p, body) {
  const b = body || {};
  switch (action) {
    case 'tcmRunSearch':   return tcmRunSearch(b.params);
    case 'tcmSaveToSheet': return tcmSaveToSheet(b.kRows || [], b.bRows || []);
    default: return null;
  }
}
