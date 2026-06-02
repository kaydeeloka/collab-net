// ============================================================
//  MiMuse Dashboard — Shared constants + API entry point
// ============================================================

const PHASE1_SHEET_ID      = '1xjxGH0sU5pB9WeXevGZBuP-ADvdZHkA2W-jUi727Hm0'; // 1차 DB

// Monitoring spreadsheet — separate from the outreach DB (populated by influencer_monitor_apify.py)
// Set MONITORING_SHEET_ID in Script Properties (Project Settings → Script Properties)
const MONITORING_SHEET_ID = PropertiesService.getScriptProperties().getProperty('MONITORING_SHEET_ID') || '';

const SHEET_K_BEAUTY       = 'K-뷰티';
const SHEET_GENERAL_BEAUTY = '일반뷰티';
const SHEET_INFLUENCERS = '확정인플루언서';
const SHEET_DELIVERY_LIST  = '배송리스트';
const SHEET_DELIVERY_TRACK = '배송추적';
const SHEET_MONITORING     = '모니터링';

// Standard influencer sheet column indices (0-based)
// Matches LISTUP_HEADERS exactly (16 columns):
// Timestamp | 순위 | Handle | Display Name | Email | Followers | Following |
// Following Ratio (%) | Total Likes | Video Count |
// Engagement Rate (%) | Bio | Profile URL | Outreach | Reply Body | Reply Date
const COL_TIMESTAMP    = 0;
const COL_RANK         = 1;
const COL_HANDLE       = 2;
const COL_DISPLAY_NAME = 3;
const COL_EMAIL        = 4;
const COL_FOLLOWERS    = 5;
const COL_FOLLOWING    = 6;
const COL_FOLLOW_RATIO = 7;
const COL_TOTAL_LIKES  = 8;
const COL_VIDEO_COUNT  = 9;
const COL_ENGAGE_RATE  = 10;
const COL_BIO          = 11;
const COL_PROFILE_URL  = 12;
const COL_OUTREACH     = 13;
const COL_REPLY_BODY   = 14;
const COL_REPLY_DATE   = 15;
const COL_TOTAL        = 16;

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
  routeOutreach,
  routeOutlook,
  routeConfirmed,
  routeEms,
  routePhase,
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
