// ============================================================
//  TikTok Trend
//  Source: Outlook drafts matching trend/beauty keywords
// ============================================================

function getAllTrendDrafts() {
  try {
    const token = getOutlookAccessToken();
    const url = 'https://graph.microsoft.com/v1.0/me/mailFolders/Drafts/messages'
      + '?$select=subject,body,receivedDateTime,lastModifiedDateTime'
      + '&$top=50'
      + '&$orderby=lastModifiedDateTime desc';

    const res = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true,
    });

    if (res.getResponseCode() !== 200) {
      return { error: 'Outlook 초안 조회 실패: HTTP ' + res.getResponseCode(), drafts: [] };
    }

    const data = JSON.parse(res.getContentText());
    const list = [];

    (data.value || []).forEach(function(msg) {
      const subj = (msg.subject || '').toLowerCase();
      if (subj.includes('trend') || subj.includes('트렌드') || subj.includes('beauty') || subj.includes('뷰티')) {
        const rawBody = ((msg.body || {}).content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        const dateStr = msg.lastModifiedDateTime || msg.receivedDateTime || '';
        const dateObj = dateStr ? new Date(dateStr) : new Date();
        list.push({
          subject : msg.subject || '',
          body    : rawBody,
          date    : dateObj.toLocaleDateString('ko-KR'),
          ts      : dateObj.getTime(),
        });
      }
    });

    list.sort((a, b) => b.ts - a.ts);
    return { drafts: list };
  } catch (e) {
    return { error: e.toString(), drafts: [] };
  }
}

function routeTrend(action, p, body) {
  switch (action) {
    case 'getAllTrendDrafts': return getAllTrendDrafts();
    default: return null;
  }
}
