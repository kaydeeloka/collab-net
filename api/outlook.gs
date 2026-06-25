// ============================================================
//  Microsoft Graph API — Outlook Mail Integration
//  Outreach email send + reply sync (Supabase status in dashboard)
//
//  ONE-TIME SETUP (Azure Portal → portal.azure.com):
//  1. App registrations → New registration
//     - Name: MiMuse Outreach
//     - Supported account types: "Accounts in this organizational directory only"
//     - Redirect URI: Web → https://login.microsoftonline.com/common/oauth2/nativeclient
//  2. API permissions → Add → Microsoft Graph → Delegated:
//     - Mail.Send, Mail.Read, offline_access
//     → Grant admin consent
//  3. Certificates & secrets → New client secret → copy the Value
//  4. Overview → copy Application (client) ID and Directory (tenant) ID
//
//  GAS Script Properties (Project Settings → Script Properties):
//    OUTLOOK_CLIENT_ID     = <Application (client) ID>
//    OUTLOOK_CLIENT_SECRET = <Client secret Value>
//    OUTLOOK_TENANT_ID     = <Directory (tenant) ID>
//
//  AUTHORIZE (run once in GAS editor):
//  1. Run getOutlookAuthUrl() → copy the URL from Logs
//  2. Open URL in browser → sign in → after redirect, copy the "code=" value from the URL
//  3. Run: authorizeOutlook("paste-code-here")
//  4. Done — tokens are stored automatically and refresh themselves.
// ============================================================

const GRAPH_BASE        = 'https://graph.microsoft.com/v1.0';
const GRAPH_SEND_URL    = GRAPH_BASE + '/me/sendMail';
const GRAPH_MESSAGES_URL = GRAPH_BASE + '/me/messages';

function _outlookCreds() {
  const p = PropertiesService.getScriptProperties();
  return {
    clientId    : p.getProperty('OUTLOOK_CLIENT_ID')     || '',
    clientSecret: p.getProperty('OUTLOOK_CLIENT_SECRET') || '',
    tenantId    : p.getProperty('OUTLOOK_TENANT_ID')     || '',
    accessToken : p.getProperty('OUTLOOK_ACCESS_TOKEN')  || '',
    refreshToken: p.getProperty('OUTLOOK_REFRESH_TOKEN') || '',
    tokenExpiry : parseInt(p.getProperty('OUTLOOK_TOKEN_EXPIRY') || '0'),
  };
}

// Returns a valid access token — auto-refreshes when expired
function getOutlookAccessToken() {
  const c = _outlookCreds();
  if (!c.clientId || !c.tenantId) {
    throw new Error('Outlook 자격증명이 설정되지 않았습니다. Script Properties에 OUTLOOK_CLIENT_ID, OUTLOOK_TENANT_ID를 추가하세요.');
  }

  const now = Math.floor(Date.now() / 1000);

  // Token still valid (5-min buffer)
  if (c.accessToken && c.tokenExpiry > now + 300) return c.accessToken;

  // Need to refresh
  if (!c.refreshToken) {
    throw new Error('Outlook 미인증 상태입니다. GAS 편집기에서 getOutlookAuthUrl()을 실행하여 인증을 완료하세요.');
  }

  const tokenUrl = 'https://login.microsoftonline.com/' + c.tenantId + '/oauth2/v2.0/token';
  const res = UrlFetchApp.fetch(tokenUrl, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type   : 'refresh_token',
      client_id    : c.clientId,
      refresh_token: c.refreshToken,
      scope        : 'Mail.Send Mail.Read offline_access',
    },
    muteHttpExceptions: true,
  });

  const data = JSON.parse(res.getContentText());
  if (data.error) throw new Error('토큰 갱신 실패: ' + (data.error_description || data.error));

  const p = PropertiesService.getScriptProperties();
  p.setProperty('OUTLOOK_ACCESS_TOKEN', data.access_token);
  p.setProperty('OUTLOOK_TOKEN_EXPIRY', String(now + (data.expires_in || 3600)));
  if (data.refresh_token) p.setProperty('OUTLOOK_REFRESH_TOKEN', data.refresh_token);

  return data.access_token;
}

// ── Step 1: Generate authorization URL ───────────────────────
function getOutlookAuthUrl() {
  const c = _outlookCreds();
  if (!c.clientId || !c.tenantId) {
    Logger.log('ERROR: Script Properties에 OUTLOOK_CLIENT_ID와 OUTLOOK_TENANT_ID를 먼저 설정하세요.');
    return null;
  }
  const url = 'https://login.microsoftonline.com/' + c.tenantId + '/oauth2/v2.0/authorize'
    + '?client_id='      + encodeURIComponent(c.clientId)
    + '&response_type=code'
    + '&redirect_uri='   + encodeURIComponent('https://login.microsoftonline.com/common/oauth2/nativeclient')
    + '&scope='          + encodeURIComponent('Mail.Send Mail.Read offline_access')
    + '&response_mode=query'
    + '&prompt=select_account';
  Logger.log('아래 URL을 브라우저에서 열고 로그인 후, 주소창의 code= 값을 복사하세요:\n\n' + url);
  return url;
}

// ── Step 2: Exchange auth code for tokens ────────────────────
function authorizeOutlook(authCode) {
  const c = _outlookCreds();
  const tokenUrl = 'https://login.microsoftonline.com/' + c.tenantId + '/oauth2/v2.0/token';
  const res = UrlFetchApp.fetch(tokenUrl, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type   : 'authorization_code',
      client_id    : c.clientId,
      code         : authCode,
      redirect_uri : 'https://login.microsoftonline.com/common/oauth2/nativeclient',
      scope        : 'Mail.Send Mail.Read offline_access',
    },
    muteHttpExceptions: true,
  });

  const data = JSON.parse(res.getContentText());
  if (data.error) {
    Logger.log('인증 실패: ' + (data.error_description || data.error));
    return { ok: false, error: data.error_description || data.error };
  }

  const p = PropertiesService.getScriptProperties();
  const now = Math.floor(Date.now() / 1000);
  p.setProperty('OUTLOOK_ACCESS_TOKEN',  data.access_token);
  p.setProperty('OUTLOOK_REFRESH_TOKEN', data.refresh_token);
  p.setProperty('OUTLOOK_TOKEN_EXPIRY',  String(now + (data.expires_in || 3600)));

  Logger.log('Outlook 인증 완료! 토큰이 저장되었습니다.');
  return { ok: true, message: 'Outlook 인증이 완료되었습니다.' };
}

// Check if Outlook is connected
function checkOutlookAuth() {
  const c = _outlookCreds();
  const configured = !!(c.clientId && c.clientSecret && c.tenantId);
  const authorized = !!c.refreshToken;
  return { ok: true, configured, authorized };
}

// ── Outreach body → HTML (markdown links + optional signature) ─
var OUTREACH_SIGNATURE_PROP = 'OUTREACH_EMAIL_SIGNATURE';
var OUTREACH_SIGNATURE_MAX_CHARS = 2500;
var GMAIL_SAFE_MAX_BYTES = 92 * 1024;
var OUTREACH_BODY_MAX_BYTES = 75000;
var _MD_LINK_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
var _MD_BOLD_RE = /\*\*([^*\n]+)\*\*/g;

function _nextInlineMatch(text) {
  _MD_LINK_RE.lastIndex = 0;
  _MD_BOLD_RE.lastIndex = 0;
  var linkMatch = _MD_LINK_RE.exec(text);
  var boldMatch = _MD_BOLD_RE.exec(text);
  var best = null;
  if (linkMatch && linkMatch.index !== undefined) {
    best = { index: linkMatch.index, kind: 'link', match: linkMatch };
  }
  if (boldMatch && boldMatch.index !== undefined) {
    if (!best || boldMatch.index < best.index) {
      best = { index: boldMatch.index, kind: 'bold', match: boldMatch };
    }
  }
  return best;
}

function _inlineMarkdownToHtml(text) {
  var parts = [];
  var remaining = String(text || '');
  while (remaining.length > 0) {
    var found = _nextInlineMatch(remaining);
    if (!found) {
      parts.push(_escapeHtml(remaining).replace(/\n/g, '<br>'));
      break;
    }
    if (found.index > 0) {
      parts.push(_escapeHtml(remaining.slice(0, found.index)).replace(/\n/g, '<br>'));
    }
    if (found.kind === 'link') {
      parts.push(
        '<a href="' + _escapeHtml(found.match[2]) + '" style="color:#2563eb;text-decoration:underline;">'
        + _inlineMarkdownToHtml(found.match[1]) + '</a>'
      );
    } else {
      parts.push('<b>' + _inlineMarkdownToHtml(found.match[1]) + '</b>');
    }
    remaining = remaining.slice(found.index + found.match[0].length);
  }
  return parts.join('');
}

function _htmlByteSize(html) {
  return Utilities.newBlob(String(html || ''), 'text/html', 'email.html').getBytes().length;
}

function _stripAllEmailBloat(html) {
  var s = String(html || '');
  s = s.replace(/<img\b[^>]*\bsrc\s*=\s*["']data:[^"']*["'][^>]*>/gi, '');
  s = s.replace(/<img\b[^>]*\bsrc\s*=\s*data:[^ >]+[^>]*>/gi, '');
  s = s.replace(/\b(?:href|src)\s*=\s*["']cid:[^"']*["']/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<\?xml[\s\S]*?\?>/gi, '');
  s = s.replace(/<!\[if[\s\S]*?endif\]>/gi, '');
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<\/?(o|v|w|m|st1):[^>]*>/gi, '');
  s = s.replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, '');
  return s.trim();
}

/** Gmail clips HTML over ~102KB. Logo uses external HTTPS URL (not inline attachment). */
function _ensureGmailSafeOutreachHtml(html) {
  var s = _stripAllEmailBloat(html);
  if (_htmlByteSize(s) <= GMAIL_SAFE_MAX_BYTES) return s;

  s = s.replace(/<img\b[^>]*>/gi, '');
  s = _stripAllEmailBloat(s);
  if (_htmlByteSize(s) <= GMAIL_SAFE_MAX_BYTES) return s;

  var bodyOnly = s
    .replace(/^<div[^>]*>/i, '')
    .replace(/<\/div>\s*$/i, '')
    .replace(/<img\b[^>]*alt\s*=\s*["']Crane Communications["'][\s\S]*$/i, '')
    .replace(/<table[\s\S]*$/i, '')
    .replace(/<br>\s*$/i, '');
  return _stripAllEmailBloat(
    '<div style="font-family:Malgun Gothic,sans-serif;font-size:14px;line-height:1.7;color:#222;">'
    + bodyOnly + '<br><br>' + textOnlyOutreachSignatureHtml() + '</div>'
  );
}

function _escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _sanitizeSignatureHtml(html) {
  var s = String(html || '');
  if (!s) return '';
  // Outlook / Word bloat
  s = s.replace(/<\?xml[\s\S]*?\?>/gi, '');
  s = s.replace(/<!\[if[\s\S]*?endif\]>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<meta\b[^>]*>/gi, '');
  s = s.replace(/<link\b[^>]*>/gi, '');
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<\/?(o|v|w|m|st1):[^>]*>/gi, '');
  // Base64 images → Gmail 102KB clip
  s = s.replace(/<img\b[^>]*\bsrc\s*=\s*["']data:[^"']*["'][^>]*>/gi, '');
  s = s.replace(/<img\b[^>]*\bsrc\s*=\s*data:[^ >]+[^>]*>/gi, '');
  // Gmail treats these as quoted / trimmed blocks
  s = s.replace(/\sclass\s*=\s*["'][^"']*gmail[^"']*["']/gi, '');
  s = s.replace(/\sid\s*=\s*["'](?:signature|appendonsend|divRplyFwdMsg)[^"']*["']/gi, '');
  s = s.replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, '');
  s = s.replace(/<hr\b[^>]*>/gi, '');
  // Strip verbose MSO inline styles (keep tag, drop style)
  s = s.replace(/\sstyle\s*=\s*["'][^"']{120,}["']/gi, '');
  s = s.replace(/\s(mso-|xmlns)[^=>\s]*(?:=\s*["'][^"']*["'])?/gi, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  if (s.length > OUTREACH_SIGNATURE_MAX_CHARS) return '';
  return s;
}

function _isLegacyOutreachSignature(html) {
  if (!html || html.length > OUTREACH_SIGNATURE_MAX_CHARS) return true;
  return html.indexOf('logo-light.png') !== -1
    || html.indexOf('data:image') !== -1
    || html.indexOf('<style') !== -1;
}

/** Always build fresh compact signature (logo URL + text). Never use bloated saved HTML. */
function _getOutreachSignatureHtml(uniqueKey) {
  return defaultOutreachSignatureHtml(uniqueKey);
}

function _stripEmailHtmlBloat(html) {
  return _stripAllEmailBloat(html);
}

function setOutreachSignatureLogoUrl(body) {
  var url = String((body || {}).url || '').trim();
  if (!url) return { ok: false, error: 'logo URL이 없습니다' };
  PropertiesService.getScriptProperties().setProperty('OUTREACH_SIGNATURE_LOGO_URL', url);
  return { ok: true, url: url };
}

function _sanitizeOutreachHtml(html) {
  var s = String(html || '');
  if (!s) return '';
  return s.replace(/<!--[\s\S]*?-->/g, '').trim();
}

/** Plain template text → minimal HTML: escaped text, newlines as <br>, links and **bold**. */
function _formatOutreachBodyPlain(plainBody) {
  return _inlineMarkdownToHtml(String(plainBody || ''));
}

function _outreachUniqueKey(email) {
  return String(email || 'outreach') + '-' + Utilities.getUuid();
}

/** Body = plain text (+ link tags). Signature = HTML table with logo. */
function _assembleOutreachHtml(bodyPlainHtml, signatureHtml) {
  var sig = signatureHtml || '';
  var html = '<div style="font-family:Malgun Gothic,sans-serif;font-size:14px;line-height:1.7;color:#222;">'
    + String(bodyPlainHtml || '')
    + (sig ? '<br>' + sig : '')
    + '</div>';
  return _ensureGmailSafeOutreachHtml(html);
}

function _buildOutreachHtmlBody(plainBody, email) {
  var uniqueKey = _outreachUniqueKey(email);
  return _assembleOutreachHtml(
    _formatOutreachBodyPlain(plainBody),
    _getOutreachSignatureHtml(uniqueKey)
  );
}

function _mergeHtmlBodyWithSignature(htmlBody, email) {
  var bodyPart = String(htmlBody || '')
    .replace(/^<div[^>]*>/i, '')
    .replace(/<\/div>\s*$/i, '');
  return _assembleOutreachHtml(bodyPart, _getOutreachSignatureHtml(_outreachUniqueKey(email)));
}

function getEmailSignature() {
  return { ok: true, signature: defaultOutreachSignatureHtml(), isDefault: true };
}

function saveEmailSignature(body) {
  var html = _sanitizeSignatureHtml(String((body || {}).signature || (body || {}).html || '').trim());
  if (_isLegacyOutreachSignature(html)) html = defaultOutreachSignatureHtml();
  PropertiesService.getScriptProperties().deleteProperty(OUTREACH_SIGNATURE_PROP);
  return { ok: true, signature: defaultOutreachSignatureHtml() };
}

function resetEmailSignatureToDefault() {
  var p = PropertiesService.getScriptProperties();
  p.deleteProperty(OUTREACH_SIGNATURE_PROP);
  var html = defaultOutreachSignatureHtml();
  return { ok: true, signature: html };
}

// ── Send email via Graph API ─────────────────────────────────
function sendOutlookEmail(body) {
  const email = (body.email || body.to || '').trim();
  if (!email || !body.subject) return { ok: false, error: '이메일 주소 또는 제목이 없습니다.' };
  try {
    const token = getOutlookAccessToken();
    const htmlBody = body.htmlBody
      ? _mergeHtmlBodyWithSignature(body.htmlBody, email)
      : _buildOutreachHtmlBody(body.body || '', email);
    const payload = {
      message: {
        subject: body.subject,
        body: { contentType: 'HTML', content: htmlBody },
        toRecipients: [{ emailAddress: { address: email } }],
      },
      saveToSentItems: true,
    };

    const res = UrlFetchApp.fetch(GRAPH_SEND_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = res.getResponseCode();
    if (code !== 202 && code !== 200) {
      const err = JSON.parse(res.getContentText() || '{}');
      return { ok: false, error: (err.error && err.error.message) || ('HTTP ' + code) };
    }

    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return { ok: true, date: today };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// ── Sync replies from Outlook inbox ─────────────────────────
function _toMs(v) {
  if (!v) return NaN;
  var t = new Date(v).getTime();
  return isNaN(t) ? NaN : t;
}

// Latest inbound message per email — inbox filter, client-side sort (Graph rejects filter+orderby).
function _fetchLatestFromSender(token, email) {
  const safeEmail = (email || '').trim().replace(/'/g, "''");
  if (!safeEmail) return null;

  function _parseLatest(data) {
    const msgs = (data.value || []).slice();
    if (!msgs.length) return null;
    msgs.sort(function(a, b) {
      return _toMs(b.receivedDateTime) - _toMs(a.receivedDateTime);
    });
    return msgs[0];
  }

  function _entryFromMsg(msg) {
    if (!msg) return null;
    const received = msg.receivedDateTime || '';
    const rawBody = ((msg.body || {}).content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return {
      messageId: msg.id || '',
      body: rawBody.substring(0, 1000),
      date: received ? received.split('T')[0] : '',
      receivedAt: received,
      isRead: !!msg.isRead,
    };
  }

  const select = '&$select=id,from,receivedDateTime,body,isRead';
  const headers = { 'Authorization': 'Bearer ' + token };

  // 1) Inbox + from filter (no $orderby — unsupported with this filter on many tenants)
  var inboxUrl = GRAPH_BASE + '/me/mailFolders/inbox/messages'
    + '?$filter=' + encodeURIComponent("from/emailAddress/address eq '" + safeEmail + "'")
    + select
    + '&$top=50';
  var res = UrlFetchApp.fetch(inboxUrl, { headers: headers, muteHttpExceptions: true });
  if (res.getResponseCode() === 200) {
    var entry = _entryFromMsg(_parseLatest(JSON.parse(res.getContentText())));
    if (entry) return entry;
  }

  // 2) $search fallback (case-insensitive; needs ConsistencyLevel)
  var searchUrl = GRAPH_BASE + '/me/messages?$search=' + encodeURIComponent('"from:' + safeEmail + '"')
    + select
    + '&$top=50';
  res = UrlFetchApp.fetch(searchUrl, {
    headers: Object.assign({}, headers, { 'ConsistencyLevel': 'eventual' }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() === 200) {
    return _entryFromMsg(_parseLatest(JSON.parse(res.getContentText())));
  }

  return null;
}

// Earliest outbound message per recipient (To / CC / BCC) — sent items, client-side sort.
function _normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function _msgHasRecipient(msg, email) {
  var key = _normalizeEmail(email);
  if (!key || !msg) return false;
  var lists = [msg.toRecipients, msg.ccRecipients, msg.bccRecipients];
  for (var i = 0; i < lists.length; i++) {
    var recips = lists[i] || [];
    for (var j = 0; j < recips.length; j++) {
      var addr = _normalizeEmail(((recips[j] || {}).emailAddress || {}).address);
      if (addr === key) return true;
    }
  }
  return false;
}

function _earlierSendEntry(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return _toMs(a.sentAt) <= _toMs(b.sentAt) ? a : b;
}

function _fetchEarliestSentTo(token, email, since) {
  const safeEmail = (email || '').trim().replace(/'/g, "''");
  const lookupEmail = _normalizeEmail(email);
  if (!safeEmail || !lookupEmail) return null;

  function _pickEarliestAfterSince(msgs) {
    var list = (msgs || []).slice();
    if (!list.length) return null;
    var sinceMs = _toMs(since);
    if (!isNaN(sinceMs)) {
      list = list.filter(function(msg) {
        var sentMs = _toMs(msg.sentDateTime);
        return !isNaN(sentMs) && sentMs >= sinceMs - 2000;
      });
      if (!list.length) return null;
    }
    list.sort(function(a, b) {
      return _toMs(a.sentDateTime) - _toMs(b.sentDateTime);
    });
    return list[0];
  }

  function _entryFromMsg(msg) {
    if (!msg) return null;
    const sent = msg.sentDateTime || '';
    return {
      messageId: msg.id || '',
      subject: msg.subject || '',
      date: sent ? sent.split('T')[0] : '',
      sentAt: sent,
    };
  }

  function _tryFromMessages(msgs) {
    return _entryFromMsg(_pickEarliestAfterSince(msgs));
  }

  const select = '&$select=id,sentDateTime,subject,toRecipients,ccRecipients,bccRecipients';
  const headers = { 'Authorization': 'Bearer ' + token };

  function _fetchByFilter(filterExpr) {
    var url = GRAPH_BASE + '/me/mailFolders/sentitems/messages'
      + '?$filter=' + encodeURIComponent(filterExpr)
      + select
      + '&$top=50';
    var res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    return _tryFromMessages(JSON.parse(res.getContentText()).value);
  }

  var earliest = null;

  // 1) To / CC / BCC combined filter
  var combinedFilter = "toRecipients/any(t:t/emailAddress/address eq '" + safeEmail + "')"
    + " or ccRecipients/any(t:t/emailAddress/address eq '" + safeEmail + "')"
    + " or bccRecipients/any(t:t/emailAddress/address eq '" + safeEmail + "')";
  earliest = _earlierSendEntry(earliest, _fetchByFilter(combinedFilter));

  // 2) Per-field filters (some tenants reject OR on collection filters)
  var recipientFields = ['toRecipients', 'ccRecipients', 'bccRecipients'];
  for (var f = 0; f < recipientFields.length; f++) {
    var fieldFilter = recipientFields[f] + "/any(r:r/emailAddress/address eq '" + safeEmail + "')";
    earliest = _earlierSendEntry(earliest, _fetchByFilter(fieldFilter));
  }

  // 3) $search fallback (mainly To; needs ConsistencyLevel)
  var searchUrl = GRAPH_BASE + '/me/mailFolders/sentitems/messages?$search='
    + encodeURIComponent('"to:' + safeEmail + '"')
    + select
    + '&$top=50';
  var res = UrlFetchApp.fetch(searchUrl, {
    headers: Object.assign({}, headers, { 'ConsistencyLevel': 'eventual' }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() === 200) {
    earliest = _earlierSendEntry(earliest, _tryFromMessages(JSON.parse(res.getContentText()).value));
  }

  // 4) Scan recent sent mail — catches BCC when Graph filters miss hidden recipients
  var scanUrl = GRAPH_BASE + '/me/mailFolders/sentitems/messages' + select + '&$top=100';
  var sinceMs = _toMs(since);
  if (!isNaN(sinceMs)) {
    var sinceIso = new Date(sinceMs).toISOString();
    scanUrl = GRAPH_BASE + '/me/mailFolders/sentitems/messages'
      + '?$filter=' + encodeURIComponent('sentDateTime ge ' + sinceIso)
      + select
      + '&$top=100';
  }
  res = UrlFetchApp.fetch(scanUrl, { headers: headers, muteHttpExceptions: true });
  if (res.getResponseCode() === 200) {
    var scanned = (JSON.parse(res.getContentText()).value || []).filter(function(msg) {
      return _msgHasRecipient(msg, lookupEmail);
    });
    earliest = _earlierSendEntry(earliest, _tryFromMessages(scanned));
  }

  return earliest;
}

function syncOutlookSends(items) {
  if (!items || !items.length) return { ok: true, sends: [] };
  try {
    const token = getOutlookAccessToken();
    if (!token) return { ok: false, error: 'Outlook token missing' };

    const sends = [];
    for (var i = 0; i < items.length; i++) {
      const item = items[i];
      const key = (item.email || '').trim().toLowerCase();
      if (!key) continue;

      const entry = _fetchEarliestSentTo(token, key, item.since);
      if (!entry || !entry.sentAt) continue;

      sends.push({
        email: item.email,
        subject: entry.subject,
        date: entry.date,
        sentAt: entry.sentAt,
        messageId: entry.messageId,
      });
    }

    return { ok: true, sends };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function syncOutlookReplies(items) {
  if (!items || !items.length) return { ok: true, replies: [] };
  try {
    const token = getOutlookAccessToken();
    if (!token) return { ok: false, error: 'Outlook token missing' };

    const replies = [];
    for (var i = 0; i < items.length; i++) {
      const item = items[i];
      const key = (item.email || '').trim().toLowerCase();
      if (!key) continue;

      const entry = _fetchLatestFromSender(token, key);
      if (!entry || !entry.receivedAt) continue;

      var recvMs = _toMs(entry.receivedAt);
      if (isNaN(recvMs)) continue;

      var sinceMs = _toMs(item.since);
      if (!isNaN(sinceMs) && recvMs < sinceMs - 2000) continue;

      var lastMs = _toMs(item.lastReplyAt);
      if (!isNaN(lastMs) && recvMs <= lastMs) continue;

      replies.push({
        email: item.email,
        body: entry.body,
        date: entry.date,
        receivedAt: entry.receivedAt,
        isRead: entry.isRead,
        messageId: entry.messageId,
      });
    }

    return { ok: true, replies };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

var NDR_FROM_HINTS = ['mailer-daemon', 'postmaster', 'microsoftexchange', 'maildeliverysubsystem', 'msprv1'];

var NDR_TEXT_HINTS = [
  'undeliverable',
  'delivery status notification',
  'delivery has failed',
  'could not be delivered',
  'delivery failure',
  '반송',
  '배달할 수 없습니다',
  '배달 못 함',
  '배송할 수 없',
  '550 5.1.1',
  '550-5.1.1',
  '5.1.1 the email account that you tried to reach does not exist',
];

function _ndrTextBlob(msg) {
  var subject = msg.subject || '';
  var body = ((msg.body || {}).content || '');
  return (subject + ' ' + body).toLowerCase();
}

function _isNdrMessage(msg) {
  var from = (((msg.from || {}).emailAddress || {}).address || '').toLowerCase();
  for (var i = 0; i < NDR_FROM_HINTS.length; i++) {
    if (from.indexOf(NDR_FROM_HINTS[i]) !== -1) return true;
  }
  var blob = _ndrTextBlob(msg);
  for (var j = 0; j < NDR_TEXT_HINTS.length; j++) {
    if (blob.indexOf(NDR_TEXT_HINTS[j]) !== -1) return true;
  }
  return false;
}

function _extractFailedRecipientEmails(content, subject) {
  var text = (content || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ');
  var emails = [];
  var seen = {};

  function add(email) {
    var key = (email || '').trim().toLowerCase();
    if (!key || seen[key]) return;
    seen[key] = true;
    emails.push(key);
  }

  var patterns = [
    /받는\s*사람\s*주소\s*[:：]\s*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/gi,
    /recipient(?:'s)?\s+address\s*[:：]\s*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/gi,
    /final-recipient[^;]*;\s*rfc822;\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
  ];

  for (var p = 0; p < patterns.length; p++) {
    var m;
    var re = patterns[p];
    while ((m = re.exec(text)) !== null) add(m[1]);
  }

  if (!emails.length) {
    var matches = (text + ' ' + (subject || '')).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (var i = 0; i < matches.length; i++) add(matches[i]);
  }

  return emails;
}

function syncOutlookDeliveryFailures(items) {
  if (!items || !items.length) return { ok: true, failures: [] };
  try {
    const token = getOutlookAccessToken();
    if (!token) return { ok: false, error: 'Outlook token missing' };

    var candidateSet = {};
    var minSinceMs = NaN;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var key = (item.email || '').trim().toLowerCase();
      if (!key) continue;
      candidateSet[key] = item.email;
      var sinceMs = _toMs(item.since);
      if (!isNaN(sinceMs) && (isNaN(minSinceMs) || sinceMs < minSinceMs)) minSinceMs = sinceMs;
    }

    var inboxUrl = GRAPH_BASE + '/me/mailFolders/inbox/messages'
      + '?$orderby=receivedDateTime desc'
      + '&$select=id,subject,from,receivedDateTime,body'
      + '&$top=100';
    var res = UrlFetchApp.fetch(inboxUrl, {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      return { ok: false, error: 'Inbox fetch failed HTTP ' + res.getResponseCode() };
    }

    var failures = [];
    var seen = {};
    var msgs = JSON.parse(res.getContentText()).value || [];
    for (var j = 0; j < msgs.length; j++) {
      var msg = msgs[j];
      if (!_isNdrMessage(msg)) continue;
      var recvMs = _toMs(msg.receivedDateTime);
      if (!isNaN(minSinceMs) && recvMs < minSinceMs - 60000) continue;

      var bodyContent = ((msg.body || {}).content || '');
      var subject = msg.subject || '';
      var emails = _extractFailedRecipientEmails(bodyContent, subject);
      for (var k = 0; k < emails.length; k++) {
        var email = emails[k];
        if (!candidateSet[email] || seen[email]) continue;
        seen[email] = true;
        failures.push({
          email: candidateSet[email],
          receivedAt: msg.receivedDateTime,
          reason: subject.substring(0, 240),
          messageId: msg.id || '',
        });
      }
    }

    return { ok: true, failures: failures };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function markOutlookMessagesRead(messageIds) {
  const ids = (messageIds || []).filter(Boolean);
  if (!ids.length) return { ok: true, marked: 0 };
  try {
    const token = getOutlookAccessToken();
    let marked = 0;
    ids.forEach(function(id) {
      const url = GRAPH_BASE + '/me/messages/' + encodeURIComponent(id);
      const res = UrlFetchApp.fetch(url, {
        method: 'patch',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + token },
        payload: JSON.stringify({ isRead: true }),
        muteHttpExceptions: true,
      });
      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) marked++;
    });
    return { ok: true, marked: marked };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// ── Router ───────────────────────────────────────────────────
function routeOutlook(action, p, body) {
  const b = body || {};
  switch (action) {
    case 'getOutlookAuthUrl':  return { ok: true, url: getOutlookAuthUrl() };
    case 'authorizeOutlook':   return authorizeOutlook(b.code);
    case 'checkOutlookAuth':   return checkOutlookAuth();
    case 'sendOutlookEmail':
    case 'sendOutreachEmail':  return sendOutlookEmail(b);
    case 'getEmailSignature':  return getEmailSignature();
    case 'saveEmailSignature': return saveEmailSignature(b);
    case 'resetEmailSignatureToDefault': return resetEmailSignatureToDefault();
    case 'setOutreachSignatureLogoUrl': return setOutreachSignatureLogoUrl(b);
    case 'syncOutlookReplies': return syncOutlookReplies(b.items || []);
    case 'syncOutlookSends': return syncOutlookSends(b.items || []);
    case 'syncOutlookDeliveryFailures': return syncOutlookDeliveryFailures(b.items || []);
    case 'markOutlookMessagesRead': return markOutlookMessagesRead(b.messageIds || []);
    default: return null;
  }
}
