// @ts-check
// Google desktop OAuth (GOOG-1, D-009, D-034): loopback redirect + PKCE with the user's own OAuth client.
// Tama never sees the user's password; tokens go to platform/secrets only (never logs or JSON files).
const http = require('http');
const crypto = require('crypto');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

/** @param {Buffer} b */
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** @typedef {{ access_token: string, refresh_token?: string, expires_in?: number, scope?: string, token_type?: string }} TokenResponse */

const DONE_PAGE = (/** @type {string} */ msg) => `<!doctype html><meta charset="utf-8"><title>Tama</title>
<body style="font-family:Segoe UI,sans-serif;background:#fff7fb;color:#2b2340;display:grid;place-items:center;height:90vh;text-align:center">
<div><div style="font-size:48px">✨</div><h2>${msg}</h2><p>You can close this tab and go back to Tama.</p></div></body>`;

/**
 * Run the browser sign-in. Resolves with Google's token response.
 * @param {{
 *   clientId: string, clientSecret: string, scopes: string[],
 *   openExternal: (url: string) => any, fetch?: typeof fetch, timeoutMs?: number, loginHint?: string,
 * }} o
 * @returns {Promise<TokenResponse>}
 */
function authorize({ clientId, clientSecret, scopes, openExternal, fetch: f = fetch, timeoutMs = 5 * 60000, loginHint }) {
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));

  return new Promise((resolve, reject) => {
    /** @type {NodeJS.Timeout} */ let timer;
    const server = http.createServer((req, res) => {
      const u = new URL(req.url || '/', 'http://127.0.0.1');
      if (u.pathname !== '/') { res.writeHead(404).end(); return; }
      const err = u.searchParams.get('error');
      const code = u.searchParams.get('code');
      if (u.searchParams.get('state') !== state || (!code && !err)) { res.writeHead(400).end('bad request'); return; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(DONE_PAGE(err ? 'Sign-in was cancelled' : 'Signed in to Google!'));
      finish(err ? new Error(`Google sign-in: ${err}`) : null, code);
    });
    /** @param {Error | null} e @param {string | null} [code] */
    const finish = async (e, code) => {
      clearTimeout(timer);
      server.close();
      if (e || !code) return reject(e || new Error('Google sign-in failed'));
      try {
        resolve(await postForm(f, TOKEN_URL, {
          code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri,
          grant_type: 'authorization_code', code_verifier: verifier,
        }));
      } catch (x) { reject(x); }
    };
    let redirectUri = '';
    server.on('error', (e) => reject(e));
    server.listen(0, '127.0.0.1', () => {
      const addr = /** @type {import('net').AddressInfo} */ (server.address());
      redirectUri = `http://127.0.0.1:${addr.port}`;
      const q = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: scopes.join(' '),
        code_challenge: challenge, code_challenge_method: 'S256', state, access_type: 'offline', prompt: 'consent',
        include_granted_scopes: 'true', ...(loginHint ? { login_hint: loginHint } : {}),
      });
      timer = setTimeout(() => finish(new Error('Google sign-in timed out (5 minutes).')), timeoutMs);
      Promise.resolve(openExternal(`${AUTH_URL}?${q}`)).catch((/** @type {any} */ e) => finish(e));
    });
  });
}

/**
 * @param {{ clientId: string, clientSecret: string, refreshToken: string, fetch?: typeof fetch }} o
 * @returns {Promise<TokenResponse>}
 */
function refresh({ clientId, clientSecret, refreshToken, fetch: f = fetch }) {
  return postForm(f, TOKEN_URL, { client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' });
}

/** Best effort: tell Google to forget the grant. @param {string} token @param {typeof fetch} [f] */
async function revoke(token, f = fetch) {
  try { await f(`${REVOKE_URL}?${new URLSearchParams({ token })}`, { method: 'POST' }); } catch { /* offline: tokens are deleted locally anyway */ }
}

/** @param {typeof fetch} f @param {string} url @param {Record<string, string>} form */
async function postForm(f, url, form) {
  const r = await f(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() });
  const j = /** @type {any} */ (await r.json().catch(() => ({})));
  if (!r.ok) throw new Error(`Google token error: ${j.error_description || j.error || r.status}`);
  return j;
}

module.exports = { authorize, refresh, revoke, AUTH_URL, TOKEN_URL };
