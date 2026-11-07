// @ts-check
// Desktop channel (QC-5, QC-6): the renderer boundary. Untrusted input from pages is coerced or allow-listed before it
// reaches the bus, and pages can't choose which file is imported or which page opens.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Bus } = require('../../bus');
const { TOPICS } = require('../../bus-topics');
const { createDesktopChannel } = require('./index');

function setup() {
  const bus = new Bus();
  /** @type {Record<string, (...a: any[]) => any>} */ const handlers = {};
  /** @type {Array<[any, string, any]>} */ const sent = [];
  const ipc = {
    handle: (/** @type {string} */ c, /** @type {any} */ fn) => { handlers[c] = fn; },
    on: (/** @type {string} */ c, /** @type {any} */ fn) => { handlers[c] = fn; },
    onFromWindow: (/** @type {string} */ c, /** @type {any} */ fn) => { handlers[c] = fn; },
    sendUi: (/** @type {any} */ w, /** @type {string} */ n, /** @type {any} */ p) => sent.push([w, n, p]),
    setProbe: () => {},
  };
  /** @type {string[]} */ const opened = [];
  const picks = { open: /** @type {string | null} */ ('C:\\picked\\kero.tama') };
  const shell = {
    notify: () => {},
    openExternal: async (/** @type {string} */ u) => { if (!u.startsWith('https://accounts.google.com/')) throw new Error('Not opening: not an allowed site.'); opened.push(u); },
    pickOpenTama: async () => picks.open,
    pickFolder: async () => null,
  };
  const win = { id: 'pet' };
  const pet = { win, setCapture: () => {}, walk: () => {}, dragBy: () => {}, isHiddenByUser: () => false };
  const term = { window: () => ({ id: 'term' }), show: () => {}, isHidden: () => true };
  const chat = { window: () => ({ id: 'chat' }), show: () => {} };
  /** @type {string[]} */ const pages = [];
  const ch = createDesktopChannel(/** @type {any} */ ({
    bus, ipc, shell, pet, term, chat, summon: () => {},
    openOnboarding: (/** @type {string} */ m) => pages.push(`onboarding:${m}`), openRoster: () => pages.push('roster'),
    openGoogle: () => pages.push('google'), openDashboard: (/** @type {string} */ t) => pages.push(`dashboard:${t || ''}`),
    openVoice: () => pages.push('voice'), openSettings: (/** @type {string} */ t) => pages.push(`settings:${t || ''}`), pages: () => [],
  }));
  ch.start();
  /** @type {Record<string, any[]>} */ const got = {};
  const capture = (/** @type {string} */ topic, /** @type {any} */ reply = { ok: true }) => bus.handle(topic, (p) => { (got[topic] = got[topic] || []).push(p); return reply; });
  return { bus, handlers, sent, opened, picks, pages, capture, got };
}

test('pet actions: only user care actions reach the pet service', async () => {
  const s = setup();
  s.capture(TOPICS.PET_ACT);
  assert.deepEqual(await s.handlers['pet:act']('focus-break'), { ok: false, reason: 'unknown-action' });
  assert.deepEqual(await s.handlers['pet:act']({ toString: () => 'feed' }), { ok: true });
  assert.deepEqual(s.got[TOPICS.PET_ACT], [{ action: 'feed' }]);
});

test('pages open only by allow-listed name; onboarding mode defaults to hatch', () => {
  const s = setup();
  s.handlers['page:open']('voice');
  s.handlers['page:open']('limits');
  s.handlers['page:open']('../../evil');
  s.handlers['page:open']('constructor');
  s.handlers['onboarding:open']('rm -rf');
  s.handlers['settings:open']({ tab: 'x' });
  assert.deepEqual(s.pages, ['voice', 'dashboard:limits', 'onboarding:hatch', 'settings:']);
});

test('import only reads the file the user picked in the dialog', async () => {
  const s = setup();
  s.capture(TOPICS.ROSTER_IMPORT);
  assert.deepEqual(await s.handlers['roster:importPassword']('pw', false), { error: 'Pick a file first.' });
  await s.handlers['roster:importPick'](true);
  await s.handlers['roster:importPassword']({ evil: 1 }, 'yes');
  assert.deepEqual(s.got[TOPICS.ROSTER_IMPORT], [
    { filePath: 'C:\\picked\\kero.tama', includeUser: true },
    { filePath: 'C:\\picked\\kero.tama', password: '[object Object]', includeUser: true },
  ]);
});

test('ui prefs are coerced field by field; unknown fields are dropped', async () => {
  const s = setup();
  s.capture(TOPICS.UI_PREFS_SET);
  await s.handlers['ui:setPrefs']({ dnd: 'yes', motion: 3, quiet: { on: 1, from: '23:00:00:00', to: 8 }, __proto__evil: true, admin: true });
  const p = s.got[TOPICS.UI_PREFS_SET][0];
  assert.equal(p.dnd, true);
  assert.equal(p.motion, '3');
  assert.deepEqual(p.quiet, { on: true, from: '23:00', to: '8' });
  assert.equal('admin' in p, false);
  await s.handlers['ui:setPrefs'](null);
  assert.equal(s.got[TOPICS.UI_PREFS_SET][1].quiet, undefined);
});

test('links: allowed ones open, others come back as an error (no unhandled rejection)', async () => {
  const s = setup();
  assert.deepEqual(await s.handlers['link:open']('https://accounts.google.com/x'), { ok: true });
  const r = await s.handlers['link:open']('file:///C:/Windows/System32/calc.exe');
  assert.match(r.error, /not an allowed site/);
  assert.deepEqual(s.opened, ['https://accounts.google.com/x']);
});

test('terminal intents become bus requests with coerced values', async () => {
  const s = setup();
  s.capture(TOPICS.ENGINE_ANSWER_PERMISSION);
  s.capture(TOPICS.ENGINE_SEND);
  s.handlers['agent:permission']('7', 'yes', 'ok');
  s.handlers['agent:permission'](8, { x: 1 }, null);
  s.handlers['agent:send']({ text: 'hi' });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(s.got[TOPICS.ENGINE_ANSWER_PERMISSION], [{ id: 7, choice: 'yes', feedback: 'ok' }, { id: 8, choice: '[object Object]', feedback: undefined }]);
  assert.deepEqual(s.got[TOPICS.ENGINE_SEND], ['[object Object]']);
});

test('a failing fire-and-forget request becomes app.error, not an unhandled rejection', async () => {
  const s = setup();
  /** @type {any[]} */ const errs = [];
  s.bus.on(TOPICS.APP_ERROR, (e) => errs.push(e));
  s.bus.handle(TOPICS.ENGINE_INTERRUPT, () => { throw new Error('no engine'); });
  s.handlers['agent:interrupt']();
  await new Promise((r) => setImmediate(r));
  assert.equal(errs.length, 1);
  assert.equal(errs[0].topic, TOPICS.ENGINE_INTERRUPT);
});

test('state changes are pushed to the windows that show them', () => {
  const s = setup();
  s.bus.emit(TOPICS.PET_STATE_CHANGED, { hunger: 50 });
  s.bus.emit(TOPICS.UI_PREFS_CHANGED, { dnd: true });
  const names = s.sent.map(([w, n]) => `${w.id}:${n}`);
  assert.ok(names.includes('pet:pet.state'));
  assert.ok(names.includes('pet:ui.prefs') && names.includes('term:ui.prefs') && names.includes('chat:ui.prefs'));
});
