// ============================================================
//  Tab: 아웃리치 — 「K-뷰티」「일반뷰티」시트의 Outreach 열
// ============================================================

// Returns fixed column indices based on the standard 17-column header.
// All sheets (K-뷰티, 일반뷰티, new-phase sheets) share this exact layout.
function _buildOutreachColIdx() {
  return {
    name        : COL_DISPLAY_NAME,
    displayName : COL_DISPLAY_NAME,
    handle      : COL_HANDLE,
    email       : COL_EMAIL,
    sent        : COL_OUTREACH,
    outreach    : COL_OUTREACH,
    sentDate    : -1,
    rank        : COL_RANK,
    followers   : COL_FOLLOWERS,
    follower    : COL_FOLLOWERS,
    following   : COL_FOLLOWING,
    totalLikes  : COL_TOTAL_LIKES,
    videoCount  : COL_VIDEO_COUNT,
    engRate     : COL_ENGAGE_RATE,
    bio         : COL_BIO,
    profileUrl  : COL_PROFILE_URL,
    avgView     : COL_AVG_VIEWS,
    reply       : -1,
    replyBody   : COL_REPLY_BODY,
    replyDate   : COL_REPLY_DATE,
  };
}

function _readOutreachTab(ss, tabName) {
  var ws = ss.getSheetByName(tabName);
  var sheetTabName = ws ? ws.getName() : tabName;
  if (!ws) {
    return {
      headers: [], rows: [], rowNums: [], stats: { total: 0, sent: 0, pending: 0, replied: 0 },
      error: tabName + ' 탭을 찾을 수 없습니다.',
      sheetTabName: sheetTabName,
    };
  }
  const all = ws.getDataRange().getValues();
  if (all.length < 2) {
    return {
      headers: all.length ? all[0].map(h => h.toString()) : [],
      rows: [], rowNums: [], stats: { total: 0, sent: 0, pending: 0, replied: 0 },
      sheetTabName: sheetTabName,
    };
  }

  const rowsWithIdx = all.slice(1)
    .map((r, i) => ({ row: r.map(c => c.toString()), sheetRow: i + 2 }))
    .filter(({ row }) => row.some(c => c.trim() !== ''));
  const sent = rowsWithIdx.filter(x => ['yes','reply','negotiate','reject','accept'].includes((x.row[COL_OUTREACH] || '').toLowerCase())).length;

  return {
    headers : all[0].map(h => h.toString()),
    rows    : rowsWithIdx.map(x => x.row),
    rowNums : rowsWithIdx.map(x => x.sheetRow),
    sheetTabName,
    stats   : { total: rowsWithIdx.length, sent, pending: rowsWithIdx.length - sent, replied: 0 },
  };
}

function getOutreachData() {
  try {
    const ss = SpreadsheetApp.openById(getActiveOutreachId());

    const k = _readOutreachTab(ss, SHEET_K_BEAUTY);
    const g = _readOutreachTab(ss, SHEET_GENERAL_BEAUTY);

    const kOk = !(k.error && (!k.headers || !k.headers.length));
    const gOk = !(g.error && (!g.headers || !g.headers.length));
    if (!kOk && !gOk) {
      return { error: k.error || g.error || (SHEET_K_BEAUTY + ' / ' + SHEET_GENERAL_BEAUTY + ' 탭을 찾을 수 없습니다.') };
    }

    // All sheets share the same 17-column standard header — use fixed colIdx
    const colIdx = _buildOutreachColIdx();

    function pad(r) {
      const out = r.slice();
      while (out.length < COL_TOTAL) out.push('');
      return out.map(c => c.toString());
    }

    const combined = []
      .concat((k.rows || []).map((r, i) => ({ row: pad(r), sheetRow: (k.rowNums || [])[i], sheetName: k.sheetTabName })))
      .concat((g.rows || []).map((r, i) => ({ row: pad(r), sheetRow: (g.rowNums || [])[i], sheetName: g.sheetTabName })));

    const TIERS  = ['1순위', '2순위', '3순위', '4순위', '5순위'];
    const result = {};
    TIERS.forEach(tier => {
      const items   = combined.filter(x => (x.row[COL_RANK] || '').toString().trim() === tier);
      const sent    = items.filter(x => ['yes','reply','negotiate','reject','accept'].includes((x.row[COL_OUTREACH] || '').toLowerCase())).length;
      const replied = items.filter(x => ['reply','negotiate','reject','accept'].includes((x.row[COL_OUTREACH] || '').toLowerCase())).length;
      result[tier] = {
        headers  : LISTUP_HEADERS.slice(),
        rows     : items.map(x => x.row),
        rowNums  : items.map(x => x.sheetRow),
        sheetNames: items.map(x => x.sheetName),
        colIdx,
        stats    : { total: items.length, sent, pending: items.length - sent, replied },
      };
    });
    return result;
  } catch (e) {
    return { error: e.toString() };
  }
}

// All sheets use the standard 17-column header — return fixed constants.
function _detectSheetColIdx(ws) {
  return { sent: COL_OUTREACH, sentDate: -1 };
}

function markOutreachSent(sheetRow, sentCol, sentDateCol, sheetName) {
  try {
    const ss  = SpreadsheetApp.openById(getActiveOutreachId());
    const name = (sheetName || '').toString().trim();
    var ws = name ? ss.getSheetByName(name) : null;
    if (!ws) return { ok: false, error: (name || '시트') + '를 찾을 수 없습니다.' };
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    // Re-detect columns from this sheet's own header to avoid cross-sheet index mismatch
    var idx = _detectSheetColIdx(ws);
    var sc  = idx.sent     >= 0 ? idx.sent     : sentCol;
    var sdc = idx.sentDate >= 0 ? idx.sentDate : sentDateCol;

    if (sc  >= 0) ws.getRange(sheetRow, sc  + 1).setValue('yes');
    if (sdc >= 0) ws.getRange(sheetRow, sdc + 1).setValue(today);

    return { ok: true, date: today };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function markOutreachReply(sheetRow, sentCol, sheetName) {
  try {
    const ss  = SpreadsheetApp.openById(getActiveOutreachId());
    const name = (sheetName || '').toString().trim();
    var ws = name ? ss.getSheetByName(name) : null;
    if (!ws) return { ok: false, error: (name || '시트') + '를 찾을 수 없습니다.' };
    var idx = _detectSheetColIdx(ws);
    var sc  = idx.sent >= 0 ? idx.sent : sentCol;
    if (sc >= 0) ws.getRange(sheetRow, sc + 1).setValue('reply');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function sendOutreachEmail(body) {
  // Delegates to Outlook (Microsoft Graph API)
  return sendOutlookEmail(body);
}

function markOutreachState(sheetRow, sentCol, sheetName, value) {
  try {
    const ss = SpreadsheetApp.openById(getActiveOutreachId());
    const name = (sheetName || '').toString().trim();
    const ws = name ? ss.getSheetByName(name) : null;
    if (!ws) return { ok: false, error: (name || '시트') + '를 찾을 수 없습니다.' };
    const allowed = ['target', 'yes', 'reply', 'negotiate', 'reject', 'accept'];
    if (!allowed.includes(value)) return { ok: false, error: '올바르지 않은 상태값: ' + value };
    var idx = _detectSheetColIdx(ws);
    var sc  = idx.sent >= 0 ? idx.sent : sentCol;
    if (sc >= 0) ws.getRange(sheetRow, sc + 1).setValue(value);

    // Auto-append to 확정인플루언서 sheet when accepted
    if (value === 'accept') {
      try {
        const row = ws.getRange(sheetRow, 1, 1, COL_TOTAL).getValues()[0].map(function(c) { return c.toString(); });
        const phase = PropertiesService.getScriptProperties().getProperty('ACTIVE_PHASE') || '';
        appendConfirmedInfluencer({
          phase        : phase,
          rank         : row[COL_RANK]         || '',
          handle       : row[COL_HANDLE]        || '',
          displayName  : row[COL_DISPLAY_NAME]  || '',
          email        : row[COL_EMAIL]         || '',
          followers    : row[COL_FOLLOWERS]     || '',
          engagementRate: row[COL_ENGAGE_RATE]  || '',
          profileUrl   : row[COL_PROFILE_URL]   || '',
        });
      } catch (e2) {
        // Non-fatal — state was already written
      }
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function routeOutreach(action, p, body) {
  const b = body || {};
  switch (action) {
    case 'getOutreachData':    return getOutreachData();
    case 'markOutreachSent':   return markOutreachSent(b.sheetRow, b.sentCol, b.sentDateCol, b.sheetName);
    case 'markOutreachReply':  return markOutreachReply(b.sheetRow, b.sentCol, b.sheetName);
    case 'sendOutreachEmail':  return sendOutreachEmail(b);
    case 'markOutreachState':  return markOutreachState(b.sheetRow, b.sentCol, b.sheetName, b.value);
    default: return null;
  }
}
