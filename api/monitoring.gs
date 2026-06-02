// ============================================================
//  Tab: 인플루언서 모니터링
// ============================================================

// Column indices (0-based) — must match what influencer_monitor_apify.py writes
const MON_C = {
  INFLUENCER : 0,  // 인플루언서명
  HANDLE     : 1,  // 핸들
  PLATFORM   : 2,  // 플랫폼
  LINK       : 3,  // 리뷰콘텐츠링크
  DATE       : 4,  // 업로드일자
  VIEWS      : 5,  // 조회수
  LIKES      : 6,  // 좋아요수
  COMMENTS   : 7,  // 댓글수
  KEYWORDS   : 8,  // 감지 키워드
  UPDATED    : 9,  // 모니터링 실행일
};

const DEFAULT_MON_KEYWORDS = ['mimuse', 'mi muse', 'mi-muse', '미뮤즈', '#mimuse', '#미뮤즈', 'MiMuse Beauty'];

function getMonitoringData() {
  try {
    const ss  = SpreadsheetApp.openById(MONITORING_SHEET_ID);
    const ws  = ss.getSheets()[0];
    const all = ws.getDataRange().getValues();

    if (all.length < 2) return _emptyMonitoring('No data in sheet');

    const headers = all[0].map(h => h.toString());
    const rows    = all.slice(1).map(r => r.map(c => c.toString()));

    const C = MON_C;

    const lastRunRow = rows.find(r => r[C.UPDATED]);
    const lastRun    = lastRunRow ? lastRunRow[C.UPDATED] : '아직 실행 안 됨';

    const reviewRows  = rows.filter(r => r[C.LINK] && r[C.LINK].startsWith('http'));
    const influencers = [...new Set(rows.map(r => r[C.INFLUENCER]).filter(n => n))];
    const totalViews  = reviewRows.reduce((s, r) => s + (parseInt(r[C.VIEWS])    || 0), 0);
    const totalLikes  = reviewRows.reduce((s, r) => s + (parseInt(r[C.LIKES])    || 0), 0);
    const totalComments = reviewRows.reduce((s, r) => s + (parseInt(r[C.COMMENTS]) || 0), 0);

    // Count how many times each keyword was detected across all reviews
    const keywordCounts = {};
    reviewRows.forEach(r => {
      if (!r[C.KEYWORDS]) return;
      r[C.KEYWORDS].split(',').map(k => k.trim()).filter(Boolean).forEach(k => {
        keywordCounts[k] = (keywordCounts[k] || 0) + 1;
      });
    });

    return {
      headers,
      rows,
      stats: {
        totalInfluencers : influencers.length,
        totalReviews     : reviewRows.length,
        totalViews,
        totalLikes,
        totalComments,
        keywordCounts,
        lastRun
      }
    };
  } catch (e) {
    return _emptyMonitoring(e.toString());
  }
}

function getMonitoringKeywords() {
  const props  = PropertiesService.getScriptProperties();
  const stored = props.getProperty('MONITORING_KEYWORDS');
  return stored ? JSON.parse(stored) : DEFAULT_MON_KEYWORDS;
}

function saveMonitoringKeywords(keywords) {
  PropertiesService.getScriptProperties()
    .setProperty('MONITORING_KEYWORDS', JSON.stringify(keywords));
  return { ok: true };
}

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

function routeMonitoring(action, p, body) {
  switch (action) {
    case 'getMonitoringData'      : return getMonitoringData();
    case 'getMonitoringKeywords'  : return getMonitoringKeywords();
    case 'saveMonitoringKeywords' : return saveMonitoringKeywords((body || {}).keywords || []);
    default                       : return null;
  }
}
