// ============================================================
//  17-track.gs — 17track.net API v2.2 integration
//
//  Script Properties required:
//    TRACK17_API_KEY  — 17track API key (Settings → API)
// ============================================================

const TRACK17_BASE = 'https://api.17track.net/track/v2.2';

// Status code → label/color mapping (17track spec)
const TRACK17_STATUS = {
  0:  { label: 'Not Found',     color: '#9e9e9e' },
  10: { label: 'Info Received', color: '#00bcd4' },
  20: { label: 'In Transit',    color: '#1e88e5' },
  25: { label: 'Expired',       color: '#b71c1c' },
  30: { label: 'Pick Up',       color: '#1565c0' },
  35: { label: 'Undelivered',   color: '#e53935' },
  40: { label: 'Delivered',     color: '#43a047' },
  50: { label: 'Exception',     color: '#fb8c00' },
};

function _17trackKey() {
  return PropertiesService.getScriptProperties().getProperty('TRACK17_API_KEY') || '';
}

function _17trackHeaders() {
  return {
    '17token': _17trackKey(),
    'Content-Type': 'application/json',
  };
}

// ── Register tracking numbers (required before querying) ──────
// numbers: string[]  — e.g. ['EG123456789KR', ...]
function register17Track(numbers) {
  var key = _17trackKey();
  if (!key) return { ok: false, error: 'TRACK17_API_KEY가 설정되지 않았습니다.' };
  if (!numbers || numbers.length === 0) return { ok: false, error: '운송장 번호가 없습니다.' };

  var payload = numbers.map(function(n) { return { number: n }; });
  try {
    var res = UrlFetchApp.fetch(TRACK17_BASE + '/register', {
      method: 'post',
      headers: _17trackHeaders(),
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    var data = JSON.parse(res.getContentText());
    return { ok: data.code === 0, accepted: (data.data && data.data.accepted) || [], rejected: (data.data && data.data.rejected) || [] };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// ── Get full tracking detail for one number ───────────────────
function get17TrackInfo(number) {
  if (!number) return { ok: false, error: '운송장 번호가 필요합니다.' };

  var key = _17trackKey();
  if (!key) return { ok: false, error: 'TRACK17_API_KEY가 설정되지 않았습니다.' };

  try {
    var res = UrlFetchApp.fetch(TRACK17_BASE + '/gettrackinfo', {
      method: 'post',
      headers: _17trackHeaders(),
      payload: JSON.stringify([{ number: number }]),
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    if (code !== 200) return { ok: false, error: 'HTTP ' + code };

    var data = JSON.parse(res.getContentText());
    if (data.code !== 0) return { ok: false, error: '17track 오류: ' + data.code };

    var accepted = data.data && data.data.accepted;
    if (!accepted || accepted.length === 0) {
      // Number not registered yet — register then retry once
      register17Track([number]);
      Utilities.sleep(2000);
      var res2 = UrlFetchApp.fetch(TRACK17_BASE + '/gettrackinfo', {
        method: 'post',
        headers: _17trackHeaders(),
        payload: JSON.stringify([{ number: number }]),
        muteHttpExceptions: true,
      });
      var data2 = JSON.parse(res2.getContentText());
      accepted = data2.data && data2.data.accepted;
      if (!accepted || accepted.length === 0) return { ok: false, error: '추적 정보가 없습니다. 잠시 후 다시 시도해 주세요.' };
    }

    var item  = accepted[0];
    var track = item.track || {};
    var z0    = track.z0 || {};   // current status summary
    var w1    = track.w1 || [];   // event history array

    var statusInfo = TRACK17_STATUS[z0.b] || { label: 'In Transit', color: '#1e88e5' };

    var history = w1.map(function(e) {
      var parts = (e.a || '').split(' ');
      return {
        date    : parts[0] || '',
        time    : parts[1] || '',
        status  : e.b || '',
        location: e.c || '',
        remark  : '',
      };
    });

    return {
      ok         : true,
      number     : item.number,
      carrier    : z0.n || '',
      statusLabel: statusInfo.label,
      statusColor: statusInfo.color,
      lastTime   : z0.d || '',
      lastEvent  : z0.e || '',
      history    : history,
    };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function route17Track(action, p, body) {
  var b = body || {};
  switch (action) {
    case 'get17TrackInfo':    return get17TrackInfo(b.number || (p && p.number));
    case 'register17Track':   return register17Track(b.numbers || []);
    default: return null;
  }
}
