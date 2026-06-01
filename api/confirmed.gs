// ============================================================
//  확정인플루언서 — Confirmed Influencer Management
// ============================================================

const CONFIRMED_HEADERS = [
  '수락일', '차수', '순위', 'Handle', 'Display Name', 'Email',
  '팔로워', 'Engagement Rate (%)', 'Profile URL',
  '협찬품', '콘텐츠 업로드', '업로드 날짜', '포스트 링크', '메모',
];

function _getConfirmedSheet() {
  const ss = SpreadsheetApp.openById(getActiveOutreachId());
  return ss.getSheetByName(SHEET_INFLUENCERS) || null;
}

function _confirmedColMap(ws) {
  const headers = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0];
  const m = {};
  headers.forEach(function(h, i) { m[h.toString().trim().toLowerCase()] = i; });
  return m;
}

// ── Read all confirmed influencers ────────────────────────────
function getConfirmedInfluencers() {
  try {
    const ws = _getConfirmedSheet();
    if (!ws) return { error: SHEET_INFLUENCERS + ' 시트를 찾을 수 없습니다.', rows: [], headers: [] };
    const all = ws.getDataRange().getValues();
    if (all.length < 2) return { headers: CONFIRMED_HEADERS, rows: [] };
    const headers = all[0].map(String);
    const rows = all.slice(1).filter(r => r.some(c => c.toString().trim() !== '')).map(r => r.map(c => c.toString()));
    return { ok: true, headers, rows };
  } catch (e) {
    return { error: e.toString(), rows: [], headers: [] };
  }
}

// ── Append a new confirmed influencer (called from markOutreachState) ─
function appendConfirmedInfluencer(data) {
  try {
    var ws = _getConfirmedSheet();
    if (!ws) {
      // Auto-create the sheet if missing
      const ss = SpreadsheetApp.openById(getActiveOutreachId());
      ws = ss.insertSheet(SHEET_INFLUENCERS);
      ws.getRange(1, 1, 1, CONFIRMED_HEADERS.length).setValues([CONFIRMED_HEADERS]);
      ws.setFrozenRows(1);
    }

    // Avoid duplicate: skip if same email already exists in this phase
    if (data.email) {
      const all = ws.getDataRange().getValues();
      const headers = all[0].map(function(h) { return h.toString().trim().toLowerCase(); });
      const emailIdx = headers.indexOf('email');
      const phaseIdx = headers.indexOf('차수');
      for (var i = 1; i < all.length; i++) {
        const rowEmail = (all[i][emailIdx >= 0 ? emailIdx : 5] || '').toString().trim().toLowerCase();
        const rowPhase = (all[i][phaseIdx >= 0 ? phaseIdx : 1] || '').toString().trim();
        if (rowEmail === data.email.toLowerCase() && rowPhase === data.phase) return { ok: true, skipped: true };
      }
    }

    const cm = _confirmedColMap(ws);
    const find = function(key) { return cm[key.toLowerCase()] >= 0 ? cm[key.toLowerCase()] : -1; };

    const lastRow = ws.getLastRow() + 1;
    const newRow = new Array(CONFIRMED_HEADERS.length).fill('');

    const set = function(key, val) {
      const i = find(key);
      if (i >= 0) newRow[i] = val || '';
    };

    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const props = PropertiesService.getScriptProperties();
    const phase = data.phase || props.getProperty('ACTIVE_PHASE') || '';

    set('수락일',               today);
    set('차수',                 phase);
    set('순위',                 data.rank            || '');
    set('handle',               data.handle          || '');
    set('display name',         data.displayName     || '');
    set('email',                data.email           || '');
    set('팔로워',               data.followers       || '');
    set('engagement rate (%)',  data.engagementRate  || '');
    set('profile url',          data.profileUrl      || '');
    set('협찬품',               data.product         || '');
    set('콘텐츠 업로드',        'Pending');
    set('업로드 날짜',          '');
    set('포스트 링크',          '');
    set('메모',                 data.memo            || '');

    ws.getRange(lastRow, 1, 1, newRow.length).setValues([newRow]);
    return { ok: true, sheetRow: lastRow };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// ── Update a confirmed influencer row ─────────────────────────
function updateConfirmedInfluencer(b) {
  try {
    const ws = _getConfirmedSheet();
    if (!ws) return { ok: false, error: SHEET_INFLUENCERS + ' 시트를 찾을 수 없습니다.' };
    const all = ws.getDataRange().getValues();
    const headers = all[0].map(function(h) { return h.toString().trim().toLowerCase(); });
    const emailIdx = headers.indexOf('email');
    const uploadIdx = headers.indexOf('콘텐츠 업로드');
    const dateIdx = headers.indexOf('업로드 날짜');
    const linkIdx = headers.indexOf('포스트 링크');
    const memoIdx = headers.indexOf('메모');

    for (var i = 1; i < all.length; i++) {
      const rowEmail = (all[i][emailIdx >= 0 ? emailIdx : 5] || '').toString().trim().toLowerCase();
      if (rowEmail !== (b.email || '').toLowerCase()) continue;

      if (b.contentUpload !== undefined && uploadIdx >= 0)
        ws.getRange(i + 1, uploadIdx + 1).setValue(b.contentUpload);
      if (b.uploadDate !== undefined && dateIdx >= 0)
        ws.getRange(i + 1, dateIdx + 1).setValue(b.uploadDate);
      if (b.postLink !== undefined && linkIdx >= 0)
        ws.getRange(i + 1, linkIdx + 1).setValue(b.postLink);
      if (b.memo !== undefined && memoIdx >= 0)
        ws.getRange(i + 1, memoIdx + 1).setValue(b.memo);

      return { ok: true };
    }
    return { ok: false, error: '해당 인플루언서를 찾을 수 없습니다.' };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// ── Delete a confirmed influencer by email ────────────────────
function deleteConfirmedInfluencer(email) {
  try {
    const ws = _getConfirmedSheet();
    if (!ws) return { ok: false, error: SHEET_INFLUENCERS + ' 시트를 찾을 수 없습니다.' };
    const all = ws.getDataRange().getValues();
    const headers = all[0].map(function(h) { return h.toString().trim().toLowerCase(); });
    const emailIdx = headers.indexOf('email');
    for (var i = 1; i < all.length; i++) {
      const rowEmail = (all[i][emailIdx >= 0 ? emailIdx : 5] || '').toString().trim().toLowerCase();
      if (rowEmail === (email || '').toLowerCase()) {
        ws.deleteRow(i + 1);
        return { ok: true };
      }
    }
    return { ok: false, error: '해당 행을 찾을 수 없습니다.' };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function routeConfirmed(action, p, body) {
  const b = body || {};
  switch (action) {
    case 'getConfirmedInfluencers':   return getConfirmedInfluencers();
    case 'updateConfirmedInfluencer': return updateConfirmedInfluencer(b);
    case 'deleteConfirmedInfluencer': return deleteConfirmedInfluencer(b.email);
    default: return null;
  }
}
