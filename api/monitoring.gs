// ============================================================
//  Tab: 인플루언서 모니터링
//  All data lives in Supabase — no Google Sheets dependency.
// ============================================================

const DEFAULT_BRAND_KEYWORDS = {
  mimuse: ['mimuse', 'mi muse', 'mi-muse', '미뮤즈', 'MiMuse Beauty'],
  brands: ['aesthein', 'joodoc', 'nesh', 'varuza'],
};

// ── Supabase helpers ──────────────────────────────────────────

function _getSupabaseCredentials() {
  const props = PropertiesService.getScriptProperties();
  return {
    url: props.getProperty('SUPABASE_PROJECT_URL'),
    key: props.getProperty('SUPABASE_KEY'),
  };
}

function _sbHeaders(key) {
  return { apikey: key, Authorization: 'Bearer ' + key };
}

// ── Read monitoring data from Supabase ────────────────────────

function getMonitoringData() {
  const { url, key } = _getSupabaseCredentials();
  if (!url || !key) return _emptyMonitoring('SUPABASE_PROJECT_URL / SUPABASE_KEY가 Script Properties에 설정되지 않았습니다.');

  try {
    const res = UrlFetchApp.fetch(
      url + '/rest/v1/monitoring?select=date,brand,review_link,views,likes,comments,keywords,updated&order=date.desc',
      { headers: _sbHeaders(key), muteHttpExceptions: true }
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

function getMonitoringKeywords() {
  // Read from Supabase — source of truth updated by the React dashboard
  const { url, key } = _getSupabaseCredentials();
  if (url && key) {
    try {
      const res  = UrlFetchApp.fetch(
        url + '/rest/v1/monitoring_keywords?select=brand,keywords&brand=in.(mimuse,brands)',
        { headers: _sbHeaders(key), muteHttpExceptions: true }
      );
      const data = JSON.parse(res.getContentText());
      if (Array.isArray(data) && data.length > 0) {
        const result = Object.assign({}, DEFAULT_BRAND_KEYWORDS);
        data.forEach(function(row) {
          if (row.brand && Array.isArray(row.keywords) && row.keywords.length > 0) {
            result[row.brand] = row.keywords;
          }
        });
        Logger.log('키워드 Supabase 로드: mimuse=' + (result.mimuse || []).length + '개, brands=' + (result.brands || []).length + '개');
        return result;
      }
    } catch (e) {
      Logger.log('getMonitoringKeywords Supabase 오류: ' + e);
    }
  }

  // Script Properties fallback
  const props  = PropertiesService.getScriptProperties();
  const stored = props.getProperty('MONITORING_BRAND_KEYWORDS');
  if (stored) return JSON.parse(stored);
  const oldStored = props.getProperty('MONITORING_KEYWORDS');
  if (oldStored) return Object.assign({}, DEFAULT_BRAND_KEYWORDS, { mimuse: JSON.parse(oldStored) });
  return DEFAULT_BRAND_KEYWORDS;
}

function resetMonitoringKeywords() {
  PropertiesService.getScriptProperties().deleteProperty('MONITORING_BRAND_KEYWORDS');
  PropertiesService.getScriptProperties().deleteProperty('MONITORING_KEYWORDS');
  return { ok: true, keywords: DEFAULT_BRAND_KEYWORDS };
}

function saveMonitoringKeywords(brandKeywords) {
  const toSave = Array.isArray(brandKeywords)
    ? Object.assign({}, DEFAULT_BRAND_KEYWORDS, { mimuse: brandKeywords })
    : brandKeywords;
  PropertiesService.getScriptProperties()
    .setProperty('MONITORING_BRAND_KEYWORDS', JSON.stringify(toSave));
  return { ok: true };
}

function _getAllKeywordsFlat() {
  const brandKws = getMonitoringKeywords();
  if (Array.isArray(brandKws)) return brandKws;
  return Object.values(brandKws).reduce(function(a, b) { return a.concat(b); }, []);
}

// ── Apify Scrape ─────────────────────────────────────────────

const MON_ACTOR        = 'clockworks~tiktok-profile-scraper';
const MON_SCRAPE_LIMIT = 50;
const MON_VIDEOS_PER   = 50;

// Read TikTok handles from Supabase influencer_platform table.
function _getTikTokInfluencers(limit) {
  limit = limit || MON_SCRAPE_LIMIT;
  const { url, key } = _getSupabaseCredentials();
  if (!url || !key) {
    Logger.log('SUPABASE_PROJECT_URL / SUPABASE_KEY not set');
    return [];
  }

  try {
    const res  = UrlFetchApp.fetch(
      url + '/rest/v1/influencer_platform?select=handle,platform&platform=eq.TikTok&limit=' + limit,
      { headers: _sbHeaders(key), muteHttpExceptions: true }
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

// Start Apify scrape.
// Date range is read from Script Properties: MON_START_DATE / MON_END_DATE (YYYY-MM-DD).
function runMonitoringScrape() {
  const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
  if (!token) return { error: 'APIFY_TOKEN이 Script Properties에 설정되지 않았습니다.' };

  const handles = _getTikTokInfluencers(MON_SCRAPE_LIMIT);
  if (handles.length === 0) return { error: 'Supabase influencer_platform에 유효한 TikTok 핸들이 없습니다.' };

  const props     = PropertiesService.getScriptProperties();
  const startDate = props.getProperty('MON_START_DATE') || '2026-02-20';
  const endDate   = props.getProperty('MON_END_DATE')   || '2026-04-23';

  Logger.log('스크래핑 대상 핸들: ' + handles.join(', '));
  Logger.log('기간: ' + (startDate || '제한없음') + ' ~ ' + (endDate || '제한없음'));

  const payload = {
    profiles             : handles,
    resultsPerPage       : MON_VIDEOS_PER,
    profileSections      : ['Videos'],
    sortVideosBy         : 'Latest',
    shouldDownloadVideos : false,
    shouldDownloadCovers : false,
    excludePinnedPosts   : false,
  };
  if (startDate) payload.onlyPostsNewerThan = startDate;
  if (endDate)   payload.onlyPostsOlderThan = endDate;

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

    props.setProperty('MON_RUN_ID',     runId);
    props.setProperty('MON_DATASET_ID', datasetId);
    props.setProperty('MON_RUN_DATE',   new Date().toISOString());

    const period = (startDate || '제한없음') + ' ~ ' + (endDate || '제한없음');
    Logger.log('모니터링 실행 시작: ' + runId + ' (' + handles.length + '개 프로필, ' + period + ')');
    return {
      ok     : true, runId: runId,
      profiles: handles.length, handles: handles,
      message: handles.length + '개 TikTok 프로필 스크래핑 시작 (' + period + ')',
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
  const keywords = _getAllKeywordsFlat().map(function(k) { return k.toLowerCase(); });
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
      const meta     = item.authorMeta || {};
      const uniqueId = (
        meta.uniqueId || meta.name ||
        item['authorMeta.name'] ||
        item.uniqueId || ''
      ).toString().toLowerCase();
      if (!uniqueId) return;
      if (!videosByHandle[uniqueId]) videosByHandle[uniqueId] = [];
      videosByHandle[uniqueId].push(item);
    });

    if (items.length > 0 && Object.keys(videosByHandle).length === 0) {
      Logger.log('경고: 키워드 매칭 0개. 첫 아이템 키: ' + JSON.stringify(Object.keys(items[0])));
    }

    Logger.log('기간 내 영상: ' + items.length + '개 | 키워드 매칭: ' + Object.keys(videosByHandle).length + '개 핸들');

    const { url, key } = _getSupabaseCredentials();
    if (!url || !key) {
      _clearRunProps();
      return { error: 'SUPABASE_PROJECT_URL / SUPABASE_KEY가 설정되지 않아 결과를 저장할 수 없습니다.' };
    }

    const updated = _writeToSupabase(url, key, videosByHandle, keywords, itemText, runDate);

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

// Write Apify results to Supabase monitoring table.
function _writeToSupabase(sbUrl, sbKey, videosByHandle, keywords, itemText, runDate) {
  const mapRes = UrlFetchApp.fetch(
    sbUrl + '/rest/v1/influencer_platform?select=id,handle,platform',
    { headers: _sbHeaders(sbKey), muteHttpExceptions: true }
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
          headers: Object.assign({}, _sbHeaders(sbKey), {
            'Content-Type': 'application/json',
            Prefer        : 'resolution=merge-duplicates',
          }),
          payload           : payload,
          muteHttpExceptions: true,
        }
      );
      if (insRes.getResponseCode() < 300) inserted++;
      else Logger.log('Supabase insert 오류 (' + handle + '): ' + insRes.getContentText());
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
function processApifyRunById(runId) {
  const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
  if (!token) return { error: 'APIFY_TOKEN이 설정되지 않았습니다.' };
  if (!runId)  return { error: 'runId가 필요합니다.' };

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
  const { url, key } = _getSupabaseCredentials();
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

// ── Router ────────────────────────────────────────────────────

function routeMonitoring(action, p, body) {
  switch (action) {
    case 'getMonitoringData'       : return getMonitoringData();
    case 'getMonitoringKeywords'   : return getMonitoringKeywords();
    case 'saveMonitoringKeywords'  : return saveMonitoringKeywords((body || {}).brandKeywords || (body || {}).keywords || {});
    case 'resetMonitoringKeywords' : return resetMonitoringKeywords();
    case 'runMonitoringScrape'     : return runMonitoringScrape();
    case 'checkMonitoringRun'      : return checkMonitoringRun();
    case 'resetMonitoringRun'      : return resetMonitoringRun();
    case 'processApifyRunById'     : return processApifyRunById((body || {}).runId || '');
    default                        : return null;
  }
}
