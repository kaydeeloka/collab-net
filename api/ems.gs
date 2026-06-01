// ============================================================
//  Tab: EMS 트래킹 — 우정사업본부 통합배송조회 Open API
//  Endpoint: getLongitudinalCombinedList (XML)
//
//  Script Properties required:
//    EPOST_API_KEY  — 우정사업본부 Open API 인증키 (Decoding 키)
// ============================================================

// Cloud Run relay in Seoul (asia-northeast3) — proxies to Korea Post API to bypass IP block
// Replace with your actual Cloud Run URL after deployment
const EPOST_RELAY_URL = 'https://epost-relay-239942119193.asia-northeast3.run.app/track';
const EPOST_ENDPOINT = 'https://openapi.epost.go.kr/trace/retrieveLongitudinalCombinedService/retrieveLongitudinalCombinedService/getLongitudinalCombinedList';

function _epostApiKey() {
  return PropertiesService.getScriptProperties().getProperty('EPOST_API_KEY');
}

// ── Status mapping — Korean Post status text → standard label ──
// Korea Post returns Korean-language status descriptions.
// Patterns are checked in order; first match wins.
const EPOST_STATUS_PATTERNS = [
  { pattern: /배달완료|배달 완료|수취인.*서명|delivered/i, label: 'Delivered',        color: '#43a047' },
  { pattern: /배달준비|집배원.*출발|out for delivery/i,    label: 'Out for Delivery', color: '#42a5f5' },
  { pattern: /픽업|pick.?up/i,                            label: 'Pick Up',          color: '#1565c0' },
  { pattern: /반송|미배달|불명|배달불능|수취거절|return/i,   label: 'Undelivered',      color: '#e53935' },
  { pattern: /보류|조사|세관|통관보류|alert|hold/i,         label: 'Alert',            color: '#fb8c00' },
  { pattern: /접수|발송인.*창구|info.?received/i,          label: 'Info Received',    color: '#00bcd4' },
  { pattern: /발송|통관|도착|입항|수입|운송|항공|환적|경유|transit|dispatch|depart|arriv/i, label: 'In Transit', color: '#1e88e5' },
];

const STATUS_MAP = {
  'Delivered':        { label: 'Delivered',        color: '#43a047' },
  'Out for Delivery': { label: 'Out for Delivery', color: '#42a5f5' },
  'Pick Up':          { label: 'Pick Up',          color: '#1565c0' },
  'In Transit':       { label: 'In Transit',       color: '#1e88e5' },
  'Info Received':    { label: 'Info Received',    color: '#00bcd4' },
  'Undelivered':      { label: 'Undelivered',      color: '#e53935' },
  'Alert':            { label: 'Alert',            color: '#fb8c00' },
  'Expired':          { label: 'Expired',          color: '#b71c1c' },
  'Not Found':        { label: 'Not Found',        color: '#9e9e9e' },
};

function _mapEpostStatus(statusText) {
  for (const p of EPOST_STATUS_PATTERNS) {
    if (p.pattern.test(statusText)) return { label: p.label, color: p.color };
  }
  return { label: 'In Transit', color: '#1e88e5' }; // default for unknown Korean statuses
}

// ── Debug: run from GAS editor to inspect raw API response ────
// 1. Paste a real EMS tracking number below
// 2. Click Run → debugEpostRaw
// 3. View → Logs
function debugEpostRaw() {
  const number = 'EB091380751KR'; // ← change to real tracking number
  const url = EPOST_RELAY_URL + '?rgist=' + encodeURIComponent(number);

  Logger.log('Request URL: ' + url);
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log('HTTP status: ' + res.getResponseCode());
  Logger.log('=== RAW RESPONSE ===');
  Logger.log(res.getContentText());
}

// ── Korea Post API: get tracking info for one number ──────────
// Note: the API has typos in field names — 'statue' (not status),
// 'locaiont' (not location), 'detaileTrackList' (not detailTrackList)
function _epostFetch(number) {
  const url = EPOST_RELAY_URL + '?rgist=' + encodeURIComponent(number);

  try {
    const res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = res.getResponseCode();
    if (code !== 200) return { error: 'Relay HTTP ' + code };

    const xml  = res.getContentText();
    const doc  = XmlService.parse(xml);
    const root = doc.getRootElement();

    // Check <header><successYN>
    const header = root.getChild('header');
    if (header) {
      const successYN = (header.getChildText('successYN') || '').trim();
      if (successYN && successYN !== 'Y') {
        return { error: header.getChildText('errorMessage') || '조회 실패 (successYN: ' + successYN + ')' };
      }
    }

    // Navigate to <trackInfo>
    const trackInfo = root.getChild('trackInfo');
    if (!trackInfo) return { error: '추적 정보 없음 (trackInfo 없음)' };

    // Overall current status from <trackState> — most authoritative
    const trackState = (trackInfo.getChildText('trackState') || '').trim();

    // Individual events in <detaileTrackList> (API typo: 'detaile')
    const events = trackInfo.getChildren('detaileTrackList');

    let lastDesc = trackState;
    let lastTime = '';
    let lastLoc  = '';

    if (events && events.length > 0) {
      // Events ordered by sortNo ascending — last element = most recent
      const latest = events[events.length - 1];
      lastDesc = (latest.getChildText('statue')   || '').trim(); // API typo: field is 'statue' not 'status'
      lastLoc  = (latest.getChildText('location') || '').trim();
      const d  = (latest.getChildText('date')     || '').trim();
      const t  = (latest.getChildText('time')     || '').trim();
      lastTime = d + (t ? ' ' + t : '');
    }

    // Map status: prefer <trackState> for overall state, fall back to latest event statue
    const info = _mapEpostStatus(trackState || lastDesc);

    return {
      ok      : true,
      status  : info.label,
      color   : info.color,
      lastTime,
      lastDesc,
      lastLoc,
    };
  } catch (e) {
    return { error: e.toString() };
  }
}

// ── Sheet helpers ─────────────────────────────────────────────
function _getEmsSheet() {
  const ss = SpreadsheetApp.openById(getActiveOutreachId());
  const byName = [SHEET_DELIVERY_TRACK, '배송 추적', 'EMS Tracking', 'EMS 트래킹', 'EMS'];
  for (let i = 0; i < byName.length; i++) {
    const ws = ss.getSheetByName(byName[i]);
    if (ws) return ws;
  }
  const sheets = ss.getSheets();
  for (let s = 0; s < sheets.length; s++) {
    const ws   = sheets[s];
    const last = ws.getLastColumn();
    if (last < 1) continue;
    const hdr    = ws.getRange(1, 1, 1, last).getValues()[0].map(v => v.toString().toLowerCase());
    const joined = hdr.join(' ');
    const looksEms =
      (joined.includes('ems') && (joined.includes('number') || joined.includes('번호'))) ||
      joined.includes('운송장');
    if (looksEms) return ws;
  }
  return null;
}

function _detectEmsCols(ws) {
  const raw = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0];
  const h   = raw.map(v => v.toString().toLowerCase().trim());
  function find(tests, fallback) {
    const idx = h.findIndex(v => tests.some(t => v.includes(t)));
    return idx >= 0 ? idx : fallback;
  }
  return {
    tracking  : find(['ems', 'tracking', 'number', '번호', '운송장'], 1),
    registered: find(['registered', '등록', '등록여부'],              3),
    status    : find(['status', '상태'],                              4),
    updated   : find(['update', 'last', '업데이트', '최근'],           5),
    email     : find(['email address', 'email', '이메일'],            -1),
  };
}

// ── Read sheet data only — no external API calls ──────────────
function getEmsData() {
  try {
    const ws = _getEmsSheet();
    if (!ws) {
      return {
        error: "EMS 시트를 찾을 수 없습니다. 스프레드시트에 '배송추적' 또는 '배송 추적' 탭을 추가하거나, 1행에 EMS NUMBER / 운송장 등 추적용 헤더가 있는 시트를 두세요.",
        rows: [], stats: {},
      };
    }

    const all = ws.getDataRange().getValues();
    if (all.length < 2) return { headers: [], rows: [], stats: { total: 0, delivered: 0, inTransit: 0, pending: 0 } };

    const C   = _detectEmsCols(ws);
    const tz  = Session.getScriptTimeZone();
    const fmt = c => c instanceof Date ? Utilities.formatDate(c, tz, 'yyyy-MM-dd HH:mm') : c.toString();

    const responseRows = all.slice(1)
      .filter(row => (row[C.tracking] || '').toString().trim())
      .map(row => row.map(fmt));

    const ACTIVE    = ['Info Received', 'In Transit', 'Out for Delivery', 'Pick Up'];
    const delivered = responseRows.filter(r => r[C.status] === 'Delivered').length;
    const inTransit = responseRows.filter(r => ACTIVE.includes(r[C.status])).length;
    const pending   = responseRows.length - delivered - inTransit;

    const statusColors = {};
    Object.values(STATUS_MAP).forEach(v => { statusColors[v.label] = v.color; });

    return {
      headers     : all[0].map(h => h.toString()),
      rows        : responseRows,
      colIdx      : C,
      emailCol    : C.email, // -1 means no email column in this sheet
      stats       : { total: responseRows.length, delivered, inTransit, pending },
      statusColors,
    };
  } catch (e) {
    return { error: e.toString(), rows: [], stats: { total: 0, delivered: 0, inTransit: 0, pending: 0 } };
  }
}

// ── Write tracking result to sheet row ────────────────────────
function _writeTrackRow(ws, rowIdx, info, C) {
  const statusCol  = (C && C.status  >= 0) ? (C.status  + 1) : 5;
  const updatedCol = (C && C.updated >= 0) ? (C.updated + 1) : 6;
  ws.getRange(rowIdx, statusCol)
    .setValue(info.status)
    .setBackground(info.color)
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  ws.getRange(rowIdx, updatedCol).setValue(
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
  );
}

// ── Sync one tracking number (called from UI) ─────────────────
function syncOneTracking(number, sheetRow) {
  try {
    const ws = _getEmsSheet();
    if (!ws) return { ok: false, error: 'Sheet not found' };
    const result = _epostFetch(number);
    if (result.error) return { ok: false, error: result.error };
    _writeTrackRow(ws, sheetRow, result, _detectEmsCols(ws));
    return { ok: true, info: result };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// ── Sync all non-delivered rows ───────────────────────────────
// Korea Post API does not require pre-registration — query directly.
function syncAllTracking() {
  try {
    const ws = _getEmsSheet();
    if (!ws) return { ok: false, error: 'Sheet not found' };
    const all = ws.getDataRange().getValues();
    const C   = _detectEmsCols(ws);
    const FINAL = ['Delivered', 'Expired', 'Undelivered'];
    let updated = 0, skipped = 0;

    for (let i = 1; i < all.length; i++) {
      const num = (all[i][C.tracking] || '').toString().trim();
      if (!num) continue;
      const st = (all[i][C.status] || '').toString().trim();
      if (FINAL.includes(st)) { skipped++; continue; }

      const result = _epostFetch(num);
      if (result.ok) { _writeTrackRow(ws, i + 1, result, C); updated++; }
      Utilities.sleep(1000); // be polite to the API
    }
    return { ok: true, updated, skipped };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// ── Add + immediately sync a new tracking number ──────────────
function addAndSyncTracking(number, sheetRow) {
  try {
    return syncOneTracking(number, sheetRow);
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// ── Client (배송리스트) sheet helpers ─────────────────────────
function _getClientSheet() {
  const ss = SpreadsheetApp.openById(getActiveOutreachId());
  const byName = [SHEET_DELIVERY_LIST, '배송 리스트', 'Client List', '클라이언트'];
  for (let i = 0; i < byName.length; i++) {
    const ws = ss.getSheetByName(byName[i]);
    if (ws) return ws;
  }
  return null;
}

function getClientData() {
  try {
    const ws = _getClientSheet();
    if (!ws) return { error: '배송리스트 시트를 찾을 수 없습니다.', rows: [], headers: [] };
    const all = ws.getDataRange().getValues();
    if (all.length < 2) return { headers: all.length ? all[0].map(String) : [], rows: [] };
    const headers = all[0].map(String);
    const rows = all.slice(1)
      .map((r, i) => ({ row: r.map(c => c.toString()), sheetRow: i + 2 }))
      .filter(({ row }) => row.some(c => c.trim() !== ''))
      .map(({ row, sheetRow }) => {
        const noIdx = headers.map(h => h.toLowerCase()).indexOf('no');
        if (noIdx < 0 || !row[noIdx]) {
          const r2 = row.slice();
          if (noIdx >= 0) r2[noIdx] = String(sheetRow);
          return r2;
        }
        return row;
      });
    return { headers, rows };
  } catch (e) {
    return { error: e.toString(), rows: [], headers: [] };
  }
}

function addClient(b) {
  try {
    const ws = _getClientSheet();
    if (!ws) return { error: '배송리스트 시트를 찾을 수 없습니다.' };
    const headers = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0].map(h => h.toString().toLowerCase().trim());
    const find = keys => {
      for (const k of keys) {
        const i = headers.indexOf(k);
        if (i >= 0) return i;
      }
      return -1;
    };
    const lastRow = ws.getLastRow() + 1;
    const totalCols = Math.max(ws.getLastColumn(), 14);
    const newRow = new Array(totalCols).fill('');
    const set = (keys, val) => { const i = find(keys); if (i >= 0) newRow[i] = val || ''; };
    set(['no'],                     String(lastRow - 1));
    set(['platform'],               b.platform  || '');
    set(['handle', 'account'],      b.handle    || '');
    set(['followers', 'follower'],  b.follower  || '');
    set(['name'],                   b.name      || '');
    set(['phone'],                  b.phone     || '');
    set(['email'],                  b.email     || '');
    set(['address line 1', 'addr1'],b.addr1     || '');
    set(['address line 2', 'addr2'],b.addr2     || '');
    set(['city'],                   b.city      || '');
    set(['state'],                  b.state     || '');
    set(['zip', 'postal code'],     b.zip       || '');
    set(['country'],                b.country   || '');
    set(['product', '협찬품'],       b.product   || '');
    ws.getRange(lastRow, 1, 1, newRow.length).setValues([newRow]);
    return { ok: true, sheetRow: lastRow };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function deleteClient(rowId) {
  try {
    const ws = _getClientSheet();
    if (!ws) return { ok: false, error: '배송리스트 시트를 찾을 수 없습니다.' };
    const all     = ws.getDataRange().getValues();
    const headers = all[0].map(h => h.toString().toLowerCase().trim());
    const noIdx   = headers.indexOf('no');
    for (let i = 1; i < all.length; i++) {
      if (String(all[i][noIdx >= 0 ? noIdx : 0]) === String(rowId)) {
        ws.deleteRow(i + 1);
        return { ok: true };
      }
    }
    return { ok: false, error: '해당 행을 찾을 수 없습니다.' };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function toggleEmailSent(rowId) {
  try {
    const ws      = _getEmsSheet();
    if (!ws) return { ok: false, error: 'EMS 시트를 찾을 수 없습니다.' };
    const all     = ws.getDataRange().getValues();
    const headers = all[0].map(h => h.toString().toLowerCase().trim());
    const noIdx   = headers.findIndex(h => h === 'no');
    const sentIdx = headers.findIndex(h => h.includes('email sent') || h.includes('이메일발송'));
    if (sentIdx < 0) return { ok: false, error: 'Email Sent? 컬럼을 찾을 수 없습니다.' };
    for (let i = 1; i < all.length; i++) {
      if (String(all[i][noIdx >= 0 ? noIdx : 0]) === String(rowId)) {
        const cur = (all[i][sentIdx] || '').toString().trim();
        ws.getRange(i + 1, sentIdx + 1).setValue(cur === 'Yes' ? 'No' : 'Yes');
        return { ok: true };
      }
    }
    return { ok: false, error: '해당 행을 찾을 수 없습니다.' };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function updateTracking(b) {
  try {
    const ws      = _getEmsSheet();
    if (!ws) return { ok: false, error: 'EMS 시트를 찾을 수 없습니다.' };
    const all     = ws.getDataRange().getValues();
    const headers = all[0].map(h => h.toString().toLowerCase().trim());
    const find    = keys => headers.findIndex(h => keys.some(k => h.includes(k)));
    const noIdx      = headers.findIndex(h => h === 'no');
    const emsIdx     = find(['ems number', 'ems_number', '운송장번호', '운송장']);
    const arrivalIdx = find(['us arrival', 'arrival', '미국입고']);
    const regIdx     = find(['registered', '등록여부']);
    const statusIdx  = find(['status', '상태']);
    for (let i = 1; i < all.length; i++) {
      if (String(all[i][noIdx >= 0 ? noIdx : 0]) === String(b.rowId)) {
        if (emsIdx     >= 0) ws.getRange(i + 1, emsIdx     + 1).setValue(b.emsNum     || '');
        if (arrivalIdx >= 0) ws.getRange(i + 1, arrivalIdx + 1).setValue(b.arrival    || '');
        if (regIdx     >= 0) ws.getRange(i + 1, regIdx     + 1).setValue(b.registered || 'No');
        if (statusIdx  >= 0) ws.getRange(i + 1, statusIdx  + 1).setValue(b.status     || 'Preparing');
        return { ok: true };
      }
    }
    return { ok: false, error: '해당 행을 찾을 수 없습니다.' };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// ── Route handler ─────────────────────────────────────────────
function routeEms(action, p, body) {
  const b = body || {};
  switch (action) {
    case 'getEmsData':         return getEmsData();
    case 'getClientData':      return getClientData();
    case 'addClient':          return addClient(b);
    case 'deleteClient':       return deleteClient(b.rowId);
    case 'toggleEmailSent':    return toggleEmailSent(b.rowId);
    case 'updateTracking':     return updateTracking(b);
    case 'syncOneTracking':    return syncOneTracking(b.number, b.sheetRow);
    case 'syncAllTracking':    return syncAllTracking();
    case 'addAndSyncTracking': return addAndSyncTracking(b.number, b.sheetRow);
    default: return null;
  }
}
