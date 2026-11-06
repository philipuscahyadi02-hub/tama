// @ts-check
// Accounts overview + switching (M8, D-040): Claude Code, Gemini (agy), the Google project/account, the Telegram bot.
// Sign-ins themselves always happen in the official tools; this service only reports and starts them, then watches for
// the change so the brain can start fresh sessions on the new account.
const { TOPICS } = require('../../bus-topics');

const CACHE_MS = 60000;
const WATCH_MS = 10000;
const WATCH_FOR_MS = 5 * 60000;

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   claude: { status: () => Promise<any>, switch: () => Promise<any> | any },
 *   gemini: { status: () => any, switch: () => Promise<any> | any },
 *   now?: () => number,
 * }} deps
 */
function createAccounts({ bus, claude, gemini, now = Date.now }) {
  /** @type {{ at: number, value: any } | null} */ let cache = null;
  /** @type {NodeJS.Timeout | null} */ let watcher = null;

  async function collect() {
    const [c, g, google, tg] = await Promise.all([
      claude.status().catch((/** @type {Error} */ e) => ({ loggedIn: false, error: e.message })),
      Promise.resolve().then(() => gemini.status()).catch(() => ({ email: null })),
      bus.request(TOPICS.GOOGLE_STATUS).catch(() => null),
      bus.request(TOPICS.TELEGRAM_STATUS).catch(() => null),
    ]);
    const clientId = google && google.clientId ? String(google.clientId) : '';
    return {
      claude: c,
      gemini: g,
      google: google ? {
        signedIn: google.signedIn, email: google.email, configured: google.configured, scopes: google.scopes, maps: google.maps,
        project: clientId ? clientId.split('-')[0] : null, clientId: clientId || null,
      } : null,
      telegram: tg ? { configured: tg.configured, bot: tg.bot, paired: tg.paired, running: tg.running } : null,
      checkedAt: now(),
    };
  }

  /** @param {{ refresh?: boolean }} [p] */
  async function get(p = {}) {
    if (!p.refresh && cache && now() - cache.at < CACHE_MS) return cache.value;
    const value = await collect();
    const prev = cache && cache.value;
    cache = { at: now(), value };
    if (prev && changed(prev, value)) onChanged(prev, value);
    return value;
  }

  /** @param {any} a @param {any} b */
  const changed = (a, b) => (a.claude && a.claude.email) !== (b.claude && b.claude.email) || (a.gemini && a.gemini.email) !== (b.gemini && b.gemini.email)
    || (a.google && a.google.email) !== (b.google && b.google.email);

  /** @param {any} prev @param {any} next */
  function onChanged(prev, next) {
    bus.emit(TOPICS.ACCOUNTS_CHANGED, next);
    if ((prev.claude && prev.claude.email) !== (next.claude && next.claude.email)) {
      // New Claude account: start a fresh Claude Code session so it uses it.
      bus.request(TOPICS.ENGINE_CLEAR).catch(() => null);
      bus.emit(TOPICS.BRAIN_NOTICE, { text: `Claude account is now ${next.claude.email || 'signed out'} ✨`, kind: 'info' });
    }
    if ((prev.gemini && prev.gemini.email) !== (next.gemini && next.gemini.email)) {
      bus.emit(TOPICS.BRAIN_NOTICE, { text: `Gemini (agy) account is now ${next.gemini.email || 'unknown'} ✨`, kind: 'info' });
    }
  }

  /** Re-check every 10 s for a few minutes after a switch was started. */
  function watch() {
    if (watcher) clearInterval(watcher);
    const until = now() + WATCH_FOR_MS;
    watcher = setInterval(() => {
      if (now() > until) { if (watcher) clearInterval(watcher); watcher = null; return; }
      get({ refresh: true }).catch(() => null);
    }, WATCH_MS);
  }

  /** @param {{ kind: string }} p */
  async function switchAccount({ kind }) {
    await get({ refresh: true }); // baseline for change detection
    switch (kind) {
      case 'claude': await claude.switch(); watch(); return { ok: true, message: 'A window opened: sign out, then sign in with the Claude account you want. Tama notices the change by itself.' };
      case 'gemini': await gemini.switch(); watch(); return { ok: true, message: 'A window opened with agy: type /logout, sign in with the Google account you want, then /exit. (Your own agy CLI uses the same sign-in.)' };
      case 'google': {
        await bus.request(TOPICS.GOOGLE_LOGOUT);
        const r = await bus.request(TOPICS.GOOGLE_LOGIN).catch((/** @type {Error} */ e) => ({ error: e.message }));
        cache = null;
        if (r && r.error) return { error: r.error };
        await get({ refresh: true });
        return { ok: true, message: `Google is now ${r.email || 'connected'}.` };
      }
      case 'google-project': {
        await bus.request(TOPICS.GOOGLE_LOGOUT);
        cache = null;
        return { ok: true, openGoogleSetup: true, message: 'Signed out. Enter the new project\'s OAuth client in the Google window, then sign in.' };
      }
      case 'telegram': return { ok: true, message: 'To use another bot: /phone setup <new token> in the terminal. To pair another phone: /phone code.' };
      default: return { error: `Unknown account kind: ${kind}` };
    }
  }

  function start() {
    const offs = [
      bus.handle(TOPICS.ACCOUNTS_GET, (/** @type {any} */ p) => get(p || {})),
      bus.handle(TOPICS.ACCOUNTS_SWITCH, (/** @type {any} */ p) => switchAccount(p || {})),
      bus.on(TOPICS.GOOGLE_CHANGED, () => { cache = null; }),
      bus.on(TOPICS.TELEGRAM_CHANGED, () => { cache = null; }),
    ];
    return () => { for (const off of offs) off(); if (watcher) clearInterval(watcher); };
  }

  return { start, get, switchAccount };
}

module.exports = { createAccounts };
