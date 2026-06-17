// ============================================================
//  Beauty News — Gmail draft import + weekly email
//
//  Archive flow: Claude Cowork → Gmail draft → importBeautyNewsFromGmailDrafts()
//                 → Supabase beauty_news_archives (draft deleted after import)
//
//  Script Properties required:
//    SENDER_EMAIL         — Outlook from address (optional)
//    SUPABASE_PROJECT_URL — e.g. https://xxxx.supabase.co
//    SUPABASE_KEY         — anon or service role key
//
//  Weekly send (once per archive):
//    Run setupWeeklyBeautyNewsEmailTrigger() once in GAS editor → Mon 09:00 KST
//    Recipients: all rows in Supabase email_recipients (same list as UI)
//    Dedup: Script Property BEAUTY_NEWS_LAST_SENT_WINDOWS_START
// ============================================================

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
  var rows = supabaseGet('/rest/v1/email_recipients?select=email&order=email');
  if (!Array.isArray(rows)) return [];
  return rows.map(function(r) { return String(r.email || '').trim(); }).filter(Boolean);
}

function _formatBriefingSubjectDate(iso) {
  if (!iso || iso.length < 10) return '';
  var p = iso.slice(0, 10).split('-');
  if (p.length !== 3) return iso;
  return parseInt(p[1], 10) + '월 ' + parseInt(p[2], 10) + '일';
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
 * Weekly job or manual button: send archive to all UI recipients.
 * @param {boolean} force Skip dedup when true (manual send button)
 * @param {string} windowsStart Optional — send a specific week; default = latest archive
 */
function sendWeeklyBeautyNewsEmail(force, windowsStart) {
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

    var recipients = _fetchRecipientEmailsFromSupabase();
    if (!recipients.length) return { ok: false, error: 'email_recipients가 비어 있습니다' };

    var data = _archiveRowToBriefingData(archive);
    var endIso = archive.windows_end || archive.windows_start;
    var subject = '[MiMuse] 주간 뷰티 뉴스 · ' + _formatBriefingSubjectDate(endIso);
    var htmlBody = buildBriefingHtml(data);
    var result = sendBeautyNewsEmail(recipients, htmlBody, subject);

    if (result.ok) props.setProperty('BEAUTY_NEWS_LAST_SENT_WINDOWS_START', ws);
    return Object.assign({ windowsStart: ws, recipientCount: recipients.length }, result);
  } catch (e) {
    Logger.log('sendWeeklyBeautyNewsEmail: ' + e.toString());
    return { ok: false, error: e.toString() };
  }
}

/** Run once in GAS editor to install Mon 09:00 KST weekly trigger. */
function setupWeeklyBeautyNewsEmailTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sendWeeklyBeautyNewsEmail') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendWeeklyBeautyNewsEmail')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .nearMinute(0)
    .inTimezone('Asia/Seoul')
    .create();
  return { ok: true, schedule: 'Every Monday 09:00 Asia/Seoul', handler: 'sendWeeklyBeautyNewsEmail' };
}

function removeWeeklyBeautyNewsEmailTrigger() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sendWeeklyBeautyNewsEmail') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  return { ok: true, removed: removed };
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
      Logger.log('_saveArchive HTTP ' + result.status + ': ' + (result.text || '').slice(0, 200));
      return;
    }
    Logger.log('_saveArchive: saved ' + data.windowsStart);
  } catch (e) {
    Logger.log('_saveArchive: ' + e.message);
  }
}

// ── Email via Outlook Graph API ───────────────────────────────
function sendBeautyNewsEmail(recipients, htmlBody, subject) {
  try {
    const token       = getOutlookAccessToken();
    const senderEmail = scriptProp('SENDER_EMAIL') || '';
    var sent = 0, errors = [];
    for (var i = 0; i < recipients.length; i++) {
      var addr = recipients[i].trim();
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
    case 'importBeautyNewsGmailDrafts': return importBeautyNewsFromGmailDrafts();
    case 'sendWeeklyBeautyNewsEmail':
      return sendWeeklyBeautyNewsEmail(
        (body || {}).force === true,
        (body || {}).windowsStart || (body || {}).windows_start || '',
      );
    default:                            return null;
  }
}
