// ============================================================
//  MiMuse Dashboard — API entry point
//  Data: Supabase (influencers, EMS, monitoring, beauty news)
//  Integrations: Apify, Microsoft Outlook Graph
// ============================================================

// Feature routers — each file owns its own routeXxx(action, p, body)
const FEATURE_ROUTERS = [
  routeTcmListup,
  routeOutlook,
  routeMonitoring,
  routeTrend,
  routeBeautyNews,
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
