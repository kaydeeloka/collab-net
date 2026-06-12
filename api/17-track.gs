// ============================================================
//  17-track.gs — EMS sheet management + 17track API integration
//
//  Script Properties required:
//    TRACK17_API_KEY  — 17track API key (Settings → API)
// ============================================================

// ── 17track API v2.4 ─────────────────────────────────────────
const TRACK17_BASE = 'https://api.17track.net/track/v2.4';

// v2.4 uses string status keys (not numeric codes)
const TRACK17_STATUS = {
  'NotFound':           { label: 'Not Found',           color: '#9e9e9e' },
  'InfoReceived':       { label: 'Info Received',        color: '#00bcd4' },
  'InTransit':          { label: 'In Transit',           color: '#1e88e5' },
  'Expired':            { label: 'Expired',              color: '#b71c1c' },
  'AvailableForPickup': { label: 'Available for Pickup', color: '#8e24aa' },
  'OutForDelivery':     { label: 'Out for Delivery',     color: '#42a5f5' },
  'DeliveryFailure':    { label: 'Delivery Failure',     color: '#fb8c00' },
  'Delivered':          { label: 'Delivered',            color: '#43a047' },
  'Exception':          { label: 'Exception',            color: '#e53935' },
};


function _17trackKey() {
  return PropertiesService.getScriptProperties().getProperty('TRACK17_API_KEY') || '';
}

function _17trackHeaders() {
  return { '17token': _17trackKey(), 'Content-Type': 'application/json' };
}

function register17Track(numbers) {
  var key = _17trackKey();
  if (!key) return { ok: false, error: 'TRACK17_API_KEY가 설정되지 않았습니다.' };
  if (!numbers || numbers.length === 0) return { ok: false, error: '운송장 번호가 없습니다.' };
  var payload = numbers.map(function(n) { return { number: n }; });
  try {
    var res  = UrlFetchApp.fetch(TRACK17_BASE + '/register', {
      method: 'post', headers: _17trackHeaders(),
      payload: JSON.stringify(payload), muteHttpExceptions: true,
    });
    var data = JSON.parse(res.getContentText());
    return { ok: data.code === 0, accepted: (data.data && data.data.accepted) || [], rejected: (data.data && data.data.rejected) || [] };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// Returns true if the tracking number's row has 'Y' in column D (index 3)
// function _isColDMarkedY(number) {
//   try {
//     var ws = _getEmsSheet();
//     if (!ws) return false;
//     var all = ws.getDataRange().getValues();
//     var C   = _detectEmsCols(ws);
//     for (var i = 1; i < all.length; i++) {
//       if ((all[i][C.tracking] || '').toString().trim() === number) {
//         var colD = (all[i][3] || '').toString().trim().toUpperCase();
//         return colD === 'Y' || colD === 'YES';
//       }
//     }
//   } catch (e) {}
//   return false;
// }

function _parseEvtTime(a) {
  if (!a) return { date: '', time: '' };
  // time_raw is {date, time} object in v2.4
  if (typeof a === 'object' && a.date) return { date: a.date || '', time: a.time || '' };
  // time_iso: "2021-02-11T10:52:00+09:00" — strip timezone offset
  var s = a.toString().replace('T', ' ').split(/[Z+]/)[0].trim();
  var idx = s.indexOf(' ');
  return idx > 0 ? { date: s.slice(0, idx), time: s.slice(idx + 1, idx + 9) } : { date: s, time: '' };
}

function get17TrackInfo(number) {
  if (!number) return { ok: false, error: '운송장 번호가 필요합니다.' };
  var key = _17trackKey();
  if (!key) return { ok: false, error: 'TRACK17_API_KEY가 설정되지 않았습니다.' };
  try {
    var res      = UrlFetchApp.fetch(TRACK17_BASE + '/gettrackinfo', {
      method: 'post', headers: _17trackHeaders(),
      payload: JSON.stringify([{ number: number }]), muteHttpExceptions: true,
    });
    var httpCode = res.getResponseCode();
    var rawText  = res.getContentText();
    if (httpCode !== 200) return { ok: false, error: 'HTTP ' + httpCode };

    var data = JSON.parse(rawText);
    if (data.code !== 0) return { ok: false, error: '17track 오류: ' + data.code + '\n' + rawText.slice(0, 300) };

    var accepted = data.data && data.data.accepted;
    var rejected = (data.data && data.data.rejected) || [];
    if (!accepted || accepted.length === 0) {
      return { ok: false, error: 'Please register inside 17track first.' };
      // if (_isColDMarkedY(number)) return { ok: false, error: 'The number is not yet registered inside 17track' };
      // register17Track([number]);
      // return { ok: false, pending: true, error: '운송장을 17track에 등록했습니다. 잠시 후 다시 조회해 주세요.\n\n[raw] ' + rawText.slice(0, 400) };
    }

    // ── v2.4 response: all data is under item.track_info ────
    var item         = accepted[0];
    var trackInfo    = item.track_info      || {};
    var latestStatus = trackInfo.latest_status || {};
    var latestEvent  = trackInfo.latest_event  || {};
    var tracking     = trackInfo.tracking      || {};
    var providers    = tracking.providers      || [];

    var statusStr  = latestStatus.status || '';
    var statusInfo = TRACK17_STATUS[statusStr] || { label: statusStr || 'In Transit', color: '#1e88e5' };

    // No events yet — dump raw so we can see actual structure
    var hasEvents = providers.some(function(p) { return p.events && p.events.length > 0; });
    if (!statusStr && !hasEvents) {
      return { ok: false, pending: true, error: '[raw API response — paste this for debugging]\n\n' + rawText };
    }

    // Collect events from all providers (newest first per provider, we reverse at display)
    var history = [];
    providers.forEach(function(p) {
      var pName = p.provider ? (p.provider.name || '') : '';
      (p.events || []).forEach(function(e) {
        var t = _parseEvtTime(e.time_raw || e.time_iso || '');
        history.push({
          date    : t.date,
          time    : t.time,
          status  : e.description || '',
          location: e.location    || '',
          provider: pName,
        });
      });
    });

    // Carrier name: first provider
    var carrierName = providers.length > 0 && providers[0].provider ? (providers[0].provider.name || '') : '';
    var lastT = _parseEvtTime(latestEvent.time_raw || latestEvent.time_iso || '');

    return {
      ok         : true,
      number     : item.number || number,
      carrier    : carrierName,
      statusLabel: statusInfo.label,
      statusColor: statusInfo.color,
      lastTime   : lastT.date + (lastT.time ? ' ' + lastT.time : ''),
      lastEvent  : latestEvent.description || '',
      history    : history,
    };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// ── Sheet helpers ─────────────────────────────────────────────
function _getEmsSheet() {
  const ss     = SpreadsheetApp.openById(getActiveOutreachId());
  const byName = [SHEET_DELIVERY_TRACK, '배송 추적', 'EMS Tracking', 'EMS 트래킹', 'EMS'];
  for (var i = 0; i < byName.length; i++) {
    var ws = ss.getSheetByName(byName[i]);
    if (ws) return ws;
  }
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var ws   = sheets[s];
    var last = ws.getLastColumn();
    if (last < 1) continue;
    var hdr    = ws.getRange(1, 1, 1, last).getValues()[0].map(function(v) { return v.toString().toLowerCase(); });
    var joined = hdr.join(' ');
    if ((joined.includes('ems') && (joined.includes('number') || joined.includes('번호'))) || joined.includes('운송장')) return ws;
  }
  return null;
}

function _detectEmsCols(ws) {
  var raw = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0];
  var h   = raw.map(function(v) { return v.toString().toLowerCase().trim(); });
  function find(tests, fallback) {
    var idx = h.findIndex(function(v) { return tests.some(function(t) { return v.includes(t); }); });
    return idx >= 0 ? idx : fallback;
  }
  function findEmail() {
    // Exact match first — avoids hitting 'Email Sent?' before 'Email'
    var exact = h.findIndex(function(v) { return v === 'email' || v === 'e-mail' || v === 'email address'; });
    if (exact >= 0) return exact;
    return h.findIndex(function(v) { return (v.includes('email') || v.includes('이메일')) && !v.includes('sent'); });
  }
  return {
    tracking  : find(['ems', 'tracking', 'number', '번호', '운송장'], 1),
    registered: find(['registered', '등록', '등록여부'],              3),
    status    : find(['status', '상태'],                              4),
    updated   : find(['update', 'last', '업데이트', '최근'],           5),
    email     : findEmail(),
  };
}

function getEmsData() {
  try {
    var ws = _getEmsSheet();
    if (!ws) return { error: "EMS 시트를 찾을 수 없습니다.", rows: [], stats: {} };

    var all = ws.getDataRange().getValues();
    if (all.length < 2) return { headers: [], rows: [], stats: { total: 0, delivered: 0, inTransit: 0, pending: 0 } };

    var C   = _detectEmsCols(ws);
    var tz  = Session.getScriptTimeZone();
    var fmt = function(c) { return c instanceof Date ? Utilities.formatDate(c, tz, 'yyyy-MM-dd HH:mm') : c.toString(); };

    var responseRows = all.slice(1)
      .filter(function(row) { return (row[C.tracking] || '').toString().trim(); })
      .map(function(row) { return row.map(fmt); });

    var ACTIVE     = ['Info Received', 'In Transit', 'Out for Delivery', 'Pick Up'];
    var PROBLEM    = ['Exception', 'Delivery Failure', 'DeliveryFailure', 'Expired'];
    var delivered  = responseRows.filter(function(r) { return r[C.status] === 'Delivered'; }).length;
    var inTransit  = responseRows.filter(function(r) { return ACTIVE.includes(r[C.status]); }).length;
    var exception  = responseRows.filter(function(r) { return PROBLEM.includes(r[C.status]); }).length;
    var pending    = responseRows.length - delivered - inTransit;

    var statusColors = {};
    Object.values(TRACK17_STATUS).forEach(function(v) { statusColors[v.label] = v.color; });

    return {
      headers: all[0].map(function(h) { return h.toString(); }),
      rows: responseRows, colIdx: C, emailCol: C.email,
      stats: { total: responseRows.length, delivered, inTransit, pending, exception },
      statusColors,
    };
  } catch (e) {
    return { error: e.toString(), rows: [], stats: { total: 0, delivered: 0, inTransit: 0, pending: 0 } };
  }
}

function _writeTrackRow(ws, rowIdx, info, C) {
  var statusCol  = (C && C.status  >= 0) ? (C.status  + 1) : 5;
  var updatedCol = (C && C.updated >= 0) ? (C.updated + 1) : 6;
  ws.getRange(rowIdx, statusCol).setValue(info.status).setBackground(info.color).setFontColor('#ffffff').setFontWeight('bold');
  ws.getRange(rowIdx, updatedCol).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'));
}

function syncOneTracking(number, sheetRow) {
  try {
    var ws = _getEmsSheet();
    if (!ws) return { ok: false, error: 'Sheet not found' };
    // Use 17track for status sync
    var result = get17TrackInfo(number);
    if (!result.ok) return result;
    var info = { status: result.statusLabel, color: result.statusColor };
    _writeTrackRow(ws, sheetRow, info, _detectEmsCols(ws));
    return { ok: true, info: result };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function syncAllTracking() {
  try {
    var ws = _getEmsSheet();
    if (!ws) return { ok: false, error: 'Sheet not found' };
    var all    = ws.getDataRange().getValues();
    var C      = _detectEmsCols(ws);
    var FINAL  = ['Delivered', 'Expired', 'Undelivered'];
    var updated = 0, skipped = 0;

    for (var i = 1; i < all.length; i++) {
      var num = (all[i][C.tracking] || '').toString().trim();
      if (!num) continue;
      var st = (all[i][C.status] || '').toString().trim();
      if (FINAL.includes(st)) { skipped++; continue; }
      var result = get17TrackInfo(num);
      if (result.ok) {
        _writeTrackRow(ws, i + 1, { status: result.statusLabel, color: result.statusColor }, C);
        updated++;
      }
      Utilities.sleep(500);
    }
    return { ok: true, updated, skipped };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function _getClientSheet() {
  var ss     = SpreadsheetApp.openById(getActiveOutreachId());
  var byName = [SHEET_DELIVERY_LIST, '배송 리스트', 'Client List', '클라이언트'];
  for (var i = 0; i < byName.length; i++) {
    var ws = ss.getSheetByName(byName[i]);
    if (ws) return ws;
  }
  return null;
}

function getClientData() {
  try {
    var ws = _getClientSheet();
    if (!ws) return { error: '배송리스트 시트를 찾을 수 없습니다.', rows: [], headers: [] };
    var all = ws.getDataRange().getValues();
    if (all.length < 2) return { headers: all.length ? all[0].map(String) : [], rows: [] };
    var headers = all[0].map(String);
    var rows = all.slice(1)
      .map(function(r, i) { return { row: r.map(function(c) { return c.toString(); }), sheetRow: i + 2 }; })
      .filter(function(x) { return x.row.some(function(c) { return c.trim() !== ''; }); })
      .map(function(x) {
        var noIdx = headers.map(function(h) { return h.toLowerCase(); }).indexOf('no');
        if (noIdx < 0 || !x.row[noIdx]) {
          var r2 = x.row.slice();
          if (noIdx >= 0) r2[noIdx] = String(x.sheetRow);
          return r2;
        }
        return x.row;
      });
    return { headers, rows };
  } catch (e) {
    return { error: e.toString(), rows: [], headers: [] };
  }
}

function addClient(b) {
  try {
    var ws = _getClientSheet();
    if (!ws) return { error: '배송리스트 시트를 찾을 수 없습니다.' };
    var headers   = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0].map(function(h) { return h.toString().toLowerCase().trim(); });
    var findCol   = function(keys) {
      for (var i = 0; i < keys.length; i++) {
        var idx = headers.indexOf(keys[i]);
        if (idx >= 0) return idx;
      }
      return -1;
    };
    var lastRow   = ws.getLastRow() + 1;
    var totalCols = Math.max(ws.getLastColumn(), 14);
    var newRow    = new Array(totalCols).fill('');
    var set = function(keys, val) { var i = findCol(keys); if (i >= 0) newRow[i] = val || ''; };
    set(['no'],                          String(lastRow - 1));
    set(['platform'],                    b.platform  || '');
    set(['handle', 'account', '계정'],   b.handle    || '');
    set(['followers', 'follower', '팔로워'], b.followers || '');
    set(['name'],                        b.name      || '');
    set(['phone'],                       b.phone     || '');
    set(['email', 'e-mail'],             b.email     || '');
    set(['address line 1'],              b.addr1     || '');
    set(['address line 2'],              b.addr2     || '');
    set(['city'],                        b.city      || '');
    set(['state'],                       b.state     || '');
    set(['zip', 'postal code'],          b.zip       || '');
    set(['country'],                     b.country   || '');
    set(['product', '협찬품'],            b.product   || '');
    ws.getRange(lastRow, 1, 1, newRow.length).setValues([newRow]);
    return { ok: true, sheetRow: lastRow };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function deleteClient(rowId) {
  try {
    var ws      = _getClientSheet();
    if (!ws) return { ok: false, error: '배송리스트 시트를 찾을 수 없습니다.' };
    var all     = ws.getDataRange().getValues();
    var headers = all[0].map(function(h) { return h.toString().toLowerCase().trim(); });
    var noIdx   = headers.indexOf('no');
    for (var i = 1; i < all.length; i++) {
      if (String(all[i][noIdx >= 0 ? noIdx : 0]) === String(rowId)) { ws.deleteRow(i + 1); return { ok: true }; }
    }
    return { ok: false, error: '해당 행을 찾을 수 없습니다.' };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function toggleEmailSent(rowId) {
  try {
    var ws      = _getEmsSheet();
    if (!ws) return { ok: false, error: 'EMS 시트를 찾을 수 없습니다.' };
    var all     = ws.getDataRange().getValues();
    var headers = all[0].map(function(h) { return h.toString().toLowerCase().trim(); });
    var noIdx   = headers.findIndex(function(h) { return h === 'no'; });
    var sentIdx = headers.findIndex(function(h) { return h.includes('email sent') || h.includes('이메일발송'); });
    if (sentIdx < 0) return { ok: false, error: 'Email Sent? 컬럼을 찾을 수 없습니다.' };
    for (var i = 1; i < all.length; i++) {
      if (String(all[i][noIdx >= 0 ? noIdx : 0]) === String(rowId)) {
        var cur = (all[i][sentIdx] || '').toString().trim();
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
    var ws      = _getEmsSheet();
    if (!ws) return { ok: false, error: 'EMS 시트를 찾을 수 없습니다.' };
    var all     = ws.getDataRange().getValues();
    var headers = all[0].map(function(h) { return h.toString().toLowerCase().trim(); });
    var findCol = function(keys) { return headers.findIndex(function(h) { return keys.some(function(k) { return h.includes(k); }); }); };
    var noIdx      = headers.findIndex(function(h) { return h === 'no' || h === 'name'; });
    var emsIdx     = findCol(['ems number', 'ems_number', '운송장번호', '운송장']);
    var arrivalIdx = findCol(['us arrival', 'arrival', '미국입고']);
    var regIdx     = findCol(['registered', '등록여부']);
    var statusIdx  = findCol(['status', '상태']);
    for (var i = 1; i < all.length; i++) {
      if (String(all[i][noIdx >= 0 ? noIdx : 0]) === String(b.rowId)) {
        if (emsIdx     >= 0) ws.getRange(i + 1, emsIdx     + 1).setValue(b.emsNumber || b.emsNum   || '');
        if (arrivalIdx >= 0) ws.getRange(i + 1, arrivalIdx + 1).setValue(b.usArrival || b.arrival  || '');
        if (regIdx     >= 0) ws.getRange(i + 1, regIdx     + 1).setValue(b.registered || 'No');
        if (statusIdx  >= 0) ws.getRange(i + 1, statusIdx  + 1).setValue(b.status    || 'Preparing');
        return { ok: true };
      }
    }
    return { ok: false, error: '해당 행을 찾을 수 없습니다.' };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// ── Debug: returns raw API JSON — use in browser console or Postman ──
function debug17TrackRaw(number) {
  var key = _17trackKey();
  if (!key) return { ok: false, error: 'No API key' };
  try {
    var res = UrlFetchApp.fetch(TRACK17_BASE + '/gettrackinfo', {
      method: 'post', headers: _17trackHeaders(),
      payload: JSON.stringify([{ number: number || 'EG123456789KR' }]), muteHttpExceptions: true,
    });
    return { ok: true, httpCode: res.getResponseCode(), raw: JSON.parse(res.getContentText()) };
  } catch (e) { return { ok: false, error: e.toString() }; }
}

// ── Single route — all EMS + 17track actions ──────────────────
function routeEms(action, p, body) {
  var b = body || {};
  switch (action) {
    case 'getEmsData':          return getEmsData();
    case 'getClientData':       return getClientData();
    case 'addClient':           return addClient(b);
    case 'deleteClient':        return deleteClient(b.rowId);
    case 'toggleEmailSent':     return toggleEmailSent(b.rowId);
    case 'updateTracking':
    case 'updateClientInfo':    return updateTracking(b);
    case 'syncOneTracking':     return syncOneTracking(b.number, b.sheetRow);
    case 'syncAllTracking':     return syncAllTracking();
    case 'addAndSyncTracking':  return syncOneTracking(b.number, b.sheetRow);
    case 'get17TrackInfo':      return get17TrackInfo(b.number || (p && p.number));
    case 'register17Track':     return register17Track(b.numbers || []);
    case 'debug17TrackRaw':     return debug17TrackRaw(b.number || (p && p.number));
    default: return null;
  }
}
