// ============================================================
//  TCM Creator Listup — TikTok Creator Marketplace API
//  Script Properties required:
//    TIKTOK_ACCESS_TOKEN, TIKTOK_APP_ID, TIKTOK_SECRET_KEY
//    APIFY_TOKEN
//
//  Flow: TCM discover → pre-filter (dedup, follow ratio) → Apify profile metadata → regex email
// ============================================================

const TCM_PROFILE_ACTOR = 'automation-lab~tiktok-profile-scraper';

const GAS_MAX_MS       = 5.75 * 60 * 1000; // hard cap — Google Apps Script ~6 min
const TCM_TIMEOUT_MS   = 2 * 60 * 1000;   // TCM discover only (independent clock)
const APIFY_TIMEOUT_MS = 5 * 60 * 1000;   // max Apify wait (clamped to remaining GAS time)
const APIFY_MIN_TIMEOUT_SEC = 300;        // Apify actor default is often 300s — too short for large runs
const APIFY_BATCH_SIZE = 200;             // profiles per Apify run — empirically stable to ~200 (timeouts ~250+)
const APIFY_SCRAPE_MAX = 200;             // max profiles sent to Apify (ceil(UI target × buffer), capped here)
const APIFY_RUN_MEMORY_MB = 4096;         // 4 GB per run (Apify default is often 512–1024)
const TCM_TARGET_MIN    = 10;
const TCM_TARGET_MAX    = 100;            // UI / request cap — not the Apify scrape cap

// TCM discover pool = UI target × poolBuffer (nano needs ×6 — sparse pool, heavy email/dedup loss).
// Apify scrape is capped separately at APIFY_SCRAPE_MAX (200) — poolBuffer does not multiply Apify cost.
function _tcmPoolBuffer_(minF, maxF) {
  if (maxF <= 10000) return 6; // nano (3K–10K) — e.g. target 100 → TCM pool 600, ~30% yield before filters
  return 2.5;                // micro+ (10K–50K, 60K–100K)
}

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

function _tcmCountryCode(raw) {
  var c = String(raw || '').trim().toUpperCase();
  return c || 'US';
}

function _tcmSearchPage(accountId, keyword, minF, maxF, page, token, countryCode) {
  const params = {
    tto_tcm_account_id: accountId,
    keyword_search    : keyword,
    min_followers     : minF,
    max_followers     : maxF,
    country_codes     : [_tcmCountryCode(countryCode)],
    page              : page,
    page_size         : 50,
  };
  return _tcmGet(
    'https://business-api.tiktok.com/open_api/v1.3/tto/tcm/creator/discover/',
    params,
    token
  );
}

function _tcmCollectTier(accountId, keywords, minF, maxF, collectTarget, token, deadline, countryCode) {
  const pool = {};
  let lastError = null;
  const kws = (keywords || []).map(function(k) { return String(k || '').trim(); }).filter(Boolean);
  if (!kws.length) return { pool: pool, lastError: '키워드 없음', perKeywordTarget: 0, keywordCount: 0 };

  const perKwTarget = Math.max(1, Math.ceil(collectTarget / kws.length));

  for (var ki = 0; ki < kws.length; ki++) {
    const kw = kws[ki];
    if (Object.keys(pool).length >= collectTarget) break;
    if (deadline && Date.now() > deadline) break;
    let kwAdded = 0;
    let page = 1;
    while (kwAdded < perKwTarget && Object.keys(pool).length < collectTarget) {
      if (deadline && Date.now() > deadline) break;
      const d = _tcmSearchPage(accountId, kw, minF, maxF, page, token, countryCode);
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
        if (h && !pool[h]) {
          pool[h] = c;
          kwAdded++;
          if (kwAdded >= perKwTarget) break;
        }
      }
      const totalPages = ((d.data || {}).page_info || {}).total_page || 1;
      if (page >= totalPages) break;
      page++;
      Utilities.sleep(800);
    }
  }
  return { pool: pool, lastError: lastError, perKeywordTarget: perKwTarget, keywordCount: kws.length };
}

function _buildHandleSet_(raw) {
  var set = {};
  if (!raw) return set;
  var list = Array.isArray(raw) ? raw : String(raw).split(',');
  for (var i = 0; i < list.length; i++) {
    var h = String(list[i] || '').trim().toLowerCase();
    if (h) set[h] = true;
  }
  return set;
}

function _regexEmail(bio) {
  var m = (bio || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

// Step 2 — free filters on TCM data BEFORE Apify (dedup + follow ratio); sync, no timeout
function _tcmSelectCandidates(pool, existingSet, maxRatioDec, limit, stats) {
  var candidates = [];
  for (var handle in pool) {
    if (candidates.length >= limit) break;
    var c = pool[handle];
    var hl = String(handle).toLowerCase();
    if (existingSet[hl]) { stats.dupes++; continue; }
    var followers = c.followers_count || 0;
    var following = c.following_count || 0;
    if (followers > 0 && following / followers > maxRatioDec) { stats.followRatio++; continue; }
    candidates.push({ handle: handle, tcm: c });
  }
  stats.apifyQueued = candidates.length;
  return candidates;
}

function _apifyToken_() {
  return PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN') || '';
}

function _apifyActorTimeoutSec_(profileCount) {
  // ~2–3s per profile; avoid Apify default ~300s "Actor timed out" on large batches
  return Math.min(3600, Math.max(APIFY_MIN_TIMEOUT_SEC, Math.ceil(profileCount * 3)));
}

function _apifyStartProfileRun(handles, token) {
  var payload = { profiles: handles };
  var timeoutSec = _apifyActorTimeoutSec_(handles.length);
  var url = 'https://api.apify.com/v2/acts/' + TCM_PROFILE_ACTOR + '/runs'
    + '?token=' + encodeURIComponent(token)
    + '&timeout=' + timeoutSec
    + '&memory=' + APIFY_RUN_MEMORY_MB;
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  var body = JSON.parse(res.getContentText());
  if (!body.data) return { error: 'Apify 오류: ' + res.getContentText().substring(0, 300) };
  return { runId: body.data.id, datasetId: body.data.defaultDatasetId, timeoutSec: timeoutSec };
}

function _apifyGetRun_(runId, token) {
  var res = UrlFetchApp.fetch(
    'https://api.apify.com/v2/actor-runs/' + runId + '?token=' + token,
    { muteHttpExceptions: true }
  );
  var data = JSON.parse(res.getContentText()).data;
  if (!data) return { error: 'Apify run 조회 실패' };
  return { status: data.status, datasetId: data.defaultDatasetId };
}

function _apifyWaitForRun(runId, token, deadline) {
  while (Date.now() < deadline) {
    var run = _apifyGetRun_(runId, token);
    if (run.error) return { error: run.error };
    if (run.status === 'SUCCEEDED') return { ok: true, datasetId: run.datasetId };
    if (run.status === 'FAILED' || run.status === 'ABORTED' || run.status === 'TIMED-OUT') {
      return { error: 'Apify 실행 실패: ' + run.status };
    }
    Utilities.sleep(4000);
  }
  // One last check — Apify often finishes seconds after our poll deadline
  var finalRun = _apifyGetRun_(runId, token);
  if (finalRun.status === 'SUCCEEDED') return { ok: true, datasetId: finalRun.datasetId };
  if (finalRun.error) return { error: finalRun.error };
  if (finalRun.status === 'FAILED' || finalRun.status === 'ABORTED' || finalRun.status === 'TIMED-OUT') {
    return { error: 'Apify 실행 실패: ' + finalRun.status };
  }
  return { error: 'Apify 시간 초과' };
}

function _apifyFetchDataset(datasetId, token) {
  var res = UrlFetchApp.fetch(
    'https://api.apify.com/v2/datasets/' + datasetId + '/items?token=' + token + '&limit=2000',
    { muteHttpExceptions: true }
  );
  var items = JSON.parse(res.getContentText());
  return Array.isArray(items) ? items : [];
}

/** Scrape handles in batches (default 200/run — safe below actor timeout ceiling ~250). */
function _apifyScrapeProfilesBatched(handles, token, deadline, requireEmail) {
  var merged = {};
  var noEmail = 0;
  var batchCount = 0;
  if (!handles.length) return { byHandle: merged, noEmail: 0, batchCount: 0 };

  for (var i = 0; i < handles.length; i += APIFY_BATCH_SIZE) {
    if (Date.now() > deadline) {
      return { error: 'Apify 시간 초과 (배치 ' + batchCount + ' 완료)', byHandle: merged, noEmail: noEmail, batchCount: batchCount };
    }
    var batch = handles.slice(i, i + APIFY_BATCH_SIZE);
    var started = _apifyStartProfileRun(batch, token);
    if (started.error) return { error: started.error, byHandle: merged, noEmail: noEmail, batchCount: batchCount };

    var batchWaitMs = Math.min(
      Math.max(deadline - Date.now(), 0),
      Math.max(90 * 1000, batch.length * 2500)
    );
    var waited = _apifyWaitForRun(started.runId, token, Date.now() + batchWaitMs);
    if (waited.error) {
      var err = waited.error;
      if (err.indexOf('FAILED') !== -1) {
        err += ' — 프로필 수가 많으면 목표를 낮추거나 Apify에서 memory를 늘려 주세요.';
      }
      return { error: err, byHandle: merged, noEmail: noEmail, batchCount: batchCount };
    }

    var items = _apifyFetchDataset(waited.datasetId, token);
    var parsed = _apifyProfilesToMap(items, requireEmail);
    var map = parsed.byHandle || {};
    for (var k in map) merged[k] = map[k];
    noEmail += parsed.noEmail || 0;
    batchCount++;
  }

  return { byHandle: merged, noEmail: noEmail, batchCount: batchCount };
}

// Rough engagement % from profile stats: (likes/video ÷ followers) × 100
function _tcmEngagementPct(followers, likesCount, videoCount) {
  if (!followers || !videoCount || !likesCount) return 0;
  return parseFloat(((likesCount / videoCount / followers) * 100).toFixed(2));
}

// automation-lab/tiktok-profile-scraper — one dataset row per profile (type: "profile")
function _parseAutomationLabProfile(item) {
  if (!item || item.errorCode) return null;
  if (item.type && item.type !== 'profile') return null;

  var handle = String(item.username || '').trim();
  if (!handle) return null;

  var bio = String(item.bio || '');
  var email = _regexEmail(bio) || _regexEmail(String(item.bioLink || ''));
  var followers = Number(item.followerCount) || 0;
  var following = Number(item.followingCount) || 0;
  var videoCount = Number(item.videoCount) || 0;
  var likesCount = Number(item.likesCount) || 0;

  return {
    handle      : handle,
    displayName : String(item.displayName || ''),
    avatarUrl   : String(item.avatarUrl || item.avatar || '').trim(),
    bio         : bio.substring(0, 500),
    email       : email,
    profileUrl  : String(item.profileUrl || ('https://www.tiktok.com/@' + handle)),
    followers   : followers,
    following   : following,
    totalLikes  : likesCount,
    videoCount  : videoCount,
    avgViews    : 0,
    engRate     : _tcmEngagementPct(followers, likesCount, videoCount),
  };
}

function _creatorFromProfile(p) {
  var followers = p.followers || 0;
  var following = p.following || 0;
  return {
    handle      : p.handle,
    displayName : p.displayName || '',
    avatarUrl   : p.avatarUrl || '',
    email       : p.email || '',
    followers   : followers,
    following   : following,
    ratio       : followers ? Math.round(following / followers * 100) + '%' : '',
    totalLikes  : p.totalLikes || 0,
    videoCount  : p.videoCount || 0,
    avgViews    : p.avgViews || 0,
    engRate     : p.engRate || 0,
    bio         : p.bio || '',
    profileUrl  : p.profileUrl || '',
  };
}

function _apifyProfilesToMap(items, requireEmail) {
  var byHandle = {};
  var noEmail = 0;

  for (var i = 0; i < items.length; i++) {
    var p = _parseAutomationLabProfile(items[i]);
    if (!p) continue;
    byHandle[p.handle.toLowerCase()] = p;
  }

  var result = {};
  for (var k in byHandle) {
    var prof = byHandle[k];
    if (requireEmail && !prof.email) { noEmail++; continue; }
    result[k] = prof;
  }

  return { byHandle: result, noEmail: noEmail, uploadSkipped: 0 };
}

// params: tierRank, tierLabel, tierTags, category, targetCount, keyword|keywords[], minF, maxF,
//         existingHandles, maxRatio (%), requireEmail, proxyCountry
const TCM_KEYWORD_MAX = 5;

function _tcmNormalizeKeywords(params) {
  if (Array.isArray(params.keywords)) {
    return params.keywords.map(function(k) { return String(k || '').trim(); }).filter(Boolean);
  }
  var single = String(params.keyword || '').trim();
  return single ? [single] : [];
}

function tcmRunSearch(params) {
  try {
    const cfg = _tcmCfg();
    if (!cfg.token) return { error: 'Script Properties에 TIKTOK_ACCESS_TOKEN을 추가하세요.' };

    const apifyToken = _apifyToken_();
    if (!apifyToken) return { error: 'Script Properties에 APIFY_TOKEN을 추가하세요.' };

    const accountId = _tcmGetAccountId(cfg);
    const tierRank  = params.tierRank;
    const targetRaw = parseInt(params.targetCount) || 20;
    const target    = Math.min(TCM_TARGET_MAX, Math.max(TCM_TARGET_MIN, targetRaw));

    if (!tierRank) return { error: '티어를 선택하세요.' };

    const kws = _tcmNormalizeKeywords(params);
    if (!kws.length) return { error: '키워드를 선택하세요.' };
    if (kws.length > TCM_KEYWORD_MAX) {
      return { error: '키워드는 최대 ' + TCM_KEYWORD_MAX + '개까지 선택할 수 있습니다.' };
    }

    const minF = parseInt(params.minF);
    const maxF = parseInt(params.maxF);
    if (!minF || !maxF) return { error: '팔로워 범위가 필요합니다.' };

    const tierLabel = params.tierLabel || tierRank;
    const tierTags  = params.tierTags || params.tags || '';
    const category  = params.category || (tierTags === 'kbeauty' ? 'K-뷰티' : '일반뷰티');
    const maxRatioDec   = (parseFloat(params.maxRatio) || 70) / 100;
    const requireEmail  = params.requireEmail !== false;
    const countryCode   = _tcmCountryCode(params.proxyCountry || params.country);
    const poolBuffer    = _tcmPoolBuffer_(minF, maxF);
    const collect       = Math.ceil(target * poolBuffer);
    const perKeywordTarget = Math.max(1, Math.ceil(target / kws.length));
    const runStart      = Date.now();
    const gasLimit      = runStart + GAS_MAX_MS;
    const tcmDeadline   = runStart + TCM_TIMEOUT_MS;

    // Step 1: TCM discover (own timeout — does not eat into Apify time)
    const collected = _tcmCollectTier(accountId, kws, minF, maxF, collect, cfg.token, tcmDeadline, countryCode);
    const pool = collected.pool;
    const lastError = collected.lastError;

    const existingSet = _buildHandleSet_(params.existingHandles);
    const scrapeLimit = Math.min(Math.ceil(target * poolBuffer), APIFY_SCRAPE_MAX);

    const stats = {
      poolSize      : Object.keys(pool).length,
      buffer        : poolBuffer,
      collectTarget : collect,
      scrapeLimit   : scrapeLimit,
      apifyBatchSize: APIFY_BATCH_SIZE,
      apifyScrapeMax: APIFY_SCRAPE_MAX,
      keywordCount  : kws.length,
      perKeywordTarget: perKeywordTarget,
      keywords      : kws,
      dupes         : 0,
      followRatio   : 0,
      apifyQueued   : 0,
      apifyScraped  : 0,
      apifyBatches  : 0,
      noEmail       : 0,
      uploadSkipped : 0,
      followerRange : 0,
      deadlineHit   : false,
      apiError      : lastError,
      country       : countryCode,
    };

    // Step 2: pre-filter BEFORE Apify (dedup + follow ratio) — saves Apify credits
    const candidates  = _tcmSelectCandidates(pool, existingSet, maxRatioDec, scrapeLimit, stats);

    if (!candidates.length) {
      return { ok: true, creators: [], count: 0, tier: tierRank, tierLabel: tierLabel, category, stats };
    }

    // Step 3: Apify profile scrape — batched to avoid actor OOM
    const handles = candidates.map(function(c) { return c.handle; });
    var apifyWaitMs = Math.min(
      APIFY_TIMEOUT_MS,
      Math.max(3 * 60 * 1000, handles.length * 2500)
    );
    var apifyDeadline = Math.min(gasLimit, Date.now() + apifyWaitMs);
    const scraped = _apifyScrapeProfilesBatched(handles, apifyToken, apifyDeadline, requireEmail);
    if (scraped.error && !Object.keys(scraped.byHandle || {}).length) {
      stats.deadlineHit = scraped.error.indexOf('시간 초과') !== -1;
      return { error: scraped.error };
    }
    if (scraped.error) stats.apiError = scraped.error;

    const parsed = { byHandle: scraped.byHandle || {}, noEmail: scraped.noEmail || 0 };
    stats.apifyScraped = Object.keys(parsed.byHandle).length;
    stats.apifyBatches = scraped.batchCount || 0;
    stats.noEmail += parsed.noEmail;

    // Step 4: build creators up to target (Apify counts = source of truth for display)
    const creators = [];
    for (var ci = 0; ci < candidates.length; ci++) {
      if (creators.length >= target) break;
      var cand = candidates[ci];
      var prof = parsed.byHandle[String(cand.handle).toLowerCase()];
      if (!prof) continue;
      if (prof.followers < minF || prof.followers > maxF) {
        stats.followerRange++;
        continue;
      }
      creators.push(_creatorFromProfile(prof));
    }

    return { ok: true, creators: creators, count: creators.length, tier: tierRank, tierLabel: tierLabel, category, stats };
  } catch(e) {
    return { error: e.toString() };
  }
}

// ── Apify run helpers (manual Run/Dataset ID load + polling) ──

function _tcmResolveSearchFilters(searchFilters, filterConditions, legacy) {
  var sf = searchFilters || {};
  var leg = legacy || {};

  var flags = {
    followerMin:         +(sf.followerMin || leg.followerMin) || 0,
    followerMax:         +(sf.followerMax || leg.followerMax) || 0,
    maxCreators:         +(sf.maxCreators || leg.maxCreators || leg.targetCreators) || 0,
    maxFollowingRatio:   +(sf.maxRatio || sf.maxFollowingRatio || leg.maxFollowingRatio) || 0,
    maxUploadDays:       +(sf.maxUploadDays || leg.maxUploadDays) || 0,
    proxyCountry:        sf.proxyCountry || leg.proxyCountry || 'US',
    requireEmail:        sf.requireEmail !== false,
    dedupExisting:       false,
    manualReview:        [],
  };

  if (filterConditions && filterConditions.length) {
    for (var i = 0; i < filterConditions.length; i++) {
      var fc = filterConditions[i] || {};
      var cat = String(fc.cat || '').trim();
      var desc = String(fc.desc || '').trim();

      if (fc.manual || cat.indexOf('영상') !== -1 || cat.indexOf('퀄리티') !== -1) {
        if (cat) flags.manualReview.push({ cat: cat, desc: desc });
        continue;
      }
      if (fc.type === 'dedup' || cat.indexOf('중복') !== -1 || desc.indexOf('중복') !== -1) {
        if (fc.enabled !== false) flags.dedupExisting = true;
      }
      if (cat.indexOf('이메일') !== -1 || desc.indexOf('이메일') !== -1) {
        flags.requireEmail = true;
      }
    }
  }

  return flags;
}

function tcmCheckRunStatus(runId) {
  try {
    const token = _apifyToken_();
    if (!token) return { error: 'Script Properties에 APIFY_TOKEN을 추가하세요.' };
    const res = UrlFetchApp.fetch(
      'https://api.apify.com/v2/actor-runs/' + runId + '?token=' + token,
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) {
      return { error: 'Run not found', notFound: true };
    }
    const body = JSON.parse(res.getContentText());
    if (!body.data) return { error: 'Run not found', notFound: true };
    return { status: body.data.status, datasetId: body.data.defaultDatasetId };
  } catch (e) {
    return { error: e.toString() };
  }
}

function tcmGetRunResults(datasetId, searchFilters, filterConditions, existingHandles, legacy) {
  try {
    const flags = _tcmResolveSearchFilters(searchFilters, filterConditions, legacy);
    const token = _apifyToken_();
    if (!token) return { error: 'Script Properties에 APIFY_TOKEN을 추가하세요.' };
    const limit = Math.min(500, Math.max(50, (flags.maxCreators || 100) * 5));
    const res = UrlFetchApp.fetch(
      'https://api.apify.com/v2/datasets/' + datasetId + '/items?token=' + token + '&limit=' + limit,
      { muteHttpExceptions: true }
    );
    const items = JSON.parse(res.getContentText());
    const existingSet = flags.dedupExisting ? _buildHandleSet_(existingHandles) : {};

    var noEmailSkipped = 0;
    var dedupSkipped = 0;
    var filtered = [];
    var cap = flags.maxCreators > 0 ? flags.maxCreators : 0;

    for (var i = 0; i < items.length; i++) {
      var p = _parseAutomationLabProfile(items[i]);
      if (!p) continue;

      if (flags.followerMin && p.followers < flags.followerMin) continue;
      if (flags.followerMax && p.followers > flags.followerMax) continue;
      if (flags.maxFollowingRatio > 0 && p.followers > 0 &&
          (p.following / p.followers * 100) > flags.maxFollowingRatio) continue;
      if (flags.requireEmail && (!p.email || !String(p.email).trim())) { noEmailSkipped++; continue; }
      if (flags.dedupExisting && existingSet[String(p.handle).toLowerCase()]) { dedupSkipped++; continue; }

      filtered.push(_creatorFromProfile(p));
      if (cap > 0 && filtered.length >= cap) break;
    }

    const limited = cap > 0 ? filtered.slice(0, cap) : filtered;
    return {
      ok: true,
      creators: limited,
      noEmailSkipped: noEmailSkipped,
      dedupSkipped: dedupSkipped,
      appliedFilters: {
        followerMin: flags.followerMin,
        followerMax: flags.followerMax,
        maxFollowingRatio: flags.maxFollowingRatio,
        maxUploadDays: flags.maxUploadDays,
        maxCreators: flags.maxCreators,
        requireEmail: flags.requireEmail,
        dedupExisting: flags.dedupExisting,
      },
      manualReview: flags.manualReview,
    };
  } catch (e) {
    return { error: e.toString() };
  }
}

function _tcmResolveDatasetId(id) {
  if (!id) return { error: 'ID가 필요합니다.' };
  var token = _apifyToken_();
  if (!token) return { error: 'Script Properties에 APIFY_TOKEN을 추가하세요.' };

  var runRes = UrlFetchApp.fetch(
    'https://api.apify.com/v2/actor-runs/' + id + '?token=' + token,
    { muteHttpExceptions: true }
  );
  if (runRes.getResponseCode() === 200) {
    var runBody = JSON.parse(runRes.getContentText());
    if (runBody.data) {
      if (runBody.data.status !== 'SUCCEEDED') {
        return { error: 'Run 미완료: ' + runBody.data.status, status: runBody.data.status };
      }
      return { datasetId: runBody.data.defaultDatasetId };
    }
  }

  var dsRes = UrlFetchApp.fetch(
    'https://api.apify.com/v2/datasets/' + id + '?token=' + token,
    { muteHttpExceptions: true }
  );
  if (dsRes.getResponseCode() === 200) return { datasetId: id };

  return { error: '유효하지 않은 Run ID 또는 Dataset ID입니다.' };
}

function tcmLoadCreatorResults(params) {
  var p = params || {};
  var datasetId = p.datasetId;
  if (!datasetId) {
    var resolved = _tcmResolveDatasetId(p.runId || p.id);
    if (resolved.error) return resolved;
    datasetId = resolved.datasetId;
  }
  return tcmGetRunResults(
    datasetId,
    p.searchFilters,
    p.filterConditions,
    p.existingHandles,
    p
  );
}

function routeTcmListup(action, p, body) {
  const b = body || {}, q = p || {};
  switch (action) {
    case 'tcmRunSearch':      return tcmRunSearch(b.params);
    case 'checkRunStatus':    return tcmCheckRunStatus(q.runId || b.runId);
    case 'getRunResults':     return tcmGetRunResults(
      q.datasetId || b.datasetId,
      b.searchFilters || q.searchFilters,
      b.filterConditions || q.filterConditions,
      b.existingHandles || q.existingHandles,
      b
    );
    case 'loadCreatorResults': return tcmLoadCreatorResults(b);
    default: return null;
  }
}
