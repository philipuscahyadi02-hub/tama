// @ts-check
// Provider layer (SHIP-8, D-054): preference order, fallback, opt-in, status, settings.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Bus } = require('../bus');
const { createProviders } = require('.');

function setup(/** @type {{ claude?: boolean, agy?: boolean, saved?: any }} */ o = {}) {
  let dev = /** @type {Record<string, any>} */ ({ providers: o.saved });
  const device = { get: () => dev, patch: (/** @type {string|null} */ s, /** @type {any} */ p) => { dev = s ? { ...dev, [s]: { ...(dev[s] || {}), ...p } } : { ...dev, ...p }; } };
  const on = { claude: o.claude !== false, agy: o.agy !== false };
  const bus = new Bus();
  /** @type {any[]} */ const changes = [];
  bus.on('providers.changed', (s) => changes.push(s));
  const f = () => ({});
  const providers = createProviders({
    bus, device, providers: [
      { id: 'claude', name: 'Claude Code', available: () => on.claude, optIn: ['chat', 'compose'], chat: f, compose: f, code: f, json: async () => ({}) },
      { id: 'agy', name: 'Gemini (Antigravity)', available: () => on.agy, chat: f, compose: f },
    ],
  });
  const stop = providers.start();
  return { providers, on, bus, changes, stop, dev: () => dev };
}
const id = (/** @type {any} */ p) => (p ? p.id : null);

test('defaults keep the D-029 split: chat/moments on agy, coding and designer on Claude', () => {
  const { providers, stop } = setup();
  assert.equal(id(providers.pick('chat')), 'agy');
  assert.equal(id(providers.pick('compose')), 'agy');
  assert.equal(id(providers.pick('code')), 'claude');
  assert.equal(id(providers.pick('json')), 'claude');
  stop();
});

test('Claude never chats without the opt-in, even when agy is missing', () => {
  const s = setup({ agy: false });
  assert.equal(s.providers.pick('chat'), null);
  assert.equal(s.providers.pick('compose'), null);
  const st = s.providers.status();
  assert.equal(st.caps.chat.using, null);
  assert.deepEqual(st.caps.chat.options.map((/** @type {any} */ x) => [x.id, x.available, x.optIn, x.allowed]), [['agy', false, false, true], ['claude', true, true, false]]);
  s.providers.set({ allow: { cap: 'chat', id: 'claude', on: true } });
  assert.equal(id(s.providers.pick('chat')), 'claude'); // fallback once allowed
  assert.equal(s.providers.pick('compose'), null);      // opt-in is per capability
  assert.equal(s.changes.length, 1);
  s.on.agy = true;
  assert.equal(id(s.providers.pick('chat')), 'agy');    // agy is still preferred when it comes back
  s.stop();
});

test('preferring a provider puts it first; unavailable ones are skipped; agy never codes', () => {
  const s = setup();
  s.providers.set({ allow: { cap: 'chat', id: 'claude', on: true } });
  s.providers.set({ prefer: { cap: 'chat', id: 'claude' } });
  assert.equal(id(s.providers.pick('chat')), 'claude');
  assert.deepEqual(s.dev().providers.order.chat, ['claude', 'agy']);
  s.on.claude = false;
  assert.equal(id(s.providers.pick('chat')), 'agy');
  assert.equal(s.providers.pick('code'), null);
  s.providers.set({ prefer: { cap: 'code', id: 'agy' } }); // agy has no code capability
  s.on.claude = true;
  assert.equal(id(s.providers.pick('code')), 'claude');
  s.stop();
});

test('bad input is ignored; saved prefs with unknown ids are tolerated; a throwing check counts as unavailable', async () => {
  const s = setup({ saved: { order: { chat: ['ghost', 'agy'] }, allow: ['ghost:chat'] } });
  assert.equal(id(s.providers.pick('chat')), 'agy');
  const before = JSON.stringify(s.dev().providers);
  s.providers.set(/** @type {any} */ ({ prefer: { cap: 'hack', id: 'agy' }, allow: { cap: 'chat', id: 'ghost', on: true } }));
  assert.equal(JSON.stringify(s.dev().providers.order), JSON.stringify(JSON.parse(before).order));
  const st = await s.bus.request('providers.set', { prefer: { cap: 'chat', id: 'agy' } });
  assert.equal(st.caps.chat.using, 'agy');
  const boom = createProviders({ device: { get: () => ({}), patch: () => {} }, providers: [{ id: 'x', name: 'X', available: () => { throw new Error('no'); }, chat: () => ({}) }] });
  assert.equal(boom.pick('chat'), null);
  s.stop();
});
