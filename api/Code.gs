// ============================================================
//  MiMuse Dashboard — API entry point
//  Data: Supabase (influencers, EMS, monitoring, beauty news)
//  Integrations: Apify, Microsoft Outlook Graph
// ============================================================

// Script Properties helper (shared across feature files)
function scriptProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

// Supabase REST helpers → api/supabase.gs

// Feature routers — each file owns its own routeXxx(action, p, body)
const FEATURE_ROUTERS = [
  routeTcmListup,
  routeOutlook,
  routeMonitoring,
  routeBeautyNews,
  routeEms,
  routeSheets,
  routeConfirmedImport,
];

function _dispatch(action, p, body) {
  for (const route of FEATURE_ROUTERS) {
    const r = route(action, p, body);
    if (r !== null) return r;
  }
  return null;
}

// ── GET dispatcher ────────────────────────────────────────────
function doGet(e) {
  const p      = (e && e.parameter) || {};
  const action = p.action || '';

  let result;
  try {
    result = _dispatch(action, p, null);
    if (result === null && action === 'test') {
      result = { ok: true, sent: sendBeautyNewsEmail(
        _fetchRecipientEmailsFromSupabase(),
        '<p>WebFetch 테스트 이메일입니다. 이게 도착하면 GET 방식 연결 성공!</p>',
        '[테스트] WebFetch 연결 확인'
      ) };
    }
    if (result === null) result = { ok: true, api: 'MiMuse GAS API v1' };
  } catch (err) {
    result = { error: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── POST dispatcher ───────────────────────────────────────────
function doPost(e) {
  let payload;
  try { payload = JSON.parse(e.postData.contents); }
  catch (_) { return ContentService.createTextOutput('ok'); }

  if (!payload.action) {
    return ContentService.createTextOutput('ok');
  }

  let result;
  try {
    result = _dispatch(payload.action, null, payload);
    if (result === null) result = { error: 'Unknown action: ' + payload.action };
  } catch (err) {
    result = { error: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
