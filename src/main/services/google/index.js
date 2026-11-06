// @ts-check
// Google (GOOG-1..8, PORT-6..8, D-009, D-010, D-014, D-034): sign-in with the user's own OAuth client, tools for the
// coding agent, meeting reminders + "in a meeting" quiet time, a morning brief, chat context, Drive backup and lease.
// Client id/secret and tokens live only in platform/secrets.
const { TOPICS } = require('../../bus-topics');
const { createApi } = require('./api');
const { createCalendar } = require('./calendar');
const { createGmail } = require('./gmail');
const { createDrive } = require('./drive');
const { googleTools, policyRule } = require('./tools');
const { createBackup } = require('./backup');
const { dayOf } = require('../pet/bond');

const SCOPES = {
  base: [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.appdata',
  ],
  readonly: 'https://www.googleapis.com/auth/drive.readonly',
};
const POLL_MS = 60000;            // meeting watch tick
const BACKUP_EVERY_MS = 20 * 3600000;
const LEASE_EVERY_MS = 5 * 60000;

/**
 * @param {{
 *   bus: import('../../bus').BusInstance,
 *   secrets: { get: (k: string) => string | null, set: (k: string, v: string) => void, delete: (k: string) => void },
 *   device: import('../../platform/store/device').DeviceSettings,
 *   oauth: { authorize: Function, refresh: Function, revoke: Function },
 *   openExternal: (url: string) => any,
 *   tama: { id: string, name: string }, deviceName: string,
 *   fetch?: typeof fetch, now?: () => number,
 * }} deps
 */
function createGoogle({ bus, secrets, device, oauth, openExternal, tama, deviceName, fetch: f = fetch, now = Date.now }) {
  const prefs = () => ({ readonly: false, backup: true, folderId: null, lastBackup: 0, briefDay: '', deviceId: '', tamaDrafts: /** @type {string[]} */ ([]), ...(device.get().google || {}) });
  if (!prefs().deviceId) device.patch('google', { deviceId: `pc-${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` });
  const json = (/** @type {string} */ k) => { try { return JSON.parse(secrets.get(k) || 'null'); } catch { return null; } };
  const client = () => /** @type {{ clientId: string, clientSecret: string } | null} */ (json('google.client'));
  const tokens = () => json('google.tokens');

  const api = createApi({
    getTokens: tokens, saveTokens: (t) => secrets.set('google.tokens', JSON.stringify(t)), fetch: f, now,
    refresh: (rt) => { const c = client(); if (!c) throw new Error('Google client not set up.'); return oauth.refresh({ clientId: c.clientId, clientSecret: c.clientSecret, refreshToken: rt, fetch: f }); },
  });
  const calendar = createCalendar(api, now);
  const gmail = createGmail(api);
  const drive = createDrive(api, { getFolderId: () => prefs().folderId, setFolderId: (id) => device.patch('google', { folderId: id }) });
  const backup = createBackup({ bus, drive, tamaId: () => tama.id, tamaName: () => tama.name, deviceId: prefs().deviceId, deviceName, now });
  // Drafts Tama wrote (only these can be sent, D-038); kept per PC, newest 200.
  const drafts = {
    remember: (/** @type {string} */ id) => device.patch('google', { tamaDrafts: [...(prefs().tamaDrafts || []), id].slice(-200) }),
    isTamas: (/** @type {string} */ id) => (prefs().tamaDrafts || []).includes(id),
  };
  const tools = googleTools({
    calendar, gmail, drive, now, drafts,
    onCreated: (what) => bus.emit(TOPICS.BRAIN_NOTICE, { text: `made a ${what} in your Google~ ✨`, kind: 'info' }),
  });

  const signedIn = () => !!(tokens() && tokens().refresh_token);
  let meeting = /** @type {{ summary: string, end: number } | null} */ (null);
  const reminded = new Set();
  let warnedLease = false;
  /** @type {{ at: number, text: string }} */ let ctxCache = { at: 0, text: '' };

  function status() {
    const p = prefs();
    const t = tokens();
    return {
      configured: !!client(), signedIn: signedIn(), email: (t && t.email) || null, readonly: !!p.readonly, backup: p.backup !== false,
      lastBackup: p.lastBackup || 0, inMeeting: meeting && meeting.end > now() ? meeting.summary : null,
      scopes: t ? String(t.scope || '').split(' ').filter(Boolean).map((s) => s.replace('https://www.googleapis.com/auth/', '')) : [],
    };
  }
  const changed = () => bus.emit(TOPICS.GOOGLE_CHANGED, status());

  /** @param {{ clientId?: string, clientSecret?: string }} p */
  function setClient(p) {
    const id = String(p.clientId || '').trim();
    const secret = String(p.clientSecret || '').trim();
    if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(id)) return { error: 'That client ID should end with .apps.googleusercontent.com' };
    if (secret.length < 10) return { error: 'Please paste the client secret too.' };
    secrets.set('google.client', JSON.stringify({ clientId: id, clientSecret: secret }));
    changed();
    return status();
  }

  async function login() {
    const c = client();
    if (!c) return { error: 'Set up your Google OAuth client first (/google setup).' };
    const scopes = [...SCOPES.base, ...(prefs().readonly ? [SCOPES.readonly] : [])];
    const r = await oauth.authorize({ clientId: c.clientId, clientSecret: c.clientSecret, scopes, openExternal, fetch: f });
    if (!r.refresh_token) return { error: 'Google did not return a refresh token. Remove Tama\'s access at myaccount.google.com/permissions and try again.' };
    secrets.set('google.tokens', JSON.stringify({ access_token: r.access_token, refresh_token: r.refresh_token, expiry: now() + (r.expires_in || 3600) * 1000, scope: r.scope || scopes.join(' ') }));
    const prof = await gmail.profile().catch(() => null);
    if (prof && prof.emailAddress) secrets.set('google.tokens', JSON.stringify({ ...tokens(), email: prof.emailAddress }));
    changed();
    offerRestore().catch(() => null);
    return status();
  }

  async function logout() {
    const t = tokens();
    if (t && t.refresh_token) await oauth.revoke(t.refresh_token, f);
    secrets.delete('google.tokens');
    meeting = null;
    changed();
    return status();
  }

  /** New PC (PORT-6/8): backups of Tamas that aren't on this PC yet. */
  async function offerRestore() {
    const list = await backup.list();
    const roster = await bus.request(TOPICS.ROSTER_GET).catch(() => null);
    const here = new Set(((roster && roster.tamas) || []).map((/** @type {any} */ t) => t.id));
    const missing = [...new Set(list.filter((b) => !here.has(b.tamaId)).map((b) => b.tamaId))];
    if (missing.length) bus.emit(TOPICS.BRAIN_NOTICE, { text: `I found ${missing.length} Tama backup${missing.length > 1 ? 's' : ''} in your Google Drive! /google backups to see, /google restore <n> to bring one here~`, kind: 'info' });
  }

  // ---- calendar watch: reminders 5 min before, quiet during meetings (GOOG-3, PET-6) ----
  async function watch() {
    if (!signedIn()) return;
    const evs = await calendar.list({ from: now() - 3 * 3600000, to: now() + 15 * 60000 }).catch(() => null);
    if (!evs) return;
    const t = now();
    const timed = evs.filter((e) => !e.allDay).map((e) => ({ ...e, s: Date.parse(e.start), e: Date.parse(e.end) }));
    const cur = timed.find((e) => e.s <= t && e.e > t);
    const wasIn = !!meeting;
    meeting = cur ? { summary: cur.summary, end: cur.e } : null;
    if (wasIn !== !!meeting) changed();
    for (const e of timed) {
      const mins = (e.s - t) / 60000;
      if (mins > 0 && mins <= 5 && !reminded.has(e.id)) {
        reminded.add(e.id);
        bus.emit(TOPICS.GOOGLE_MEETING_SOON, { summary: e.summary, start: e.start, minutes: Math.ceil(mins) });
        bus.emit(TOPICS.BRAIN_NOTICE, { text: `*tugs your sleeve* "${e.summary}" starts in ${Math.ceil(mins)} min! 📅`, kind: 'warn' });
      }
    }
  }

  // ---- morning brief (GOOG-8) + chat context ----
  async function brief() {
    if (!signedIn()) return { error: 'Not signed in to Google.' };
    const start = new Date(now()); start.setHours(0, 0, 0, 0);
    const [evs, mail, prod] = await Promise.all([
      calendar.list({ from: now(), to: start.getTime() + 86400000 }).catch(() => []),
      gmail.search({ query: 'is:unread is:important newer_than:2d', max: 5 }).catch(() => []),
      bus.request(TOPICS.PROD_GET).catch(() => null),
    ]);
    const todos = ((prod && prod.todos) || []).filter((/** @type {any} */ t) => !t.done);
    const time = (/** @type {string} */ s) => (/T/.test(s) ? new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'all day');
    const lines = [
      evs.length ? `📅 ${evs.length} event${evs.length > 1 ? 's' : ''} today: ${evs.slice(0, 4).map((e) => `${time(e.start)} ${e.summary}`).join(' · ')}` : '📅 no more events today',
      mail.length ? `✉️ ${mail.length} important unread: ${mail.slice(0, 3).map((m) => `"${m.subject}"`).join(', ')}` : '✉️ no important unread mail',
      todos.length ? `☐ ${todos.length} open todo${todos.length > 1 ? 's' : ''}: ${todos.slice(0, 3).map((/** @type {any} */ t) => t.text).join(' · ')}` : '☐ no open todos',
    ];
    return { text: lines.join('\n'), events: evs.length, mail: mail.length, todos: todos.length };
  }
  /** Short, cached line for the chat brain's status (read-only context; agy gets no Google tools). */
  async function chatContext() {
    if (!signedIn()) return '';
    if (now() - ctxCache.at < 10 * 60000) return ctxCache.text;
    const b = await brief().catch(() => null);
    ctxCache = { at: now(), text: b && b.text ? `[google] ${b.text.replace(/\n/g, ' | ')}${meeting ? ` | user is in a meeting now: ${meeting.summary}` : ''}` : '' };
    return ctxCache.text;
  }

  async function daily() {
    if (!signedIn()) return;
    const p = prefs();
    const today = dayOf(now());
    const hour = new Date(now()).getHours();
    if (p.briefDay !== today && hour >= 7 && hour < 12) {
      device.patch('google', { briefDay: today });
      const b = await brief().catch(() => null);
      if (b && b.text) {
        bus.emit(TOPICS.BRAIN_NOTICE, { text: `☀️ your morning brief~\n${b.text}`, kind: 'info' });
        bus.request(TOPICS.CHAT_PUSH, { role: 'tama', text: `☀️ Morning brief\n${b.text}` }).catch(() => null);
      }
    }
    if (p.backup !== false && now() - (p.lastBackup || 0) > BACKUP_EVERY_MS) {
      const r = await backup.backupNow().catch((e) => { bus.emit(TOPICS.APP_ERROR, { topic: 'google.backup', message: String(e.message || e) }); return null; });
      if (r) device.patch('google', { lastBackup: now() });
    }
  }

  async function lease() {
    if (!signedIn()) return;
    const r = await backup.heartbeat().catch(() => null);
    if (r && r.other && !warnedLease) {
      warnedLease = true;
      bus.emit(TOPICS.BRAIN_NOTICE, { text: `${tama.name} is also awake on "${r.other.deviceName}"! Running on two PCs can split her memories. Quit Tama there to move her here~`, kind: 'warn' });
    }
  }

  /** @param {{ readonly?: boolean, backup?: boolean }} p */
  function set(p) {
    /** @type {Record<string, any>} */ const patch = {};
    if (typeof p.readonly === 'boolean') patch.readonly = p.readonly;
    if (typeof p.backup === 'boolean') patch.backup = p.backup;
    device.patch('google', patch);
    changed();
    const needsLogin = typeof p.readonly === 'boolean' && signedIn() && p.readonly && !status().scopes.includes('drive.readonly');
    return { ...status(), needsLogin };
  }

  const safe = (/** @type {() => Promise<any>} */ fn, /** @type {string} */ topic) => () => fn().catch((e) => bus.emit(TOPICS.APP_ERROR, { topic, message: String(e.message || e) }));

  function start() {
    const timers = [
      setInterval(safe(watch, 'google.watch'), POLL_MS),
      setInterval(safe(daily, 'google.daily'), 10 * 60000),
      setInterval(safe(lease, 'google.lease'), LEASE_EVERY_MS),
    ];
    const first = setTimeout(() => { safe(watch, 'google.watch')(); safe(daily, 'google.daily')(); safe(lease, 'google.lease')(); }, 20000);
    const offs = [
      bus.handle(TOPICS.GOOGLE_STATUS, () => status()),
      bus.handle(TOPICS.GOOGLE_SET_CLIENT, (/** @type {any} */ p) => setClient(p || {})),
      bus.handle(TOPICS.GOOGLE_LOGIN, () => login()),
      bus.handle(TOPICS.GOOGLE_LOGOUT, () => logout()),
      bus.handle(TOPICS.GOOGLE_SET, (/** @type {any} */ p) => set(p || {})),
      bus.handle(TOPICS.GOOGLE_BRIEF, () => brief()),
      bus.handle(TOPICS.GOOGLE_CONTEXT, () => chatContext()),
      bus.handle(TOPICS.GOOGLE_BACKUP_NOW, async () => { const r = await backup.backupNow(); device.patch('google', { lastBackup: now() }); return r; }),
      bus.handle(TOPICS.GOOGLE_BACKUPS, async () => ({ backups: await backup.list() })),
      bus.handle(TOPICS.GOOGLE_RESTORE, (/** @type {any} */ p) => backup.restore(String((p && p.fileId) || ''))),
    ];
    return () => { for (const t of timers) clearInterval(t); clearTimeout(first); for (const off of offs) off(); };
  }

  return {
    start, status, login, logout, setClient, brief, chatContext, watch, daily,
    /** Tool servers for Claude Code sessions (only while signed in). */
    mcpServers: () => (signedIn() ? [{ name: 'google', tools }] : []),
    gateRule: policyRule(tools),
    tools,
  };
}

module.exports = { createGoogle, SCOPES };
