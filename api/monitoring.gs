// ============================================================
//  Tab: 인플루언서 모니터링
//  All data lives in Supabase — no Google Sheets dependency.
//  Keywords: monitoring_keywords table (same source as dashboard)
//  Storage (run supabase/monitoring_assets_bucket.sql once):
//    monitoring-thumbnails — public JPG (→ monitoring_assets.thumbnail_path)
//    monitoring-videos     — private MP4 (→ monitoring_assets.video_path)
// ============================================================

function _emptyMonitoringKeywords() {
  return { mimuse: [], byBrand: {} };
}

function _keywordsFromRows(rows) {
  var result = _emptyMonitoringKeywords();
  if (!Array.isArray(rows)) return result;
  rows.forEach(function(row) {
    if (!row.brand || !Array.isArray(row.keywords)) return;
    if (row.brand === 'mimuse' && !row.phase_id) {
      result.mimuse = row.keywords;
    } else if (row.phase_id) {
      result.byBrand[row.brand] = row.keywords;
    }
  });
  return result;
}

// ── Read monitoring data from Supabase (helpers: supabase.gs) ──

function getMonitoringData() {
  const { url, key } = supabaseConfig();
  if (!url || !key) return _emptyMonitoring('SUPABASE_PROJECT_URL / SUPABASE_KEY가 Script Properties에 설정되지 않았습니다.');

  try {
    const res = UrlFetchApp.fetch(
      url + '/rest/v1/monitoring?select=date,brand,review_link,views,likes,comments,keywords,updated&order=date.desc',
      { headers: supabaseHeaders(), muteHttpExceptions: true }
    );
    const rows = JSON.parse(res.getContentText());
    if (!Array.isArray(rows)) return _emptyMonitoring('Supabase 오류: ' + res.getContentText());

    const reviewRows = rows.filter(function(r) { return r.review_link && r.review_link.startsWith('http'); });
    const totalViews    = reviewRows.reduce(function(s, r) { return s + (r.views    || 0); }, 0);
    const totalLikes    = reviewRows.reduce(function(s, r) { return s + (r.likes    || 0); }, 0);
    const totalComments = reviewRows.reduce(function(s, r) { return s + (r.comments || 0); }, 0);

    const brandCounts = {};
    reviewRows.forEach(function(r) {
      const brand = (r.brand || '').toLowerCase();
      if (brand) brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    });

    const runId = PropertiesService.getScriptProperties().getProperty('MON_RUN_ID');

    return {
      rows     : rows,
      runStatus: runId ? 'RUNNING' : null,
      stats    : {
        totalReviews     : reviewRows.length,
        totalViews,
        totalLikes,
        totalComments,
        brandCounts,
        totalBrandReviews: reviewRows.length,
        lastRun          : (rows.find(function(r) { return r.updated; }) || {}).updated || '-',
      },
    };
  } catch (e) {
    return _emptyMonitoring(e.toString());
  }
}

// ── Keywords ─────────────────────────────────────────────────

function getMonitoringKeywords(phaseId) {
  try {
    var q = '/rest/v1/monitoring_keywords?select=brand,keywords,phase_id&order=brand';
    if (phaseId) {
      q += '&or=(and(phase_id.is.null,brand.eq.mimuse),phase_id.eq.' + phaseId + ')';
    } else {
      q += '&phase_id=is.null';
    }
    var rows = supabaseGet(q);
    var result = _keywordsFromRows(rows);
    Logger.log('키워드 Supabase 로드 (phase=' + (phaseId || 'global') + '): mimuse=' + result.mimuse.length + ', brands=' + Object.keys(result.byBrand).length);
    return result;
  } catch (e) {
    Logger.log('getMonitoringKeywords Supabase 오류: ' + e);
    return _emptyMonitoringKeywords();
  }
}

function resetMonitoringKeywords(body) {
  return { ok: true, keywords: getMonitoringKeywords((body || {}).phaseId) };
}

function saveMonitoringKeywords(body) {
  body = body || {};
  var phaseId = (body.phaseId || '').toString().trim();
  var brandKeywords = body.brandKeywords || body.keywords || {};
  if (!brandKeywords || typeof brandKeywords !== 'object') {
    return { ok: false, error: 'keywords object required' };
  }

  var mimuseKws = brandKeywords.mimuse;
  if (Array.isArray(mimuseKws)) {
    var mimuseRows = supabaseGet('/rest/v1/monitoring_keywords?select=id&brand=eq.mimuse&phase_id=is.null&limit=1');
    if (Array.isArray(mimuseRows) && mimuseRows.length) {
      supabasePatch('monitoring_keywords', 'id=eq.' + mimuseRows[0].id, { keywords: mimuseKws });
    } else {
      supabaseRequest('/rest/v1/monitoring_keywords', {
        method: 'post',
        payload: { brand: 'mimuse', phase_id: null, keywords: mimuseKws },
      });
    }
  }

  if (!phaseId) {
    return { ok: true, keywords: getMonitoringKeywords() };
  }

  var byBrand = brandKeywords.byBrand || {};
  var payloads = [];
  Object.keys(byBrand).forEach(function(brand) {
    var kws = byBrand[brand];
    if (Array.isArray(kws)) payloads.push({ phase_id: phaseId, brand: brand, keywords: kws });
  });
  if (payloads.length) {
    // Delete stale rows first (handles brand key changes from manual entry vs confirmed_brands)
    supabaseRequest('/rest/v1/monitoring_keywords?phase_id=eq.' + phaseId + '&brand=neq.mimuse', { method: 'delete' });
    var res = supabaseUpsert('monitoring_keywords', payloads, 'phase_id,brand');
    if (!res.ok) return { ok: false, error: 'Supabase upsert failed: HTTP ' + res.status };
  }
  return { ok: true, keywords: getMonitoringKeywords(phaseId) };
}

function _getAllKeywordsFlat(phaseId) {
  var brandKws = getMonitoringKeywords(phaseId);
  var flat = (brandKws.mimuse || []).slice();
  Object.keys(brandKws.byBrand || {}).forEach(function(brand) {
    flat = flat.concat(brandKws.byBrand[brand] || []);
  });
  return flat;
}

// ── Apify Scrape ─────────────────────────────────────────────

const MON_ACTOR        = 'clockworks~tiktok-profile-scraper';
const MON_SCRAPE_LIMIT = 50;
const MON_VIDEOS_PER   = 50;
const MON_LOOKBACK_DAYS = 7;

// 실행 버튼 클릭일 = MON_START (today KST), MON_END = 7일 전 → Apify: newer than END, older than START
function _monitoringScrapeDateRange_() {
  var tz = 'Asia/Seoul';
  var today = new Date();
  var monStart = Utilities.formatDate(today, tz, 'yyyy-MM-dd');
  var older = new Date(today.getTime() - MON_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  var monEnd = Utilities.formatDate(older, tz, 'yyyy-MM-dd');
  return {
    monStartDate       : monStart,
    monEndDate         : monEnd,
    onlyPostsNewerThan : monEnd,
    onlyPostsOlderThan : monStart,
    periodLabel        : monEnd + ' ~ ' + monStart + ' (최근 ' + MON_LOOKBACK_DAYS + '일)',
  };
}

// Read TikTok handles from Supabase influencer_platform table.
function _getTikTokInfluencers(limit) {
  limit = limit || MON_SCRAPE_LIMIT;
  const { url, key } = supabaseConfig();
  if (!url || !key) {
    Logger.log('SUPABASE_PROJECT_URL / SUPABASE_KEY not set');
    return [];
  }

  try {
    const res  = UrlFetchApp.fetch(
      url + '/rest/v1/influencer_platform?select=handle,platform&platform=eq.TikTok&limit=' + limit,
      { headers: supabaseHeaders(), muteHttpExceptions: true }
    );
    const data = JSON.parse(res.getContentText());
    if (!Array.isArray(data)) { Logger.log('Supabase influencer_platform 오류: ' + res.getContentText()); return []; }

    const seen    = {};
    const results = [];
    data.forEach(function(row) {
      const handle = (row.handle || '').toString().trim().replace(/^@/, '');
      const key    = handle.toLowerCase();
      if (!handle || handle.includes(' ') || seen[key]) return;
      seen[key] = true;
      results.push(handle);
    });
    Logger.log('Supabase TikTok 핸들: ' + results.length + '개');
    return results;
  } catch (e) {
    Logger.log('_getTikTokInfluencers 오류: ' + e);
    return [];
  }
}

// Start Apify scrape. Date range = click day (MON_START) back to 7 days before (MON_END).
function runMonitoringScrape(body) {
  body = body || {};
  var phaseId = (body.phaseId || '').toString().trim();
  if (!phaseId) return { error: 'phaseId가 필요합니다. 페이즈를 선택한 뒤 다시 실행하세요.' };

  const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
  if (!token) return { error: 'APIFY_TOKEN이 Script Properties에 설정되지 않았습니다.' };

  const handles = _getTikTokInfluencers(MON_SCRAPE_LIMIT);
  if (handles.length === 0) return { error: 'Supabase influencer_platform에 유효한 TikTok 핸들이 없습니다.' };

  const props = PropertiesService.getScriptProperties();
  const range = _monitoringScrapeDateRange_();

  Logger.log('스크래핑 대상 핸들: ' + handles.join(', '));
  Logger.log('기간: ' + range.periodLabel);

  const payload = {
    profiles             : handles,
    resultsPerPage       : MON_VIDEOS_PER,
    profileSections      : ['Videos'],
    sortVideosBy         : 'Latest',
    shouldDownloadVideos : false,
    shouldDownloadCovers : false,
    excludePinnedPosts   : true,
  };
  payload.onlyPostsNewerThan = range.onlyPostsNewerThan;
  payload.onlyPostsOlderThan = range.onlyPostsOlderThan;

  try {
    const res = UrlFetchApp.fetch(
      'https://api.apify.com/v2/acts/' + MON_ACTOR + '/runs?token=' + token,
      {
        method            : 'POST',
        contentType       : 'application/json',
        payload           : JSON.stringify(payload),
        muteHttpExceptions: true,
      }
    );
    const json = JSON.parse(res.getContentText());
    if (!json.data) return { error: 'Apify 오류: ' + res.getContentText() };

    const runId     = json.data.id;
    const datasetId = json.data.defaultDatasetId;

    props.setProperty('MON_RUN_ID',      runId);
    props.setProperty('MON_DATASET_ID',  datasetId);
    props.setProperty('MON_RUN_DATE',    new Date().toISOString());
    props.setProperty('MON_START_DATE',  range.monStartDate);
    props.setProperty('MON_END_DATE',    range.monEndDate);
    props.setProperty('MON_PHASE_ID',    phaseId);

    Logger.log('모니터링 실행 시작: ' + runId + ' (' + handles.length + '개 프로필, ' + range.periodLabel + ')');
    return {
      ok      : true, runId: runId,
      profiles: handles.length, handles: handles,
      period  : range.periodLabel,
      message : handles.length + '개 TikTok 프로필 스크래핑 시작 (' + range.periodLabel + ')',
    };
  } catch (e) {
    return { error: e.toString() };
  }
}

// Check run status — call this to poll until done, then write results
function checkMonitoringRun() {
  const token     = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
  const runId     = PropertiesService.getScriptProperties().getProperty('MON_RUN_ID');
  const datasetId = PropertiesService.getScriptProperties().getProperty('MON_DATASET_ID');

  if (!runId) return { error: '실행 중인 모니터링이 없습니다. runMonitoringScrape()를 먼저 실행하세요.' };

  try {
    const statusRes = UrlFetchApp.fetch(
      'https://api.apify.com/v2/actor-runs/' + runId + '?token=' + token,
      { muteHttpExceptions: true }
    );
    const runData = JSON.parse(statusRes.getContentText()).data;
    const status  = runData.status;

    Logger.log('Run status: ' + status);

    if (status === 'FAILED' || status === 'ABORTED') {
      PropertiesService.getScriptProperties().deleteProperty('MON_RUN_ID');
      PropertiesService.getScriptProperties().deleteProperty('MON_DATASET_ID');
      return { error: 'Apify 실행 실패: ' + status };
    }

    if (status !== 'SUCCEEDED') {
      return { status: status, message: '아직 실행 중입니다. 잠시 후 다시 확인하세요.' };
    }

    return _writeMonitoringResults(token, datasetId);
  } catch (e) {
    return { error: e.toString() };
  }
}

function _writeMonitoringResults(token, datasetId) {
  var phaseId = PropertiesService.getScriptProperties().getProperty('MON_PHASE_ID') || '';
  const keywords = _getAllKeywordsFlat(phaseId).map(function(k) { return k.toLowerCase(); });
  const runDate  = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');

  try {
    const res = UrlFetchApp.fetch(
      'https://api.apify.com/v2/datasets/' + datasetId + '/items?token=' + token + '&limit=2000',
      { muteHttpExceptions: true }
    );
    const items = JSON.parse(res.getContentText());
    if (!Array.isArray(items)) return { error: 'Apify 결과 파싱 오류' };

    function itemText(item) {
      return [
        item.text, item.desc, item.description,
        (item.hashtags  || []).join(' '),
        (item.textExtra || []).map(function(t) { return t.hashtagName || ''; }).join(' '),
      ].filter(Boolean).join(' ').toLowerCase();
    }

    // Build handle → [keyword-matching videos] map
    const videosByHandle = {};
    items.forEach(function(item) {
      if (!keywords.some(function(kw) { return itemText(item).includes(kw); })) return;
      const uniqueId = _itemUniqueId(item);
      if (!uniqueId) return;
      if (!videosByHandle[uniqueId]) videosByHandle[uniqueId] = [];
      videosByHandle[uniqueId].push(item);
    });

    if (items.length > 0 && Object.keys(videosByHandle).length === 0) {
      Logger.log('경고: 키워드 매칭 0개. 첫 아이템 키: ' + JSON.stringify(Object.keys(items[0])));
    }

    Logger.log('기간 내 영상: ' + items.length + '개 | 키워드 매칭: ' + Object.keys(videosByHandle).length + '개 핸들');

    const { url, key } = supabaseConfig();
    if (!url || !key) {
      _clearRunProps();
      return { error: 'SUPABASE_PROJECT_URL / SUPABASE_KEY가 설정되지 않아 결과를 저장할 수 없습니다.' };
    }

    const updated = _writeToSupabase(url, key, videosByHandle, keywords, itemText, runDate, phaseId);

    Logger.log('업데이트된 행: ' + updated + '개');
    return {
      ok     : true, matched: updated,
      message: updated > 0
        ? updated + '개 인플루언서 리뷰 데이터 업데이트 완료'
        : '키워드 매칭 영상 없음 — 감지된 리뷰가 없습니다.',
    };
  } catch (e) {
    Logger.log('_writeMonitoringResults 오류: ' + e.toString());
    return { error: e.toString() };
  } finally {
    _clearRunProps();
  }
}

function _itemUniqueId(item) {
  var meta = item.authorMeta || {};
  return (
    meta.uniqueId || meta.name ||
    item['authorMeta.name'] ||
    item.uniqueId || ''
  ).toString().toLowerCase();
}

// Write Apify results to Supabase monitoring table.
function _writeToSupabase(sbUrl, sbKey, videosByHandle, keywords, itemText, runDate, phaseId) {
  const mapRes = UrlFetchApp.fetch(
    sbUrl + '/rest/v1/influencer_platform?select=id,handle,platform',
    { headers: supabaseHeaders(), muteHttpExceptions: true }
  );
  const mapData = JSON.parse(mapRes.getContentText());
  if (!Array.isArray(mapData)) {
    Logger.log('influencer_platform 조회 실패');
    return 0;
  }

  const handlePlatformToId = {};
  mapData.forEach(function(row) {
    const k = (row.handle || '').toLowerCase() + '|' + (row.platform || '').toLowerCase();
    if (k !== '|') handlePlatformToId[k] = row.id;
  });

  var inserted = 0;
  Object.keys(videosByHandle).forEach(function(handle) {
    const platformId = handlePlatformToId[handle + '|tiktok'];
    if (!platformId) { Logger.log('influencer_platform 없음: ' + handle); return; }

    videosByHandle[handle].forEach(function(video) {
      var videoDate = '';
      if (video.createTimeISO) videoDate = video.createTimeISO.slice(0, 10);
      else if (video.createTime) videoDate = Utilities.formatDate(new Date(video.createTime * 1000), 'Asia/Seoul', 'yyyy-MM-dd');

      const videoUrl   = video.webVideoUrl || video.videoUrl || '';
      const s          = video.stats || {};
      const matchedKws = keywords.filter(function(kw) { return itemText(video).includes(kw); });

      const payload = JSON.stringify({
        influencer_platform_id: platformId,
        phase_id   : phaseId || null,
        date       : videoDate || null,
        media      : 'video',
        review_link: videoUrl  || null,
        views      : video.playCount    || s.playCount    || 0,
        likes      : video.diggCount    || s.diggCount    || 0,
        comments   : video.commentCount || s.commentCount || 0,
        keywords   : matchedKws.join(', ') || null,
        updated    : runDate,
      });

      const insRes = UrlFetchApp.fetch(
        sbUrl + '/rest/v1/monitoring',
        {
          method : 'POST',
          headers: Object.assign({}, supabaseHeaders(), {
            'Content-Type': 'application/json',
            Prefer        : 'resolution=merge-duplicates,return=representation',
          }),
          payload           : payload,
          muteHttpExceptions: true,
        }
      );
      if (insRes.getResponseCode() < 300) {
        inserted++;
      } else {
        Logger.log('Supabase insert 오류 (' + handle + '): ' + insRes.getContentText());
      }
    });
  });

  return inserted;
}

function _clearRunProps() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('MON_RUN_ID');
  props.deleteProperty('MON_DATASET_ID');
  props.deleteProperty('MON_START_DATE');
  props.deleteProperty('MON_END_DATE');
  props.deleteProperty('MON_PHASE_ID');
}

// ── Helpers ───────────────────────────────────────────────────

function _emptyMonitoring(error) {
  return {
    error,
    rows : [],
    stats: {
      totalReviews : 0,
      totalViews   : 0,
      totalLikes   : 0,
      totalComments: 0,
      brandCounts  : {},
      lastRun      : '-',
    },
  };
}

function resetMonitoringRun() {
  _clearRunProps();
  return { ok: true, message: '모니터링 상태 초기화 완료. 다시 실행하세요.' };
}

// Process a previously-completed Apify run by ID.
function processApifyRunById(runId, phaseId) {
  const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
  if (!token) return { error: 'APIFY_TOKEN이 설정되지 않았습니다.' };
  if (!runId)  return { error: 'runId가 필요합니다.' };
  phaseId = (phaseId || '').toString().trim();
  if (!phaseId) return { error: 'phaseId가 필요합니다.' };

  try {
    const statusRes = UrlFetchApp.fetch(
      'https://api.apify.com/v2/actor-runs/' + runId + '?token=' + token,
      { muteHttpExceptions: true }
    );
    const runData = JSON.parse(statusRes.getContentText()).data;
    if (!runData) return { error: 'Run 정보를 가져올 수 없습니다: ' + runId };
    if (runData.status !== 'SUCCEEDED') {
      return { error: 'Run 상태가 SUCCEEDED가 아닙니다 (현재 상태: ' + runData.status + ')' };
    }
    PropertiesService.getScriptProperties().setProperty('MON_PHASE_ID', phaseId);
    return _writeMonitoringResults(token, runData.defaultDatasetId);
  } catch (e) {
    return { error: e.toString() };
  }
}

// ── Free test — no Apify call needed ─────────────────────────
function testKeywordMatching() {
  const nestedItem = {
    authorMeta   : { name: 'anikafong', uniqueId: 'anikafong' },
    text         : 'Unbox the Mi Muse Box with me! @mimuse @nesh @varuza_global #kbeauty',
    diggCount    : 55, playCount: 581, commentCount: 3,
    createTimeISO: '2026-03-30T03:00:29.000Z',
    webVideoUrl  : 'https://www.tiktok.com/@anikafong/video/7622878040212770061',
  };
  const flatItem = {
    'authorMeta.name': 'charity_017',
    text         : 'Packaging is so cute I love it @mimuse #prgifted #gifted',
    diggCount    : 12, playCount: 203, commentCount: 1,
    createTimeISO: '2026-04-06T03:00:31.000Z',
    webVideoUrl  : 'https://www.tiktok.com/@charity_017/video/7625475714870971678',
  };
  const noMatchItem = {
    authorMeta   : { name: 'someuser', uniqueId: 'someuser' },
    text         : 'Check out this lipstick from Fenty Beauty! #makeup',
    diggCount    : 100, playCount: 1000, commentCount: 10,
    createTimeISO: '2026-03-15T10:00:00.000Z',
    webVideoUrl  : 'https://www.tiktok.com/@someuser/video/123',
  };

  const keywords = _getAllKeywordsFlat().map(function(k) { return k.toLowerCase(); });
  Logger.log('키워드 목록 (' + keywords.length + '개): ' + keywords.join(', '));

  function itemText(item) {
    return [
      item.text, item.desc, item.description,
      (item.hashtags  || []).join(' '),
      (item.textExtra || []).map(function(t) { return t.hashtagName || ''; }).join(' '),
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function getUniqueId(item) {
    const meta = item.authorMeta || {};
    return (meta.uniqueId || meta.name || item['authorMeta.name'] || item.uniqueId || '').toString().toLowerCase();
  }

  [
    { item: nestedItem,  label: 'NESTED format (should match)' },
    { item: flatItem,    label: 'FLAT format   (should match)' },
    { item: noMatchItem, label: 'No keyword    (should NOT match)' },
  ].forEach(function(tc) {
    const text     = itemText(tc.item);
    const matched  = keywords.filter(function(kw) { return text.includes(kw); });
    const uniqueId = getUniqueId(tc.item);
    Logger.log('── ' + tc.label);
    Logger.log('  uniqueId : ' + (uniqueId || '비어있음'));
    Logger.log('  키워드   : ' + (matched.length ? matched.join(', ') : '없음'));
    Logger.log('  결과     : ' + (matched.length && uniqueId ? '매칭됨' : '건너뜀'));
  });
}

// ── Debug ─────────────────────────────────────────────────────
function debugMonitoringSetup() {
  const { url, key } = supabaseConfig();
  Logger.log('SUPABASE_PROJECT_URL: ' + (url ? '설정됨' : '없음'));
  Logger.log('SUPABASE_KEY:         ' + (key ? '설정됨' : '없음'));
  Logger.log('APIFY_TOKEN:          ' + (PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN') ? '설정됨' : '없음'));
  Logger.log('MON_START_DATE:       ' + (PropertiesService.getScriptProperties().getProperty('MON_START_DATE') || '미설정'));
  Logger.log('MON_END_DATE:         ' + (PropertiesService.getScriptProperties().getProperty('MON_END_DATE')   || '미설정'));
  Logger.log('MON_RUN_ID:           ' + (PropertiesService.getScriptProperties().getProperty('MON_RUN_ID')     || '없음'));

  if (url && key) {
    const handles = _getTikTokInfluencers(99);
    Logger.log('TikTok 핸들 ' + handles.length + '개: ' + handles.join(', '));
    const keywords = getMonitoringKeywords();
    Logger.log('키워드: ' + JSON.stringify(keywords));
  }
}

// ── Metadata update via truefetch/tiktok-video-downloader ────

var META_ACTOR = 'scrape-creators~best-tiktok-video-scraper';

function updateVideoMetadata(body) {
  var token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
  if (!token) return { error: 'APIFY_TOKEN이 설정되지 않았습니다.' };

  var inputRows = Array.isArray(body.rows) ? body.rows : [];
  var tiktokRows = inputRows.filter(function(r) {
    return r.review_link && r.review_link.indexOf('tiktok.com') !== -1;
  });
  if (!tiktokRows.length) return { error: 'TikTok URL이 없습니다.' };

  // Build videoId → row map for matching results back (URL format: /video/{id})
  var rowByVideoId = {};
  tiktokRows.forEach(function(row) {
    var m = (row.review_link || '').match(/\/video\/(\d+)/);
    if (m) rowByVideoId[m[1]] = row;
  });

  var startRes = UrlFetchApp.fetch(
    'https://api.apify.com/v2/acts/' + META_ACTOR + '/runs?token=' + token,
    {
      method     : 'post',
      contentType: 'application/json',
      payload    : JSON.stringify({
        videos               : tiktokRows.map(function(r) { return r.review_link; }),
        shouldGetTranscript  : false,
        shouldDownloadVideos : false,
        shouldDownloadCovers : false,
      }),
      muteHttpExceptions: true,
    }
  );
  var startData = (JSON.parse(startRes.getContentText()) || {}).data;
  if (!startData) return { error: 'Apify 실행 시작 실패: ' + startRes.getContentText().slice(0, 200) };

  var runId     = startData.id;
  var datasetId = startData.defaultDatasetId;
  var status    = startData.status;
  var tries     = 0;

  while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED' && tries < 18) {
    Utilities.sleep(10000);
    var pollData = (JSON.parse(UrlFetchApp.fetch(
      'https://api.apify.com/v2/actor-runs/' + runId + '?token=' + token,
      { muteHttpExceptions: true }
    ).getContentText()) || {}).data || {};
    status    = pollData.status           || status;
    datasetId = pollData.defaultDatasetId || datasetId;
    tries++;
  }

  if (status !== 'SUCCEEDED') return { error: 'Apify 실행 실패 (상태: ' + status + ')' };

  var items = JSON.parse(UrlFetchApp.fetch(
    'https://api.apify.com/v2/datasets/' + datasetId + '/items?token=' + token + '&limit=500',
    { muteHttpExceptions: true }
  ).getContentText());
  if (!Array.isArray(items)) return { error: '결과 데이터 형식 오류' };

  var cfg     = supabaseConfig();
  var sbUrl   = cfg.url;
  var now     = new Date().toISOString();
  var updated = 0;

  items.forEach(function(item) {
    var row = rowByVideoId[String(item.id)];
    if (!row) return;
    var patchRes = UrlFetchApp.fetch(
      sbUrl + '/rest/v1/monitoring?id=eq.' + row.id,
      {
        method : 'patch',
        headers: Object.assign({}, supabaseHeaders(), { 'Content-Type': 'application/json' }),
        payload: JSON.stringify({
          views   : item.playCount    || 0,
          likes   : item.likeCount    || 0,
          comments: item.commentCount || 0,
          updated : now,
        }),
        muteHttpExceptions: true,
      }
    );
    if (patchRes.getResponseCode() < 300) updated++;
  });

  return {
    ok     : true,
    updated: updated,
    message: updated + '개 영상 메타데이터 업데이트 완료 (TikTok ' + tiktokRows.length + '개 대상)',
  };
}

// ── Download cover + video URLs via scrape-creators actor ─────

// Apify key-value-store record URLs are private (403 without auth); append the
// token so the stored cover/video URLs are directly viewable from the dashboard.
function _withApifyToken_(url, token) {
  if (!url || url.indexOf('api.apify.com') === -1) return url || null;
  return url + (url.indexOf('?') === -1 ? '?' : '&') + 'token=' + token;
}

function downloadVideoAssets(body) {
  var token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
  if (!token) return { error: 'APIFY_TOKEN이 설정되지 않았습니다.' };

  var inputRows = Array.isArray(body.rows) ? body.rows : [];
  var tiktokRows = inputRows.filter(function(r) {
    return r.review_link && r.review_link.indexOf('tiktok.com') !== -1;
  });
  if (!tiktokRows.length) return { error: 'TikTok URL이 없습니다.' };

  // Map TikTok video/photo id → all rows that reference it (duplicates allowed).
  var rowsByVideoId = {};
  var unkeyedRows = [];
  tiktokRows.forEach(function(row) {
    var m = (row.review_link || '').match(/\/(?:video|photo)\/(\d+)/);
    if (!m) { unkeyedRows.push(row.review_link); return; }
    var id = m[1];
    if (!rowsByVideoId[id]) rowsByVideoId[id] = [];
    rowsByVideoId[id].push(row);
  });

  var startRes = UrlFetchApp.fetch(
    'https://api.apify.com/v2/acts/' + META_ACTOR + '/runs?token=' + token,
    {
      method     : 'post',
      contentType: 'application/json',
      payload    : JSON.stringify({
        videos               : tiktokRows.map(function(r) { return r.review_link; }),
        shouldGetTranscript  : false,
        shouldDownloadVideos : true,
        shouldDownloadCovers : true,
      }),
      muteHttpExceptions: true,
    }
  );
  var startData = (JSON.parse(startRes.getContentText()) || {}).data;
  if (!startData) return { error: 'Apify 실행 시작 실패: ' + startRes.getContentText().slice(0, 200) };

  var runId     = startData.id;
  var datasetId = startData.defaultDatasetId;
  var status    = startData.status;
  var tries     = 0;

  while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED' && tries < 30) {
    Utilities.sleep(10000);
    var pollData = (JSON.parse(UrlFetchApp.fetch(
      'https://api.apify.com/v2/actor-runs/' + runId + '?token=' + token,
      { muteHttpExceptions: true }
    ).getContentText()) || {}).data || {};
    status    = pollData.status           || status;
    datasetId = pollData.defaultDatasetId || datasetId;
    tries++;
  }

  if (status !== 'SUCCEEDED') return { error: 'Apify 실행 실패 (상태: ' + status + ')' };

  var items = JSON.parse(UrlFetchApp.fetch(
    'https://api.apify.com/v2/datasets/' + datasetId + '/items?token=' + token + '&limit=500',
    { muteHttpExceptions: true }
  ).getContentText());
  if (!Array.isArray(items)) return { error: '결과 데이터 형식 오류' };

  var cfg     = supabaseConfig();
  var sbUrl   = cfg.url;
  var now     = new Date().toISOString();
  var updated   = 0;   // monitoring_assets rows successfully saved
  var noUrl     = 0;   // Apify items with neither cover nor video URL
  var unmatched = 0;   // Apify items whose id matched no monitoring row

  items.forEach(function(item) {
    var rows = rowsByVideoId[String(item.id)];
    if (!rows || !rows.length) { unmatched++; return; }
    // Prefer direct (token-free) CDN URLs; the Apify download* URLs are private (403 / insufficient-permissions).
    // Photo posts (/photo/ URL, with an `images` array) still carry a slideshow videoUrl — ignore it and
    // use the images as the media. Video posts use videoUrl.
    var images  = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
    var isPhoto = (item.url || '').indexOf('/photo/') !== -1 || (images.length > 0 && !item.videoUrl);

    var coverUrl, videoUrl, imageUrls;
    if (isPhoto) {
      coverUrl  = (images.length ? images[0] : null) || item.coverImg || null;
      videoUrl  = null;
      imageUrls = images.length ? images : null;   // all photos for download
    } else {
      coverUrl  = item.coverImg || (images.length ? images[0] : null) || null;
      videoUrl  = _withApifyToken_(item.videoUrl || item.downloadUrl || null, token);
      imageUrls = null;
    }
    if (!coverUrl && !videoUrl && !imageUrls) { noUrl++; return; }

    rows.forEach(function(row) {
      var res = UrlFetchApp.fetch(
        sbUrl + '/rest/v1/monitoring_assets?on_conflict=monitoring_id',
        {
          method : 'POST',
          headers: Object.assign({}, supabaseHeaders(), {
            'Content-Type': 'application/json',
            Prefer        : 'resolution=merge-duplicates',
          }),
          payload           : JSON.stringify({
            monitoring_id: row.id,
            cover_url    : coverUrl,
            video_url    : videoUrl,
            image_urls   : imageUrls,
            updated_at   : now,
          }),
          muteHttpExceptions: true,
        }
      );
      if (res.getResponseCode() < 300) updated++;
      else Logger.log('monitoring_assets upsert 오류: ' + res.getContentText());
    });
  });

  return {
    ok           : true,
    updated      : updated,
    itemsReturned: items.length,
    tiktokRows   : tiktokRows.length,
    unmatched    : unmatched,
    noDownloadUrl: noUrl,
    unkeyedUrls  : unkeyedRows,
    message: updated + '개 저장 · Apify 결과 ' + items.length + '개 · 매칭 실패 ' + unmatched
      + '개 · 다운로드 URL 없음 ' + noUrl + '개 · URL 패턴 불일치 ' + unkeyedRows.length
      + '개 (대상 ' + tiktokRows.length + '개)',
  };
}

// ── Router ────────────────────────────────────────────────────

function routeMonitoring(action, p, body) {
  switch (action) {
    case 'getMonitoringData'       : return getMonitoringData();
    case 'getMonitoringKeywords'   : return getMonitoringKeywords((body || {}).phaseId);
    case 'saveMonitoringKeywords'  : return saveMonitoringKeywords(body || {});
    case 'resetMonitoringKeywords' : return resetMonitoringKeywords(body || {});
    case 'runMonitoringScrape'     : return runMonitoringScrape(body || {});
    case 'checkMonitoringRun'      : return checkMonitoringRun();
    case 'resetMonitoringRun'      : return resetMonitoringRun();
    case 'processApifyRunById'     : return processApifyRunById((body || {}).runId || '', (body || {}).phaseId);
    case 'updateVideoMetadata'     : return updateVideoMetadata(body || {});
    case 'downloadVideoAssets'     : return downloadVideoAssets(body || {});
    default                        : return null;
  }
}
