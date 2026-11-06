// @ts-check
// Telegram Bot API client (TG-1, D-008, D-036): plain fetch, long polling with getUpdates, no webhook, no server.
// The bot token is passed in from platform/secrets and never logged (errors redact it).

const BASE = 'https://api.telegram.org';

/**
 * @param {{ token: () => string | null, fetch?: typeof fetch, onCall?: (c: { method: string, ok: boolean }) => void }} deps
 *   onCall: one report per Bot API call except long polling, for the usage log (D-040).
 */
function createBotApi({ token, fetch: f = fetch, onCall = () => {} }) {
  const redact = (/** @type {string} */ s) => { const t = token(); return t ? String(s).split(t).join('<token>') : String(s); };

  /** @param {string} method @param {Record<string, any>} [params] @param {AbortSignal} [signal] */
  async function call(method, params = {}, signal) {
    const t = token();
    if (!t) throw new Error('Telegram is not set up.');
    let r;
    try {
      r = await f(`${BASE}/bot${t}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params), signal });
    } catch (e) { throw new Error(redact(`Telegram ${method}: ${/** @type {Error} */ (e).message || e}`)); }
    const j = /** @type {any} */ (await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` })));
    if (method !== 'getUpdates') onCall({ method, ok: !!j.ok });
    if (!j.ok) {
      const err = /** @type {any} */ (new Error(redact(`Telegram ${method}: ${j.description || r.status}`)));
      err.code = j.error_code; err.retryAfter = j.parameters && j.parameters.retry_after;
      throw err;
    }
    return j.result;
  }

  /** multipart upload (sendPhoto / sendDocument). @param {string} method @param {Record<string, any>} fields @param {string} fileField @param {Buffer} data @param {string} filename @param {string} type */
  async function upload(method, fields, fileField, data, filename, type) {
    const t = token();
    if (!t) throw new Error('Telegram is not set up.');
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    form.append(fileField, new Blob([new Uint8Array(data)], { type }), filename);
    const r = await f(`${BASE}/bot${t}/${method}`, { method: 'POST', body: form });
    const j = /** @type {any} */ (await r.json().catch(() => ({ ok: false })));
    if (!j.ok) throw new Error(redact(`Telegram ${method}: ${j.description || r.status}`));
    return j.result;
  }

  /**
   * Long-poll loop. Calls onUpdate for each update in order; backs off on errors; stops on stop().
   * @param {(u: any) => Promise<void> | void} onUpdate @param {{ timeout?: number, onError?: (e: Error) => void, sleep?: (ms: number) => Promise<void> }} [o]
   */
  function poll(onUpdate, { timeout = 50, onError = () => {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    let offset = 0;
    let running = true;
    /** @type {AbortController | null} */ let ac = null;
    let backoff = 1000;
    (async () => {
      while (running) {
        ac = new AbortController();
        try {
          const updates = await call('getUpdates', { offset, timeout, allowed_updates: ['message', 'callback_query'] }, ac.signal);
          backoff = 1000;
          for (const u of updates) {
            offset = Math.max(offset, u.update_id + 1);
            try { await onUpdate(u); } catch (e) { onError(/** @type {Error} */ (e)); }
          }
        } catch (e) {
          if (!running) break;
          const err = /** @type {any} */ (e);
          onError(err);
          if (err.code === 401 || err.code === 404) { running = false; break; } // bad token: stop instead of hammering
          await sleep(err.retryAfter ? err.retryAfter * 1000 : backoff);
          backoff = Math.min(backoff * 2, 60000);
        }
      }
    })();
    return () => { running = false; if (ac) ac.abort(); };
  }

  return { call, upload, poll };
}

module.exports = { createBotApi };
