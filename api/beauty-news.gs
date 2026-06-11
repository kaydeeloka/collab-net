// ============================================================
//  Beauty News — Webhook Receiver + Email Sender
//
//  Analysis is now run externally (Claude AI → Cloudflare worker
//  → POST /receiveWebhook here). GAS only stores + sends email.
//
//  Script Properties required:
//    ANTHROPIC_API_KEY    — (not used here, kept for reference)
//    RECIPIENT_EMAILS     — comma-separated addresses
//    SENDER_EMAIL         — Outlook from address (optional)
//    SUPABASE_PROJECT_URL — e.g. https://xxxx.supabase.co
//    SUPABASE_KEY         — service role key (for inserts from GAS)
// ============================================================

// ── Script Properties helper ──────────────────────────────────
function _prop(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

// ── Archive date key (yyyyMMdd from any date string) ──────────
function _archDateKey(dateStr) {
  return String(dateStr).replace(/[^0-9]/g, '');
}

// ── Archive → Supabase ────────────────────────────────────────
function _saveArchive(data) {
  try {
    const url = _prop('SUPABASE_PROJECT_URL');
    const key = _prop('SUPABASE_KEY');
    if (!url || !key) { Logger.log('_saveArchive: SUPABASE_PROJECT_URL or SUPABASE_KEY missing'); return; }

    const res = UrlFetchApp.fetch(url + '/rest/v1/beauty_news_archives', {
      method:      'post',
      contentType: 'application/json',
      headers: {
        'apikey':        key,
        'Authorization': 'Bearer ' + key,
        'Prefer':        'resolution=merge-duplicates',
      },
      payload: JSON.stringify({
        date_key:     _archDateKey(data.date),
        date:         data.date         || '',
        date_range:   data.dateRange    || data.date || '',
        report_title: data.reportTitle  || '',
        categories:   data.categories   || [],
        keywords:     data.keywords     || '',
        html_body:    data.htmlBody     || '',
      }),
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    if (code < 200 || code >= 300) Logger.log('_saveArchive HTTP ' + code + ': ' + res.getContentText().slice(0, 200));
    else Logger.log('_saveArchive: saved ' + _archDateKey(data.date));
  } catch(e) { Logger.log('_saveArchive: ' + e.message); }
}

// ── Webhook receiver (called by Cloudflare → Claude AI flow) ──
function receiveWebhookBriefing(body) {
  try {
    if ((body.secret || '') !== 'mimuse-wh-2026') return { ok: false, error: 'invalid secret' };

    const data = {
      date:        body.date        || '',
      dateRange:   body.dateRange   || body.date || '',
      reportTitle: body.reportTitle || ('이번 주 뷰티 브리핑 — ' + (body.date || '')),
      htmlBody:    body.htmlBody    || '',
      categories:  body.categories  || [],
      keywords:    body.keywords    || '',
    };

    _saveArchive(data);

    if (body.autoEmail) {
      const recipients = getRecipients();
      const subject    = body.subject || ('[MiMuse] 주간 뷰티 브리핑 · ' + data.date);
      sendBeautyNewsEmail(recipients, data.htmlBody, subject);
    }

    return { ok: true, saved: _archDateKey(data.date) };
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
      var res  = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'post', contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token },
        payload: JSON.stringify(payload), muteHttpExceptions: true,
      });
      var code = res.getResponseCode();
      if (code === 202 || code === 200) {
        sent++;
      } else {
        var err = JSON.parse(res.getContentText() || '{}');
        errors.push(addr + ': ' + ((err.error && err.error.message) || 'HTTP ' + code));
      }
    }
    if (errors.length) return { ok: false, error: errors.join('; '), sent: sent };
    return { ok: true, sent: sent };
  } catch(e) { return { ok: false, error: e.toString() }; }
}

// ── Recipient list ────────────────────────────────────────────
function getRecipients() {
  var raw = _prop('RECIPIENT_EMAILS') || 'kaydee@cranecomm.com,nexanetraventures@gmail.com';
  return raw.split(',').map(function(e) { return e.trim(); }).filter(Boolean);
}

// ── Route handler — called by Code.gs dispatcher ──────────────
function routeBeautyNews(action, p, body) {
  switch (action) {
    case 'receiveWebhook':      return receiveWebhookBriefing(body || {});
    case 'getRecipients':       return getRecipients();
    case 'sendBeautyNewsEmail': return sendBeautyNewsEmail((body || {}).recipients, (body || {}).htmlBody, (body || {}).subject);
    default:                    return null;
  }
}
