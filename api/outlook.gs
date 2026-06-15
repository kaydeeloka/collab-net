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

// ── Send email via Graph API ─────────────────────────────────
function sendOutlookEmail(body) {
  const email = (body.email || body.to || '').trim();
  if (!email || !body.subject) return { ok: false, error: '이메일 주소 또는 제목이 없습니다.' };
  try {
    const token = getOutlookAccessToken();
    const payload = {
      message: {
        subject: body.subject,
        body: { contentType: 'Text', content: body.body || '' },
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
// Returns reply content + date per email (dashboard updates Supabase).
function syncOutlookReplies(items) {
  if (!items || !items.length) return { ok: true, replies: [] };
  try {
    const token = getOutlookAccessToken();
    const emails = items.map(x => (x.email || '').trim().toLowerCase()).filter(Boolean);
    if (!emails.length) return { ok: true, replies: [] };

    const repliedMap = {};

    const CHUNK = 10;
    for (let i = 0; i < emails.length; i += CHUNK) {
      const chunk = emails.slice(i, i + CHUNK);
      const searchQuery = chunk.map(e => 'from:' + e).join(' OR ');
      const url = GRAPH_MESSAGES_URL
        + '?$search=' + encodeURIComponent('"' + searchQuery + '"')
        + '&$select=from,receivedDateTime,body'
        + '&$top=50';

      const res = UrlFetchApp.fetch(url, {
        headers: { 'Authorization': 'Bearer ' + token, 'ConsistencyLevel': 'eventual' },
        muteHttpExceptions: true,
      });

      if (res.getResponseCode() !== 200) continue;
      const data = JSON.parse(res.getContentText());

      (data.value || []).forEach(function(msg) {
        const from = ((msg.from || {}).emailAddress || {}).address || '';
        if (!from) return;
        const key = from.toLowerCase();
        if (!repliedMap[key]) {
          const rawBody  = ((msg.body || {}).content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
          const received = (msg.receivedDateTime || '').split('T')[0];
          repliedMap[key] = { body: rawBody.substring(0, 1000), date: received };
        }
      });
    }

    const replies = [];
    for (const item of items) {
      const key = (item.email || '').toLowerCase();
      if (!key || !repliedMap[key]) continue;
      replies.push({
        email: item.email,
        body: repliedMap[key].body,
        date: repliedMap[key].date,
      });
    }

    return { ok: true, replies };
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
    case 'syncOutlookReplies': return syncOutlookReplies(b.items || []);
    default: return null;
  }
}
