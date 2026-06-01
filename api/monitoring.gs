// ============================================================
//  Tab: 인플루언서 모니터링
// ============================================================

function getMonitoringData() {
  try {
    const ss  = SpreadsheetApp.openById(getActiveOutreachId());
    const ws  = ss.getSheetByName(SHEET_MONITORING);
    if (!ws) {
      return _emptyMonitoring('「' + SHEET_MONITORING + '」탭을 찾을 수 없습니다. 스프레드시트에 모니터링 시트를 추가하세요.');
    }
    const all = ws.getDataRange().getValues();

    if (all.length < 2) return _emptyMonitoring('No data in sheet');

    const headers = all[0].map(h => h.toString());
    const rows    = all.slice(1).map(r => r.map(c => c.toString()));

    const C = { PLATFORM:0, ACCOUNT:1, HANDLE:2, DATE:3, LINK:4, VIEWS:5, LIKES:6, COMMENTS:7, UPDATED:8 };

    const lastRunRow = rows.find(r => r[C.UPDATED]);
    const lastRun    = lastRunRow ? lastRunRow[C.UPDATED] : '아직 실행 안 됨';

    const mentioned  = rows.filter(r => r[C.LINK] && r[C.LINK].startsWith('http'));
    const handles    = [...new Set(rows.map(r => r[C.HANDLE]).filter(h => h))];
    const totalViews = mentioned.reduce((s, r) => s + (parseInt(r[C.VIEWS]) || 0), 0);
    const totalLikes = mentioned.reduce((s, r) => s + (parseInt(r[C.LIKES]) || 0), 0);

    return {
      headers,
      rows,
      stats: {
        totalInfluencers : handles.length,
        tiktok           : rows.filter(r => r[C.PLATFORM].toLowerCase() === 'tiktok').length,
        instagram        : rows.filter(r => r[C.PLATFORM].toLowerCase().includes('instagram')).length,
        mentions         : mentioned.length,
        totalViews,
        totalLikes,
        lastRun
      }
    };
  } catch (e) {
    return _emptyMonitoring(e.toString());
  }
}

function _emptyMonitoring(error) {
  return { error, headers: [], rows: [], stats: { totalInfluencers:0, tiktok:0, instagram:0, mentions:0, totalViews:0, totalLikes:0, lastRun:'-' } };
}

function routeMonitoring(action, p, body) {
  switch (action) {
    case 'getMonitoringData': return getMonitoringData();
    default: return null;
  }
}
