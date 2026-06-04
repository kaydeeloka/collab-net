// ============================================================
//  Tab: 인플루언서 모니터링
// ============================================================

// Column indices (0-based) — matches 모니터링 sheet:
// no.|platform|account|date|media|content|brand|repost|review link|조회수|좋아요 수|댓글 수|모니터링 실행일
const MON_C = {
  NO       : 0,   // A — row number
  PLATFORM : 1,   // B — TikTok / Instagram
  HANDLE   : 2,   // C — account handle (filled manually)
  DATE     : 3,   // D — video upload date       ← scraper fills
  MEDIA    : 4,   // E — photo / video            (filled manually)
  CONTENT  : 5,   // F — unboxing / review video  (filled manually)
  BRAND    : 6,   // G — mimuse / aesthen / …     (filled manually)
  REPOST   : 7,   // H — repost Y/N               (filled manually)
  LINK     : 8,   // I — review link              ← scraper fills
  VIEWS    : 9,   // J — 조회수                    ← scraper fills
  LIKES    : 10,  // K — 좋아요 수                 ← scraper fills
  COMMENTS : 11,  // L — 댓글 수                   ← scraper fills
  UPDATED  : 12,  // M — 모니터링 실행일             ← scraper fills
};

const DEFAULT_BRAND_KEYWORDS = {
  mimuse: ['mimuse', 'mi muse', 'mi-muse', '미뮤즈', 'MiMuse Beauty'],
  brands: ['aesthen', 'joodoc', 'nesh', 'varuza'],
};

// ── Read ─────────────────────────────────────────────────────

function getMonitoringData() {
  try {
    const monId = PropertiesService.getScriptProperties().getProperty('MONITORING_SHEET_ID');
    let ws;
    if (monId) {
      const mss = SpreadsheetApp.openById(monId);
      ws = mss.getSheetByName(SHEET_MONITORING) || mss.getSheetByName('모니터링') || mss.getSheets()[0];
    } else {
      const ss = SpreadsheetApp.openById(getActiveOutreachId());
      ws = ss.getSheetByName(SHEET_MONITORING) || ss.getSheetByName('모니터링');
    }
    if (!ws) return _emptyMonitoring('모니터링 시트를 찾을 수 없습니다. 스프레드시트에 「모니터링」 탭이 있는지 확인하세요.');

    const all = ws.getDataRange().getValues();
    if (all.length < 2) return _emptyMonitoring('데이터가 없습니다.');

    const headers = all[0].map(h => h.toString());
    const rows    = all.slice(1).map(r => r.map(c => {
      if (c instanceof Date) return Utilities.formatDate(c, 'Asia/Seoul', 'yyyy-MM-dd');
      return c.toString();
    }));

    const C = MON_C;

    // Use UPDATED (run date) — skip if it looks like a URL
    const lastRunRow = rows.find(r => r[C.UPDATED] && !r[C.UPDATED].startsWith('http'));
    const lastRun    = lastRunRow ? lastRunRow[C.UPDATED] : '아직 실행 안 됨';

    const reviewRows  = rows.filter(r => r[C.LINK] && r[C.LINK].startsWith('http'));
    const influencers = [...new Set(rows.map(r => r[C.HANDLE]).filter(n => n))];
    const totalViews    = reviewRows.reduce((s, r) => s + (parseInt(r[C.VIEWS])    || 0), 0);
    const totalLikes    = reviewRows.reduce((s, r) => s + (parseInt(r[C.LIKES])    || 0), 0);
    const totalComments = reviewRows.reduce((s, r) => s + (parseInt(r[C.COMMENTS]) || 0), 0);

    const brandCounts = {};
    reviewRows.forEach(r => {
      const brand = (r[C.BRAND] || '').toString().trim().toLowerCase();
      if (!brand) return;
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    });

    // Also return current run status for the frontend
    const runId = PropertiesService.getScriptProperties().getProperty('MON_RUN_ID');
    const runStatus = runId ? 'RUNNING' : null;

    return {
      headers,
      rows,
      runStatus,
      stats: {
        totalInfluencers : influencers.length,
        totalReviews     : reviewRows.length,
        totalViews,
        totalLikes,
        totalComments,
        brandCounts,
        lastRun,
      }
    };
  } catch (e) {
    return _emptyMonitoring(e.toString());
  }
}

// ── Keywords ─────────────────────────────────────────────────

function getMonitoringKeywords() {
  const props = PropertiesService.getScriptProperties();
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

// clockworks~tiktok-profile-scraper — paid actor, reliable profile + date range scraping
const MON_ACTOR        = 'clockworks~tiktok-profile-scraper';
const MON_SCRAPE_LIMIT = 50;   // max influencers per run
const MON_VIDEOS_PER   = 50;   // max videos per profile

function _getMonitoringSheet() {
  const monId = PropertiesService.getScriptProperties().getProperty('MONITORING_SHEET_ID');
  const ss = monId
    ? SpreadsheetApp.openById(monId)
    : SpreadsheetApp.openById(getActiveOutreachId());
  // Do NOT fall back to getSheets()[0] — that silently uses the wrong sheet
  return ss.getSheetByName(SHEET_MONITORING) || ss.getSheetByName('모니터링') || null;
}

// Read handles from the monitoring sheet (col C = MON_C.HANDLE).
// Deduplicates so each profile is only scraped once.
function _getTikTokInfluencers(limit) {
  limit = limit || MON_SCRAPE_LIMIT;
  try {
    const ws = _getMonitoringSheet();
    if (!ws) return [];

    const rows    = ws.getDataRange().getValues().slice(1);
    const results = [];
    const seen    = {};

    for (var i = 0; i < rows.length && results.length < limit; i++) {
      const handle = (rows[i][MON_C.HANDLE] || '').toString().trim().replace(/^@/, '');
      const key    = handle.toLowerCase();
      if (!handle || handle.includes(' ') || seen[key]) continue;
      seen[key] = true;
      results.push(handle);
    }
    return results;
  } catch (e) {
    Logger.log('_getTikTokInfluencers error: ' + e);
    return [];
  }
}

// Start Apify scrape.
// Date range is read from Script Properties: MON_START_DATE / MON_END_DATE (YYYY-MM-DD).
// Dates are passed directly to the actor — no post-filtering needed.
function runMonitoringScrape() {
  const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
  if (!token) return { error: 'APIFY_TOKEN이 Script Properties에 설정되지 않았습니다.' };

  const handles = _getTikTokInfluencers(MON_SCRAPE_LIMIT);
  if (handles.length === 0) return { error: '모니터링 시트에 유효한 핸들이 없습니다. C열(account)에 @없이 핸들이 입력되어 있는지 확인하세요.' };

  const props     = PropertiesService.getScriptProperties();
  const startDate = props.getProperty('MON_START_DATE') || '2026-02-20';
  const endDate   = props.getProperty('MON_END_DATE')   || '2026-04-23';

  Logger.log('스크래핑 대상 핸들: ' + handles.join(', '));
  Logger.log('기간: ' + (startDate || '제한없음') + ' ~ ' + (endDate || '제한없음'));

  // Field names match clockworks~tiktok-profile-scraper input schema
  const payload = {
    profiles             : handles,          // usernames without @
    resultsPerPage       : MON_VIDEOS_PER,   // videos per profile
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
        method          : 'POST',
        contentType     : 'application/json',
        payload         : JSON.stringify(payload),
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
      ok: true, runId: runId,
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
        (item.hashtags || []).join(' '),
        (item.textExtra || []).map(function(t) { return t.hashtagName || ''; }).join(' '),
      ].filter(Boolean).join(' ').toLowerCase();
    }

    // Build handle -> first keyword-matching video map.
    // Apify can return either nested objects OR flat dot-notation keys depending on how
    // the dataset is fetched — handle both formats.
    const videoByHandle = {};
    items.forEach(function(item) {
      if (!keywords.some(function(kw) { return itemText(item).includes(kw); })) return;
      const meta     = item.authorMeta || {};
      const uniqueId = (
        meta.uniqueId || meta.name ||   // nested format  { authorMeta: { name: '...' } }
        item['authorMeta.name'] ||       // flat export format
        item.uniqueId || ''
      ).toString().toLowerCase();
      if (!uniqueId || videoByHandle[uniqueId]) return;
      videoByHandle[uniqueId] = item;
    });

    if (items.length > 0 && Object.keys(videoByHandle).length === 0) {
      Logger.log('경고: 키워드 매칭 0개. 첫 번째 아이템 구조: ' + JSON.stringify(Object.keys(items[0])));
    }

    Logger.log('기간 내 영상: ' + items.length + '개 | 키워드 매칭: ' + Object.keys(videoByHandle).length + '개 핸들');

    const ws = _getMonitoringSheet();
    if (!ws) return { error: '모니터링 시트를 찾을 수 없습니다.' };

    const C = MON_C;
    const dataRange = ws.getDataRange();
    const allValues = dataRange.getValues();
    var updated = 0;

    for (var i = 1; i < allValues.length; i++) {
      const handle = (allValues[i][C.HANDLE] || '').toString().trim().replace(/^@/, '').toLowerCase();
      const video  = videoByHandle[handle];
      if (!video) continue;

      var videoDate = '';
      if (video.createTimeISO) {
        videoDate = video.createTimeISO.slice(0, 10);
      } else if (video.createTime) {
        videoDate = Utilities.formatDate(new Date(video.createTime * 1000), 'Asia/Seoul', 'yyyy-MM-dd');
      }

      const videoUrl = video.webVideoUrl || video.videoUrl || '';
      const s        = video.stats || {};
      const views    = video.playCount    || s.playCount    || 0;
      const likes    = video.diggCount    || s.diggCount    || 0;
      const comments = video.commentCount || s.commentCount || 0;

      allValues[i][C.MEDIA]    = 'video';  // TikTok content is always video
      allValues[i][C.DATE]     = videoDate;
      allValues[i][C.LINK]     = videoUrl;
      allValues[i][C.VIEWS]    = views;
      allValues[i][C.LIKES]    = likes;
      allValues[i][C.COMMENTS] = comments;
      allValues[i][C.UPDATED]  = runDate;
      updated++;
    }

    if (updated > 0) {
      dataRange.setValues(allValues);
    }

    Logger.log('업데이트된 행: ' + updated + '개');
    return {
      ok: true, matched: updated,
      message: updated > 0
        ? updated + '개 인플루언서 리뷰 데이터 업데이트 완료'
        : '키워드 매칭 영상 없음 — 감지된 리뷰가 없습니다.',
    };
  } catch (e) {
    Logger.log('Error in _writeMonitoringResults: ' + e.toString());
    return { error: e.toString() };
  } finally {
    // This blocks runs NO MATTER WHAT, preventing locked states if an error drops mid-execution
    _clearRunProps();
  }
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
    headers : [],
    rows    : [],
    stats   : {
      totalInfluencers : 0,
      totalReviews     : 0,
      totalViews       : 0,
      totalLikes       : 0,
      totalComments    : 0,
      keywordCounts    : {},
      lastRun          : '-'
    }
  };
}

// Reset a stuck run — clears all MON_* Script Properties
function resetMonitoringRun() {
  _clearRunProps();
  return { ok: true, message: '모니터링 상태 초기화 완료. 다시 실행하세요.' };
}

// ── Free test — no Apify call needed ─────────────────────────
// Run this from the GAS Script Editor to verify keyword matching works
// before spending money on a real scrape.
function testKeywordMatching() {
  // Simulate NESTED format (what the live Apify API actually returns)
  const nestedItem = {
    authorMeta   : { name: 'anikafong', uniqueId: 'anikafong' },
    text         : 'Unbox the Mi Muse Box with me! @mimuse @nesh @varuza_global @에스테인 #kbeauty',
    diggCount    : 55,
    playCount    : 581,
    commentCount : 3,
    createTimeISO: '2026-03-30T03:00:29.000Z',
    webVideoUrl  : 'https://www.tiktok.com/@anikafong/video/7622878040212770061',
  };

  // Simulate FLAT format (what monitoring.json / CSV export looks like)
  const flatItem = {
    'authorMeta.name': 'charity_017',
    text         : 'Packaging is so cute I love it 🥰 @mimuse #prgifted #gifted',
    diggCount    : 12,
    playCount    : 203,
    commentCount : 1,
    createTimeISO: '2026-04-06T03:00:31.000Z',
    webVideoUrl  : 'https://www.tiktok.com/@charity_017/video/7625475714870971678',
  };

  // Simulate item with NO keyword (should not match)
  const noMatchItem = {
    authorMeta   : { name: 'someuser', uniqueId: 'someuser' },
    text         : 'Check out this lipstick from Fenty Beauty! #makeup',
    diggCount    : 100, playCount: 1000, commentCount: 10,
    createTimeISO: '2026-03-15T10:00:00.000Z',
    webVideoUrl  : 'https://www.tiktok.com/@someuser/video/123',
  };

  const keywords = _getAllKeywordsFlat().map(function(k) { return k.toLowerCase(); });
  Logger.log('키워드 목록 (' + keywords.length + '개): ' + keywords.join(', '));
  Logger.log('');

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
    { item: nestedItem,   label: 'NESTED format (should match ✅)' },
    { item: flatItem,     label: 'FLAT format   (should match ✅)' },
    { item: noMatchItem,  label: 'No keyword    (should NOT match ❌)' },
  ].forEach(function(tc) {
    const text      = itemText(tc.item);
    const matched   = keywords.filter(function(kw) { return text.includes(kw); });
    const uniqueId  = getUniqueId(tc.item);

    Logger.log('── ' + tc.label);
    Logger.log('  uniqueId : ' + (uniqueId || '❌ 비어있음 — 이게 문제!'));
    Logger.log('  키워드   : ' + (matched.length ? matched.join(', ') : '없음'));
    Logger.log('  결과     : ' + (matched.length && uniqueId ? '✅ 매칭됨' : '❌ 건너뜀'));
    Logger.log('');
  });
}

// ── Run from GAS Script Editor to diagnose column / handle issues ──
function debugMonitoringSetup() {
  try {
    const ws = _getMonitoringSheet();
    if (!ws) { Logger.log('❌ 모니터링 시트 없음'); return; }

    Logger.log('시트명: ' + ws.getName());
    Logger.log('헤더 행: ' + JSON.stringify(ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0]));

    const all    = ws.getDataRange().getValues().slice(1);
    const sample = all.slice(0, 10).map(function(r) { return (r[MON_C.HANDLE] || '').toString().trim() || '(empty)'; });
    Logger.log('C열(핸들) 첫 10개: ' + JSON.stringify(sample));
    Logger.log('전체 데이터 행: ' + all.length + '개');

    const handles = _getTikTokInfluencers(99);
    Logger.log('감지된 핸들 ' + handles.length + '개: ' + handles.join(', '));

    Logger.log('MON_START_DATE: ' + (PropertiesService.getScriptProperties().getProperty('MON_START_DATE') || '미설정'));
    Logger.log('MON_END_DATE:   ' + (PropertiesService.getScriptProperties().getProperty('MON_END_DATE')   || '미설정'));
    Logger.log('MON_RUN_ID:     ' + (PropertiesService.getScriptProperties().getProperty('MON_RUN_ID')     || '없음'));
    Logger.log('APIFY_TOKEN:    ' + (PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN') ? '설정됨' : '❌ 없음'));
  } catch (e) {
    Logger.log('오류: ' + e);
  }
}

// Run once from the GAS Script Editor to remove duplicate handle rows.
// Keeps the row with the most scraped data (has a link > has a date > first seen).
function deduplicateMonitoringSheet() {
  const ws = _getMonitoringSheet();
  if (!ws) { Logger.log('❌ 모니터링 시트 없음'); return; }

  const allValues = ws.getDataRange().getValues();
  const header    = allValues[0];
  const dataRows  = allValues.slice(1);

  const C = MON_C;
  const best = {};   // handle.toLowerCase() → row index in dataRows

  dataRows.forEach(function(row, idx) {
    const handle = (row[C.HANDLE] || '').toString().trim().replace(/^@/, '').toLowerCase();
    if (!handle) return;

    if (best[handle] === undefined) {
      best[handle] = idx;
      return;
    }
    // Prefer row that already has a review link
    const prev = dataRows[best[handle]];
    const prevHasLink = prev[C.LINK] && prev[C.LINK].toString().startsWith('http');
    const currHasLink = row[C.LINK]  && row[C.LINK].toString().startsWith('http');
    if (currHasLink && !prevHasLink) best[handle] = idx;
  });

  const keepIndices = new Set(Object.values(best));
  const kept = dataRows.filter(function(_, idx) { return keepIndices.has(idx); });

  const newData = [header].concat(kept);
  ws.clearContents();
  ws.getRange(1, 1, newData.length, newData[0].length).setValues(newData);

  Logger.log('정리 완료: ' + dataRows.length + '행 → ' + kept.length + '행 (중복 ' + (dataRows.length - kept.length) + '개 삭제)');
}

function routeMonitoring(action, p, body) {
  switch (action) {
    case 'getMonitoringData'      : return getMonitoringData();
    case 'getMonitoringKeywords'  : return getMonitoringKeywords();
    case 'saveMonitoringKeywords'  : return saveMonitoringKeywords((body || {}).brandKeywords || (body || {}).keywords || {});
    case 'resetMonitoringKeywords' : return resetMonitoringKeywords();
    case 'runMonitoringScrape'    : return runMonitoringScrape();
    case 'checkMonitoringRun'     : return checkMonitoringRun();
    case 'resetMonitoringRun'     : return resetMonitoringRun();
    default                       : return null;
  }
}
