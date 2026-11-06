// @ts-check
// Authorized Google REST calls (D-034): access token refresh, one retry on 401, readable errors.
// No googleapis dependency: plain fetch, injectable for tests.

/**
 * @typedef {{ access_token: string, refresh_token: string, expiry: number, scope: string, email?: string }} Tokens
 * @typedef {{ method?: string, query?: Record<string, any>, json?: any, body?: any, headers?: Record<string, string>, raw?: boolean }} ReqOpts
 */

/**
 * @param {{
 *   getTokens: () => Tokens | null, saveTokens: (t: Tokens) => void,
 *   refresh: (refreshToken: string) => Promise<{ access_token: string, expires_in?: number, scope?: string }>,
 *   fetch?: typeof fetch, now?: () => number,
 *   onCall?: (c: { method: string, url: string, status: number, ms: number }) => void,
 * }} deps
 *   onCall: one report per HTTP call, for the usage log (D-040).
 */
function createApi({ getTokens, saveTokens, refresh, fetch: f = fetch, now = Date.now, onCall = () => {} }) {
  /** @type {Promise<string> | null} */
  let refreshing = null;

  async function token(force = false) {
    const t = getTokens();
    if (!t || !t.refresh_token) throw new Error('Not signed in to Google. Use /google in the terminal.');
    if (!force && t.access_token && t.expiry - 60000 > now()) return t.access_token;
    refreshing = refreshing || (async () => {
      try {
        const r = await refresh(t.refresh_token);
        const next = { ...t, access_token: r.access_token, expiry: now() + (r.expires_in || 3600) * 1000, scope: r.scope || t.scope };
        saveTokens(next);
        return next.access_token;
      } finally { refreshing = null; }
    })();
    return refreshing;
  }

  /** @param {string} url @param {ReqOpts} [o] */
  async function request(url, o = {}) {
    const q = o.query ? `?${new URLSearchParams(Object.entries(o.query).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]))}` : '';
    const method = o.method || (o.json || o.body ? 'POST' : 'GET');
    const send = async (/** @type {string} */ tok) => {
      const t0 = now();
      /** @type {Response} */ let r;
      try {
        r = await f(url + q, {
          method, headers: { authorization: `Bearer ${tok}`, ...(o.json ? { 'content-type': 'application/json' } : {}), ...(o.headers || {}) },
          body: o.json ? JSON.stringify(o.json) : o.body,
        });
      } catch (e) { onCall({ method, url, status: 0, ms: now() - t0 }); throw e; }
      onCall({ method, url, status: r.status, ms: now() - t0 });
      return r;
    };
    let r = await send(await token());
    if (r.status === 401) r = await send(await token(true));
    if (o.raw && r.ok) return r;
    const text = await r.text();
    /** @type {any} */ let j = null;
    try { j = text ? JSON.parse(text) : {}; } catch { j = { text }; }
    if (!r.ok) {
      const msg = (j && j.error && (j.error.message || j.error)) || text || r.status;
      if (r.status === 403 && /insufficient|scope/i.test(String(msg))) throw new Error(`Google: permission missing (${msg}). Sign in again with /google login.`);
      throw new Error(`Google API ${r.status}: ${msg}`);
    }
    return j;
  }

  return { request, token };
}

module.exports = { createApi };
