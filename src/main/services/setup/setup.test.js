// @ts-check
// Setup wizard (SHIP-4, D-059): status → items, first-run rule, actions only from the item's own list.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Bus } = require('../../bus');
const { createSetup, buildItems, needsSetup, INSTALL } = require('.');

const prov = (/** @type {Record<string, boolean>} */ on) => ({ providers: Object.entries(on).map(([id, available]) => ({ id, available })), caps: { chat: { using: on.agy ? 'agy' : null }, code: { using: on.claude ? 'claude' : null } } });
const byId = (/** @type {any[]} */ items) => Object.fromEntries(items.map((i) => [i.id, i]));

test('items: missing → install with the official command; installed but signed out → sign in; ready → no step', () => {
  const missing = byId(buildItems({ providers: prov({ claude: false, agy: false }), accounts: {}, voice: { engines: [] } }));
  assert.equal(missing.claude.state, 'missing');
  assert.deepEqual(missing.claude.actions.map((/** @type {any} */ a) => a.id), ['install', 'link']);
  assert.equal(missing.claude.actions[0].command, INSTALL.claude);
  assert.equal(missing.agy.actions[0].command, INSTALL.agy);
  assert.equal(missing.voice.state, 'optional');
  assert.equal(missing.google.state, 'optional');

  const half = byId(buildItems({ providers: prov({ claude: true, agy: true }), accounts: { claude: { loggedIn: false }, gemini: { email: null } }, voice: null }));
  assert.equal(half.claude.state, 'signin');
  assert.deepEqual(half.claude.actions.map((/** @type {any} */ a) => a.id), ['signin']);
  assert.equal(half.agy.state, 'signin');

  const ready = byId(buildItems({
    providers: prov({ claude: true, agy: true }),
    accounts: { claude: { loggedIn: true, email: 'me@x.com', plan: 'max' }, gemini: { email: 'me@gmail.com' }, google: { signedIn: true, email: 'me@gmail.com' }, telegram: { paired: true, bot: 'tama_bot' } },
    voice: { engines: [{ id: 'aivis', name: 'AivisSpeech', installed: true }] },
  }));
  for (const id of ['claude', 'agy', 'voice', 'google', 'telegram']) assert.equal(ready[id].state, 'ready', id);
  assert.match(ready.claude.detail, /me@x\.com \(max\)/);
  assert.equal(ready.claude.actions.length, 0);
  assert.match(ready.voice.detail, /AivisSpeech/);
});

test('first-run rule: open by itself only when chat or coding has nothing installed', () => {
  assert.equal(needsSetup(buildItems({ providers: prov({ claude: true, agy: true }), accounts: {}, voice: null })), false);
  assert.equal(needsSetup(buildItems({ providers: prov({ claude: true, agy: false }), accounts: {}, voice: null })), true);
  assert.equal(needsSetup(buildItems({ providers: prov({ claude: false, agy: true }), accounts: {}, voice: null })), true);
});

test('service: status over the bus, recheck asks providers to look again, actions run only listed steps, seen is saved', async () => {
  const bus = new Bus();
  const on = { claude: false, agy: true };
  /** @type {string[]} */ const asked = [];
  bus.handle('providers.get', () => { asked.push('get'); return prov(on); });
  bus.handle('providers.recheck', () => { asked.push('recheck'); on.claude = true; return prov(on); });
  bus.handle('accounts.get', (/** @type {any} */ p) => ({ claude: { loggedIn: !!(p && p.refresh) }, gemini: { email: 'g@x.com' } }));
  bus.handle('voice.status', () => ({ engines: [] }));
  let dev = /** @type {any} */ ({});
  /** @type {string[]} */ const ran = [];
  const setup = createSetup({
    bus, device: { get: () => dev, patch: (s, p) => { dev = { ...dev, [String(s)]: { ...(dev[String(s)] || {}), ...p } }; } },
    run: { install: (id) => ran.push(`install:${id}`), signIn: (id) => ran.push(`signin:${id}`), open: (id) => ran.push(`open:${id}`), link: (u) => ran.push(`link:${u}`) },
    now: () => 42,
  });
  const stop = setup.start();
  const st = await bus.request('setup.status');
  assert.equal(st.needsSetup, true);
  assert.equal(st.brains.code, null);
  assert.equal(st.seenAt, null);
  assert.deepEqual(await bus.request('setup.action', { item: 'claude', action: 'install' }), { ok: true, message: 'A window opened with the official installer. When it says done, press "Check again".' });
  assert.deepEqual(await bus.request('setup.action', { item: 'claude', action: 'signin' }), { error: 'That step is not available right now.' }); // not installed yet
  assert.deepEqual(await bus.request('setup.action', { item: 'agy', action: 'install' }), { error: 'That step is not available right now.' }); // already there
  assert.ok((await bus.request('setup.action', { item: 'voice', action: 'link-aivis' })).ok);
  await bus.request('setup.action', { item: 'telegram', action: 'open' });
  const after = await bus.request('setup.status', { recheck: true });
  assert.ok(asked.includes('recheck'));
  assert.equal(after.needsSetup, false);
  assert.equal(after.items.find((/** @type {any} */ i) => i.id === 'claude').state, 'ready');
  await bus.request('setup.seen');
  assert.equal((await bus.request('setup.status')).seenAt, 42);
  assert.deepEqual(ran, ['install:claude', 'link:https://aivis-project.com/', 'open:telegram']);
  stop();
});
