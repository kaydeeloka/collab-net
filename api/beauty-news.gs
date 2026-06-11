// ============================================================
//  Beauty News — Webhook Receiver + Email Sender
//
//  Analysis runs externally (Claude AI → Cloudflare → POST here).
//  GAS stores to Supabase and sends email on request.
//
//  Script Properties required:
//    SENDER_EMAIL         — Outlook from address (optional)
//    SUPABASE_PROJECT_URL — e.g. https://xxxx.supabase.co
//    SUPABASE_KEY         — anon or service role key
// ============================================================

function _prop(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

// ── Archive → Supabase ────────────────────────────────────────
function _saveArchive(data) {
  try {
    const url = _prop('SUPABASE_PROJECT_URL');
    const key = _prop('SUPABASE_KEY');
    if (!url || !key) { Logger.log('_saveArchive: SUPABASE_PROJECT_URL or SUPABASE_KEY missing'); return; }

    const res = UrlFetchApp.fetch(url + '/rest/v1/beauty_news_archives?on_conflict=windows_start', {
      method:      'post',
      contentType: 'application/json',
      headers: {
        'apikey':        key,
        'Authorization': 'Bearer ' + key,
        'Prefer':        'resolution=merge-duplicates',
      },
      payload: JSON.stringify({
        windows_start: data.windowsStart || '',
        windows_end:   data.windowsEnd   || '',
        report_title:  data.reportTitle  || '',
        categories:    data.categories   || [],
        keywords:      data.keywords     || [],
      }),
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    if (code < 200 || code >= 300) Logger.log('_saveArchive HTTP ' + code + ': ' + res.getContentText().slice(0, 200));
    else Logger.log('_saveArchive: saved ' + data.windowsStart);
  } catch(e) { Logger.log('_saveArchive: ' + e.message); }
}

// ── Webhook receiver (Cloudflare → Claude AI flow) ────────────
// Expected payload fields:
//   secret, windowsStart (YYYY-MM-DD), windowsEnd (YYYY-MM-DD),
//   reportTitle, categories (array), keywords (array of {tag, explanation})
function receiveWebhookBriefing(body) {
  try {
    if ((body.secret || '') !== 'mimuse-wh-2026') return { ok: false, error: 'invalid secret' };

    const data = {
      windowsStart: body.windowsStart || body.windows_start || '',
      windowsEnd:   body.windowsEnd   || body.windows_end   || '',
      reportTitle:  body.reportTitle  || '',
      categories:   body.categories   || [],
      keywords:     body.keywords     || [],
    };

    _saveArchive(data);

    if (body.autoEmail) {
      const recipients = getRecipients();
      const subject    = body.subject || ('[MiMuse] 주간 뷰티 브리핑 · ' + data.windowsEnd);
      sendBeautyNewsEmail(recipients, body.htmlBody || '', subject);
    }

    return { ok: true, saved: data.windowsStart };
  } catch(e) {
    Logger.log('receiveWebhookBriefing: ' + e.toString());
    return { ok: false, error: e.toString() };
  }
}

// ── Email via Outlook Graph API ───────────────────────────────
function sendBeautyNewsEmail(recipients, htmlBody, subject) {
  try {
    const token       = getOutlookAccessToken();
    const senderEmail = _prop('SENDER_EMAIL') || '';
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

// ── Fallback: read recipients from Script Property ────────────
// Only used when autoEmail:true from webhook. Website reads from Supabase directly.
function getRecipients() {
  var raw = _prop('RECIPIENT_EMAILS') || '';
  return raw.split(',').map(function(e) { return e.trim(); }).filter(Boolean);
}

// ── Route handler ─────────────────────────────────────────────
function routeBeautyNews(action, p, body) {
  switch (action) {
    case 'receiveWebhook':      return receiveWebhookBriefing(body || {});
    case 'sendBeautyNewsEmail': return sendBeautyNewsEmail((body || {}).recipients, (body || {}).htmlBody, (body || {}).subject);
    default:                    return null;
  }
}
