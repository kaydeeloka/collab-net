// ============================================================
//  MiMuse Dashboard — Shared constants + API entry point
// ============================================================

// Shared spreadsheet IDs — still used by monitoring.gs and 17-track.gs
const PHASE1_SHEET_ID      = '1xjxGH0sU5pB9WeXevGZBuP-ADvdZHkA2W-jUi727Hm0';
const SHEET_DELIVERY_LIST  = '배송리스트';
const SHEET_DELIVERY_TRACK = '배송추적';
const SHEET_MONITORING     = '모니터링';

function getActiveOutreachId() {
  try {
    const id = PropertiesService.getScriptProperties().getProperty('ACTIVE_OUTREACH_ID');
    return id || PHASE1_SHEET_ID;
  } catch (e) {
    return PHASE1_SHEET_ID;
  }
}

// Feature routers — each file owns its own routeXxx(action, p, body)
const FEATURE_ROUTERS = [
  routeListup,
  routeOutlook,
  routeEms,
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
