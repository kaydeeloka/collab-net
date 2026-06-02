// ============================================================
//  Tab: 인플루언서 모니터링
// ============================================================

// Column indices (0-based) — matches sheet headers: 플랫폼|계정|핸들|영상일|링크|조회수|좋아요|댓글|최종업데이트
const MON_C = {
  PLATFORM   : 0,  // 플랫폼
  INFLUENCER : 1,  // 계정 (인플루언서명)
  HANDLE     : 2,  // 핸들
  DATE       : 3,  // 영상일
  LINK       : 4,  // 링크
  VIEWS      : 5,  // 조회수
  LIKES      : 6,  // 좋아요
  COMMENTS   : 7,  // 댓글
  UPDATED    : 8,  // 최종업데이트
  KEYWORDS   : 9,  // 감지 키워드 (optional, may not exist)
};

const DEFAULT_MON_KEYWORDS = ['mimuse', 'mi muse', 'mi-muse', '미뮤즈', '#mimuse', '#미뮤즈', 'MiMuse Beauty'];

function getMonitoringData() {
  try {
    // If a dedicated monitoring spreadsheet ID is saved in Script Properties, use it;
    // otherwise look for the 모니터링 tab in the active outreach spreadsheet.
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
    const rows    = all.slice(1).map(r => r.map(c => c.toString()));

    const C = MON_C;

    const lastRunRow = rows.find(r => r[C.UPDATED]);
    const lastRun    = lastRunRow ? lastRunRow[C.UPDATED] : '아직 실행 안 됨';

    const reviewRows  = rows.filter(r => r[C.LINK] && r[C.LINK].startsWith('http'));
    const influencers = [...new Set(rows.map(r => r[C.INFLUENCER]).filter(n => n))];
    const totalViews  = reviewRows.reduce((s, r) => s + (parseInt(r[C.VIEWS])     || 0), 0);
    const totalLikes  = reviewRows.reduce((s, r) => s + (parseInt(r[C.LIKES])     || 0), 0);
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
