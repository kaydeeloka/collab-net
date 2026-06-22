// ============================================================
//  Beauty News — Google Sheet import + weekly email
//
//  Archive flow: Claude → Google Sheet → importBeautyNewsFromSheet()
//                 → Supabase beauty_news_archives (latest row only)
//
//  Sheet columns: id | created_at | report_title | windows_start | windows_end | categories | keywords
//  Default sheet ID below; override with Script Property BEAUTY_NEWS_SHEET_ID
//
//  Script Properties required:
//    SENDER_EMAIL         — Outlook from address (optional)
//    SUPABASE_PROJECT_URL — e.g. https://xxxx.supabase.co
//    SUPABASE_KEY         — anon or service role key
//
//  Weekly send (once per archive):
//    Run setupWeeklyBeautyNewsEmailTrigger() once in GAS editor → Mon 09:00 KST
//    Recipients: email_recipients rows where selected=true (UI checkbox ticks)
//    Dedup: Script Property BEAUTY_NEWS_LAST_SENT_WINDOWS_START
// ============================================================

var BEAUTY_NEWS_SHEET_ID_DEFAULT = '1u2FAbqv1-GIJc-59rqccEQt07ok4SXCJx8VpOBz3tL0';

function _fetchLatestArchiveRow() {
  var rows = supabaseGet(
    '/rest/v1/beauty_news_archives'
      + '?select=windows_start,windows_end,report_title,categories,keywords'
      + '&order=windows_end.desc.nullslast,windows_start.desc'
      + '&limit=1',
  );
  return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}

/** All emails in email_recipients — same source as the dashboard list. */
function _fetchRecipientEmailsFromSupabase() {
  return _resolveRecipients(null);
}

/**
 * Resolve send list from Supabase email_recipients.
 * Only rows with selected=true are eligible; explicitRecipients further filters manual sends.
 */
function _resolveRecipients(explicitRecipients) {
  var rows = supabaseGet('/rest/v1/email_recipients?select=email,selected&order=email');
  if (!Array.isArray(rows)) return [];

  var selected = [];
  var allowed = {};
  rows.forEach(function(r) {
    var email = String(r.email || '').trim();
    if (!email) return;
    allowed[email.toLowerCase()] = email;
    if (r.selected === true) selected.push(email);
  });
  if (!selected.length) return [];

  if (!Array.isArray(explicitRecipients) || !explicitRecipients.length) {
    return selected;
  }

  var picked = [];
  var seen = {};
  explicitRecipients.forEach(function(r) {
    var key = String(r || '').trim().toLowerCase();
    if (!key || !allowed[key] || seen[key]) return;
    var addr = allowed[key];
    if (selected.indexOf(addr) === -1) return;
    seen[key] = true;
    picked.push(addr);
  });
  return picked;
}

function _formatBriefingSubjectDate(iso) {
  if (!iso || iso.length < 10) return '';
  var p = iso.slice(0, 10).split('-');
  if (p.length !== 3) return iso;
  return parseInt(p[1], 10) + '월 ' + parseInt(p[2], 10) + '일';
}

function _todayKstIso() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
}

function _archiveRowToBriefingData(row) {
  return {
    windowsStart: row.windows_start || '',
    windowsEnd:   row.windows_end   || '',
    reportTitle:  row.report_title  || '',
    categories:   row.categories    || [],
    keywords:     row.keywords      || [],
  };
}

function _fetchArchiveRowByWindowsStart(windowsStart) {
  if (!windowsStart) return null;
  var rows = supabaseGet(
    '/rest/v1/beauty_news_archives'
      + '?select=windows_start,windows_end,report_title,categories,keywords'
      + '&windows_start=eq.' + encodeURIComponent(windowsStart)
      + '&limit=1',
  );
  return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}

/**
 * Weekly job or manual button: build HTML with buildBriefingHtml (beauty-news-template.gs)
 * and send via Outlook to the provided recipients (or all from Supabase if none provided).
 * @param {boolean} force      Skip dedup when true (manual send button)
 * @param {string}  windowsStart  Send a specific week; default = latest archive
 * @param {string[]} explicitRecipients  Pass from UI when calling manually; falls back to Supabase list
 */
function sendWeeklyBeautyNewsEmail(force, windowsStart, explicitRecipients) {
  try {
    var archive = windowsStart
      ? _fetchArchiveRowByWindowsStart(windowsStart)
      : _fetchLatestArchiveRow();
    if (!archive) return { ok: false, error: '저장된 아카이브가 없습니다' };

    var ws = String(archive.windows_start || '');
    var props = PropertiesService.getScriptProperties();
    if (!force && props.getProperty('BEAUTY_NEWS_LAST_SENT_WINDOWS_START') === ws) {
      return { ok: true, skipped: true, windowsStart: ws, reason: 'already sent for this week' };
    }

    var data    = _archiveRowToBriefingData(archive);
    var subject = '[MiMuse] 이번 주 뷰티 뉴스 · ' + _formatBriefingSubjectDate(_todayKstIso());
    // Always use the GAS template (beauty-news-template.gs → buildBriefingHtml)
    var htmlBody = buildBriefingHtml(data);
    var result   = sendBeautyNewsEmail(explicitRecipients, htmlBody, subject);

    if (result.ok) props.setProperty('BEAUTY_NEWS_LAST_SENT_WINDOWS_START', ws);
    return Object.assign({ windowsStart: ws, recipientCount: result.sent || 0 }, result);
  } catch (e) {
    Logger.log('sendWeeklyBeautyNewsEmail: ' + e.toString());
    return { ok: false, error: e.toString() };
  }
}

/**
 * Run once in GAS editor to install all Monday triggers:
 *   ~08:50 KST — importBeautyNewsFromSheet (1st fetch)
 *   ~08:55 KST — importBeautyNewsFromSheet (retry/update)
 *   ~09:00 KST — sendWeeklyBeautyNewsEmail
 */
function setupAllMondayTriggers() {
  var HANDLERS = ['importBeautyNewsFromSheet', 'sendWeeklyBeautyNewsEmail'];
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (HANDLERS.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });

  // 8:50am — first import
  ScriptApp.newTrigger('importBeautyNewsFromSheet')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8).nearMinute(50).inTimezone('Asia/Seoul').create();

  // 8:55am — second import (ensure latest data)
  ScriptApp.newTrigger('importBeautyNewsFromSheet')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8).nearMinute(55).inTimezone('Asia/Seoul').create();

  // 9:00am — send email
  ScriptApp.newTrigger('sendWeeklyBeautyNewsEmail')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9).nearMinute(0).inTimezone('Asia/Seoul').create();

  return {
    ok: true,
    triggers: [
      'importBeautyNewsFromSheet @ ~08:50 Asia/Seoul (Monday)',
      'importBeautyNewsFromSheet @ ~08:55 Asia/Seoul (Monday)',
      'sendWeeklyBeautyNewsEmail @ ~09:00 Asia/Seoul (Monday)',
    ],
  };
}

/** Legacy alias — kept for backward compatibility */
function setupWeeklyBeautyNewsEmailTrigger() {
  return setupAllMondayTriggers();
}

function removeWeeklyBeautyNewsEmailTrigger() {
  var removed = 0;
  var HANDLERS = ['importBeautyNewsFromSheet', 'sendWeeklyBeautyNewsEmail'];
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (HANDLERS.indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  return { ok: true, removed: removed };
}

/** Inspect installed Monday import/email triggers (dashboard or GAS editor). */
function listBeautyNewsTriggers() {
  var HANDLERS = ['importBeautyNewsFromSheet', 'sendWeeklyBeautyNewsEmail'];
  var triggers = [];
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (HANDLERS.indexOf(t.getHandlerFunction()) === -1) return;
    triggers.push({
      handler: t.getHandlerFunction(),
      eventType: String(t.getEventType()),
      triggerUid: t.getUniqueId(),
    });
  });
  return {
    ok: true,
    count: triggers.length,
    expected: 3,
    triggers: triggers,
    ready: triggers.length >= 3,
  };
}


// ── Archive → Supabase ────────────────────────────────────────
function _saveArchive(data) {
  try {
    var result = supabaseUpsert('beauty_news_archives', {
      windows_start: data.windowsStart || '',
      windows_end:   data.windowsEnd   || '',
      report_title:  data.reportTitle  || '',
      categories:    data.categories   || [],
      keywords:      data.keywords     || [],
    }, 'windows_start');
    if (!result.ok) {
      var err = 'HTTP ' + result.status + ': ' + (result.text || '').slice(0, 200);
      Logger.log('_saveArchive ' + err);
      return { ok: false, error: err };
    }
    Logger.log('_saveArchive: saved ' + data.windowsStart);
    return { ok: true, windowsStart: data.windowsStart };
  } catch (e) {
    Logger.log('_saveArchive: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// ── Google Sheet → Supabase (Claude output) ───────────────────
function _beautyNewsSheetId() {
  return scriptProp('BEAUTY_NEWS_SHEET_ID') || BEAUTY_NEWS_SHEET_ID_DEFAULT;
}

function _normalizeIsoDate(val) {
  if (val === null || val === undefined || val === '') return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, 'Asia/Seoul', 'yyyy-MM-dd');
  }
  var s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return _parseSheetDate(val);
}

function _parseSheetDate(val) {
  if (val === null || val === undefined || val === '') return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, 'Asia/Seoul', 'yyyy-MM-dd');
  }
  if (typeof val === 'number' && val > 30000) {
    var serial = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(serial.getTime())) {
      return Utilities.formatDate(serial, 'Asia/Seoul', 'yyyy-MM-dd');
    }
  }
  var s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, 'Asia/Seoul', 'yyyy-MM-dd');
  }
  return '';
}

function _sheetDateToTime(val) {
  var iso = _parseSheetDate(val);
  if (iso) return new Date(iso + 'T00:00:00').getTime();
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    return val.getTime();
  }
  var parsed = new Date(String(val || ''));
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

/** Prefer date embedded in report_title (e.g. "… 2026년 06월 17일"), then window dates, then created_at. */
function _parseReportTitleDate(title) {
  var t = String(title || '');
  var kor = t.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (kor) {
    return kor[1] + '-' + ('0' + kor[2]).slice(-2) + '-' + ('0' + kor[3]).slice(-2);
  }
  var iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  return '';
}

function _beautyNewsRowSortKey(row) {
  return _parseReportTitleDate(row.report_title)
    || _normalizeIsoDate(row.windows_end)
    || _normalizeIsoDate(row.windows_start)
    || _parseSheetDate(row.created_at)
    || '';
}

function _parseJsonCell(val, label) {
  if (val === null || val === undefined || val === '') return [];
  if (typeof val === 'object') return val;

  var s = String(val).trim().replace(/^\uFEFF/, '');
  if (!s) return [];

  // Strip markdown code fences (Claude sometimes wraps JSON in ```json ... ```)
  var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();

  function tryParse(raw) {
    return JSON.parse(raw);
  }

  try {
    return tryParse(s);
  } catch (e1) {
    // Trailing junk after valid JSON (e.g. "true extra" or "[...] more text")
    var arrStart = s.indexOf('[');
    var arrEnd   = s.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
      try { return tryParse(s.slice(arrStart, arrEnd + 1)); } catch (e2) {}
    }
    var objStart = s.indexOf('{');
    var objEnd   = s.lastIndexOf('}');
    if (objStart !== -1 && objEnd > objStart) {
      try {
        var parsed = tryParse(s.slice(objStart, objEnd + 1));
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e3) {}
    }

    var preview = s.length > 120 ? s.slice(0, 120) + '…' : s;
    throw new Error((label || 'JSON') + ' parse error: ' + e1.message + ' — cell preview: ' + preview);
  }
}

function _readBeautyNewsSheetRows() {
  var ss = SpreadsheetApp.openById(_beautyNewsSheetId());
  var sheet = ss.getSheets()[0];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  function col(name) { return headers.indexOf(name); }

  var idx = {
    id:            col('id'),
    created_at:    col('created_at'),
    report_title:  col('report_title'),
    windows_start: col('windows_start'),
    windows_end:   col('windows_end'),
    categories:    col('categories'),
    keywords:      col('keywords'),
  };
  if (idx.windows_start === -1) {
    throw new Error('Sheet header missing windows_start (expected: id, created_at, report_title, windows_start, windows_end, categories, keywords)');
  }

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var line = values[r];
    function cell(i) { return i === -1 ? '' : line[i]; }

    var reportTitle = String(cell(idx.report_title) || '').trim();
    var windowsStart = _normalizeIsoDate(cell(idx.windows_start));
    if (!windowsStart && !reportTitle) continue;

    var windowsEnd = _normalizeIsoDate(cell(idx.windows_end)) || windowsStart;
    rows.push({
      id:           String(cell(idx.id) || '').trim(),
      created_at:   cell(idx.created_at),
      report_title: reportTitle,
      windows_start: windowsStart,
      windows_end:   windowsEnd,
      categories:   _parseJsonCell(cell(idx.categories), 'categories'),
      keywords:     _parseJsonCell(cell(idx.keywords), 'keywords'),
    });
  }
  return rows;
}

function _pickLatestBeautyNewsSheetRow(rows) {
  var best = null;
  var bestKey = '';
  var bestCreated = 0;

  rows.forEach(function(row) {
    var key = _beautyNewsRowSortKey(row);
    if (!key) return;
    var createdTs = _sheetDateToTime(row.created_at);
    if (!best || key > bestKey || (key === bestKey && createdTs > bestCreated)) {
      best = row;
      bestKey = key;
      bestCreated = createdTs;
    }
  });
  return best ? { row: best, sortKey: bestKey } : null;
}

/**
 * Reads the latest row from the beauty news Google Sheet and upserts to Supabase.
 * Latest = report_title date first, else windows_end/start, else created_at; tie-break by created_at.
 */
function importBeautyNewsFromSheet() {
  try {
    var rows = _readBeautyNewsSheetRows();
    if (!rows.length) return { ok: false, error: '시트에 데이터 행이 없습니다' };

    var picked = _pickLatestBeautyNewsSheetRow(rows);
    if (!picked) return { ok: false, error: '유효한 아카이브 행을 찾지 못했습니다' };

    var latest = picked.row;
    if (!latest.windows_start) {
      return { ok: false, error: '최신 행에 windows_start가 없습니다', reportTitle: latest.report_title };
    }

    var data = {
      windowsStart: latest.windows_start,
      windowsEnd:   latest.windows_end || latest.windows_start,
      reportTitle:  latest.report_title,
      categories:   latest.categories || [],
      keywords:     latest.keywords || [],
    };

    var saved = _saveArchive(data);
    if (!saved.ok) {
      return {
        ok: false,
        error: saved.error || 'Supabase 저장 실패',
        windowsStart: data.windowsStart,
        reportTitle: data.reportTitle,
      };
    }

    return {
      ok: true,
      imported: 1,
      windowsStarts: [data.windowsStart],
      reportTitle: data.reportTitle,
      sortKey: picked.sortKey,
      sheetRowId: latest.id,
      createdAt: _parseSheetDate(latest.created_at),
    };
  } catch (e) {
    Logger.log('importBeautyNewsFromSheet: ' + e.toString());
    return { ok: false, error: e.toString() };
  }
}

// ── Email via Outlook Graph API ───────────────────────────────
function sendBeautyNewsEmail(recipients, htmlBody, subject) {
  try {
    var resolved = _resolveRecipients(recipients);
    if (!resolved.length) return { ok: false, error: '수신자가 없습니다' };

    const token       = getOutlookAccessToken();
    const senderEmail = scriptProp('SENDER_EMAIL') || '';
    var sent = 0, errors = [];
    for (var i = 0; i < resolved.length; i++) {
      var addr = resolved[i].trim();
      if (!addr) continue;
      var payload = {
        message: {
          subject: subject || '주간 뷰티 브리핑',
          body: { contentType: 'HTML', content: htmlBody || '' },
          toRecipients: [{ emailAddress: { address: addr } }],
        },
        saveToSentItems: true,
      };
      if (senderEmail) payload.message.from = { emailAddress: { address: senderEmail } };
      var res = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'post', contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token },
        payload: JSON.stringify(payload), muteHttpExceptions: true,
      });
      var code = res.getResponseCode();
      if (code === 202 || code === 200) sent++;
      else {
        var err = JSON.parse(res.getContentText() || '{}');
        errors.push(addr + ': ' + ((err.error && err.error.message) || 'HTTP ' + code));
      }
    }
    if (errors.length) return { ok: false, error: errors.join('; '), sent: sent };
    return { ok: true, sent: sent };
  } catch(e) { return { ok: false, error: e.toString() }; }
}

// ── Gmail draft → Supabase (Claude Cowork output) ─────────────
// Cowork creates a Gmail draft with subject "[MiMuse Archive] …" and JSON between:
//   MIMUSE_ARCHIVE_JSON … END_MIMUSE_ARCHIVE_JSON
// Run importBeautyNewsFromGmailDrafts() manually, on a time trigger, or via dashboard button.
var GMAIL_ARCHIVE_SUBJECT_PREFIX = '[MiMuse Archive]';
var GMAIL_ARCHIVE_JSON_START     = 'MIMUSE_ARCHIVE_JSON';
var GMAIL_ARCHIVE_JSON_END       = 'END_MIMUSE_ARCHIVE_JSON';

function _extractArchiveJsonFromText(text) {
  var body = String(text || '');
  var s = body.indexOf(GMAIL_ARCHIVE_JSON_START);
  var e = body.indexOf(GMAIL_ARCHIVE_JSON_END);
  if (s !== -1 && e !== -1 && e > s) {
    return body.slice(s + GMAIL_ARCHIVE_JSON_START.length, e).trim();
  }
  var start = body.indexOf('{');
  var end   = body.lastIndexOf('}');
  if (start !== -1 && end > start) return body.slice(start, end + 1);
  return '';
}

function _parseArchivePayload(raw) {
  var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return {
    windowsStart: parsed.windows_start || parsed.windowsStart || '',
    windowsEnd:   parsed.windows_end   || parsed.windowsEnd   || '',
    reportTitle:  parsed.report_title  || parsed.reportTitle  || '',
    categories:   parsed.categories   || [],
    keywords:     parsed.keywords     || [],
  };
}

function importBeautyNewsFromGmailDrafts() {
  var drafts = GmailApp.getDrafts();
  var imported = 0;
  var errors = [];
  var ids = [];

  drafts.forEach(function(draft) {
    try {
      var msg = draft.getMessage();
      var subj = msg.getSubject() || '';
      if (subj.indexOf(GMAIL_ARCHIVE_SUBJECT_PREFIX) !== 0) return;

      var plain = msg.getPlainBody() || '';
      var jsonStr = _extractArchiveJsonFromText(plain);
      if (!jsonStr) jsonStr = _extractArchiveJsonFromText(msg.getBody());
      if (!jsonStr) throw new Error('JSON block not found');

      var data = _parseArchivePayload(jsonStr);
      if (!data.windowsStart) throw new Error('windows_start missing');

      _saveArchive(data);
      draft.deleteDraft();
      imported++;
      ids.push(data.windowsStart);
    } catch (err) {
      errors.push(((draft.getMessage().getSubject()) || 'draft') + ': ' + err.message);
    }
  });

  return { ok: errors.length === 0 || imported > 0, imported: imported, windowsStarts: ids, errors: errors };
}

// ── Route handler ─────────────────────────────────────────────
function routeBeautyNews(action, p, body) {
  switch (action) {
    case 'sendBeautyNewsEmail':         return sendBeautyNewsEmail((body || {}).recipients, (body || {}).htmlBody, (body || {}).subject);
    case 'importBeautyNewsFromSheet':   return importBeautyNewsFromSheet();
    case 'importBeautyNewsGmailDrafts': return importBeautyNewsFromGmailDrafts();
    case 'sendWeeklyBeautyNewsEmail':
      return sendWeeklyBeautyNewsEmail(
        (body || {}).force === true,
        (body || {}).windowsStart || (body || {}).windows_start || '',
        (body || {}).recipients || null,
      );
    case 'setupBeautyNewsMondayTriggers': return setupAllMondayTriggers();
    case 'listBeautyNewsTriggers':        return listBeautyNewsTriggers();
    case 'removeBeautyNewsMondayTriggers': return removeWeeklyBeautyNewsEmailTrigger();
    default:                            return null;
  }
}
