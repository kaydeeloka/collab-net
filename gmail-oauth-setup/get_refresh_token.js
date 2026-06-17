/**
 * Gmail OAuth refresh token helper
 *
 * Reuse an existing Desktop OAuth client (e.g. "mimuse local") — no new client needed.
 *
 * 1. Google Cloud Console → APIs & Services → Enable "Gmail API" (same project)
 * 2. Credentials → click "mimuse local" (Desktop) → copy Client ID + Client Secret
 *    Desktop clients allow localhost redirects automatically (no URI to add).
 * 3. Paste them into CLIENT_ID / CLIENT_SECRET below
 *
 * Do NOT use Service Accounts — Gmail needs a user OAuth refresh token.
 *
 * Then: node get_refresh_token.js
 * Save the printed REFRESH_TOKEN (e.g. GAS Script Property or Worker secret).
 */

const http = require('http')
const { URL } = require('url')
const { google } = require('googleapis')

const CLIENT_ID = 'PASTE_CLIENT_ID_HERE'
const CLIENT_SECRET = 'PASTE_CLIENT_SECRET_HERE'
const REDIRECT_URI = 'http://localhost:3000/oauth2callback'
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

async function main() {
  if (CLIENT_ID.startsWith('PASTE') || CLIENT_SECRET.startsWith('PASTE')) {
    console.error('Edit CLIENT_ID and CLIENT_SECRET in get_refresh_token.js first.')
    process.exit(1)
  }

  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  })

  console.log('\nOpening browser for Google sign-in…')
  console.log('If it does not open, visit:\n', authUrl, '\n')

  const open = (await import('open')).default
  await open(authUrl)

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const qs = new URL(req.url || '', REDIRECT_URI).searchParams
        const err = qs.get('error')
        if (err) {
          res.end('Auth failed: ' + err)
          server.close()
          reject(new Error(err))
          return
        }
        const authCode = qs.get('code')
        if (authCode) {
          res.end('Auth successful — you can close this tab and return to the terminal.')
          server.close()
          resolve(authCode)
        }
      } catch (e) {
        server.close()
        reject(e)
      }
    })
    server.listen(3000, () => {
      console.log('Waiting for redirect on http://localhost:3000/oauth2callback …')
    })
  })

  const { tokens } = await oauth2.getToken(code)
  if (!tokens.refresh_token) {
    console.error('No refresh_token returned. Revoke app access at https://myaccount.google.com/permissions and run again with prompt=consent.')
    process.exit(1)
  }

  console.log('\n--- Save these securely ---')
  console.log('REFRESH_TOKEN=' + tokens.refresh_token)
  console.log('ACCESS_TOKEN=' + tokens.access_token)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
