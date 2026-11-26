// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic');
const { createMusic } = require('.');
const { Bus } = require('../../bus');
const { TOPICS } = require('../../bus-topics');

const ORIGIN = `chrome-extension://${'a'.repeat(32)}`;
const tick = () => new Promise((r) => setImmediate(r));

/** A fake extension connection. @param {string} [origin] */
function fakeConn(origin = ORIGIN) {
  /** @type {any[]} */ const sent = [];
  /** @type {Array<(m: any) => void>} */ const onMsg = [];
  /** @type {Array<() => void>} */ const onEnd = [];
  let closed = false;
  return {
    sent, get closed() { return closed; },
    conn: {
      origin, send: (/** @type {any} */ m) => sent.push(m), close: () => { if (!closed) { closed = true; onEnd.forEach((f) => f()); } },
      onMessage: (/** @type {any} */ f) => onMsg.push(f), onClose: (/** @type {any} */ f) => onEnd.push(f),
    },
    msg: (/** @type {any} */ m) => onMsg.forEach((f) => f(m)),
  };
}

function setup({ mediaNow = /** @type {any} */ (null) } = {}) {
  const bus = new Bus();
  /** @type {Record<string, string>} */ const store = {};
  const secrets = { get: (/** @type {string} */ k) => store[k] ?? null, set: (/** @type {string} */ k, /** @type {string} */ v) => { store[k] = v; }, delete: (/** @type {string} */ k) => { delete store[k]; } };
  /** @type {any[]} */ const mediaCalls = [];
  const media = {
    available: () => true,
    now: async () => mediaNow,
    art: async () => 'data:image/png;base64,AA',
    control: async (/** @type {string} */ app, /** @type {string} */ what, /** @type {number|undefined} */ ms) => { mediaCalls.push([app, what, ms]); return true; },
    stop: () => {},
  };
  /** @type {any} */ let onConnection = null;
  /** @type {any} */ let verify = null;
  const startWs = async (/** @type {any} */ o) => { onConnection = o.onConnection; verify = o.verifyOrigin; return { port: 47821, close: () => {} }; };
  /** @type {string[]} */ const opened = [];
  const music = createMusic({ bus, secrets, media, startWs, openExternal: (u) => opened.push(u) });
  /** @type {any[]} */ const events = [];
  bus.on(TOPICS.MUSIC_CHANGED, (/** @type {any} */ e) => events.push(e.state));
  const stop = music.start();
  return { bus, music, store, mediaCalls, opened, events, stop, connect: (/** @type {any} */ c) => onConnection(c), verify: (/** @type {string} */ o) => verify(o) };
}

const extSong = (/** @type {any} */ o = {}) => ({ title: 'Idol', artist: 'YOASOBI', album: 'Idol', art: 'https://lh3.googleusercontent.com/abc=w544-h544', videoId: 'ZRtdQ81jPUQ', playing: true, position: 1000, duration: 213000, volume: 80, muted: false, repeat: 'off', like: 'none', queue: [{ title: 'Idol', artist: 'YOASOBI', current: true }, { title: 'Yoru ni Kakeru', artist: 'YOASOBI' }], lyrics: null, health: { missing: [] }, ...o });

test('cleanControl: only known actions, values coerced and clamped, links limited to YouTube Music', () => {
  assert.deepEqual(L.cleanControl({ action: 'next' }), { action: 'next' });
  assert.deepEqual(L.cleanControl({ action: 'volume', value: 250 }), { action: 'volume', value: 100 });
  assert.deepEqual(L.cleanControl({ action: 'seek', value: '61500' }), { action: 'seek', value: 61500 });
  assert.deepEqual(L.cleanControl({ action: 'jump', value: 3.7 }), { action: 'jump', value: 3 });
  assert.ok('error' in L.cleanControl({ action: 'constructor' }));
  assert.ok('error' in L.cleanControl({ action: 'seek', value: 'soon' }));
  assert.ok('error' in L.cleanControl({ action: 'open', value: 'https://evil.example/' }));
  assert.ok('error' in L.cleanControl({ action: 'open', value: 'https://music.youtube.com/watch?v=x"><script>' }));
  assert.deepEqual(L.cleanControl({ action: 'open', value: 'https://music.youtube.com/playlist?list=PL1' }), { action: 'open', value: 'https://music.youtube.com/playlist?list=PL1' });
});

test('cleanExtState: rebuilds untrusted page data with types and caps; foreign cover hosts dropped', () => {
  const s = L.cleanExtState(extSong({ title: 'x'.repeat(999), art: 'https://evil.example/a.png', volume: 999, repeat: 'sideways', videoId: '../etc', queue: new Array(80).fill({ title: 't', art: 'javascript:1' }) }), 5);
  assert.ok(s);
  assert.equal(s.title.length, 300);
  assert.equal(s.art, '');
  assert.equal(s.volume, 100);
  assert.equal(s.repeat, null);
  assert.equal(s.videoId, '');
  assert.equal(s.queue.length, 50);
  assert.equal(s.queue[0].art, '');
  assert.equal(s.at, 5, 'times use Tama\'s clock');
  assert.equal(L.cleanExtState({ playing: true }, 0), null, 'no title = nothing playing');
});

test('changed: the moving position alone is not news, a seek is', () => {
  const a = /** @type {any} */ (L.cleanExtState(extSong({ position: 1000 }), 0));
  assert.equal(L.changed(a, { ...a, position: 11000, at: 10000 }), false);
  assert.equal(L.changed(a, { ...a, position: 60000, at: 10000 }), true);
  assert.equal(L.changed(a, { ...a, like: 'like' }), true);
  assert.equal(L.changed(null, a), true);
});

test('pairing: only extension origins, a one-time code, then the key from the same origin only', async () => {
  const t = setup();
  assert.equal(t.verify(ORIGIN), true);
  assert.equal(t.verify('https://music.youtube.com'), false, 'web pages can never connect');
  assert.equal(t.verify('chrome-extension://short'), false);

  const first = fakeConn();
  t.connect(first.conn);
  first.msg({ t: 'hello' });
  assert.equal(first.sent[0].t, 'need-code');

  const { code } = await t.bus.request(TOPICS.MUSIC_PAIR);
  const wrong = fakeConn();
  t.connect(wrong.conn);
  wrong.msg({ t: 'hello', code: 'NOPE00' });
  assert.equal(wrong.sent[0].t, 'denied');

  const good = fakeConn();
  t.connect(good.conn);
  good.msg({ t: 'hello', code });
  assert.equal(good.sent[0].t, 'paired');
  const key = good.sent[0].key;
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal((await t.bus.request(TOPICS.MUSIC_GET)).extension.connected, true);

  const reuse = fakeConn();
  t.connect(reuse.conn);
  reuse.msg({ t: 'hello', code });
  assert.equal(reuse.sent[0].t, 'denied', 'codes are single-use');

  const thief = fakeConn(`chrome-extension://${'b'.repeat(32)}`);
  t.connect(thief.conn);
  thief.msg({ t: 'hello', key });
  assert.equal(thief.sent[0].t, 'denied', 'a key only works from the extension that paired');

  const back = fakeConn();
  t.connect(back.conn);
  back.msg({ t: 'hello', key });
  assert.equal(back.sent[0].t, 'welcome');
  assert.equal(good.closed, true, 'the newest connection replaces the old one');
  t.stop();
});

test('five wrong codes cancel the code; anything before hello closes the connection', async () => {
  const t = setup();
  const { code } = await t.bus.request(TOPICS.MUSIC_PAIR);
  for (let i = 0; i < 5; i++) { const c = fakeConn(); t.connect(c.conn); c.msg({ t: 'hello', code: `BAD00${i}` }); }
  const late = fakeConn(); t.connect(late.conn); late.msg({ t: 'hello', code });
  assert.equal(late.sent[0].t, 'denied');
  const rude = fakeConn(); t.connect(rude.conn); rude.msg({ t: 'state', state: extSong() });
  assert.equal(rude.closed, true);
  t.stop();
});

/** Pair a fake extension and return it. @param {ReturnType<typeof setup>} t */
async function pairedExt(t) {
  const { code } = await t.bus.request(TOPICS.MUSIC_PAIR);
  const c = fakeConn(); t.connect(c.conn); c.msg({ t: 'hello', code });
  return c;
}

test('extension state becomes the music state; controls go to the extension and come back with results', async () => {
  const t = setup();
  const c = await pairedExt(t);
  c.msg({ t: 'state', tabs: 1, state: extSong() });
  assert.equal(t.events.at(-1)?.title, 'Idol');
  assert.equal(t.events.at(-1)?.controls.queue, true);

  const p = t.bus.request(TOPICS.MUSIC_CONTROL, { action: 'like' });
  await tick();
  const cmd = c.sent.find((m) => m.t === 'cmd');
  assert.deepEqual({ action: cmd.action, value: cmd.value }, { action: 'like', value: undefined });
  c.msg({ t: 'result', id: cmd.id, ok: true });
  assert.deepEqual(await p, { ok: true, error: undefined, lyrics: undefined });

  c.conn.close();
  assert.equal(t.events.at(-1), null, 'disconnecting clears the extension\'s song');
  t.stop();
});

test('without the extension: Windows media session, basic controls only, links open in the browser', async () => {
  const t = setup({ mediaNow: { app: 'Chrome', title: 'Gratitude', artist: 'Megan', album: 'Harp', hasArt: true, playing: true, position: 5000, duration: 300000, at: 0, canSeek: true, canNext: true, canPrev: true } });
  await t.music.poll();
  const s = t.events.at(-1);
  assert.equal(s.source, 'media');
  assert.equal(s.art, 'data:image/png;base64,AA');
  assert.deepEqual(await t.bus.request(TOPICS.MUSIC_CONTROL, { action: 'seek', value: 30000 }), { ok: true });
  assert.deepEqual(t.mediaCalls[0], ['Chrome', 'seek', 30000]);
  const r = await t.bus.request(TOPICS.MUSIC_CONTROL, { action: 'like' });
  assert.equal(r.ok, false);
  assert.match(r.error, /extension/);
  await t.bus.request(TOPICS.MUSIC_CONTROL, { action: 'open', value: 'https://music.youtube.com/watch?v=ZRtdQ81jPUQ' });
  assert.deepEqual(t.opened, ['https://music.youtube.com/watch?v=ZRtdQ81jPUQ']);
  t.stop();
});

test('unpair forgets the key and tells the extension', async () => {
  const t = setup();
  const c = await pairedExt(t);
  await t.bus.request(TOPICS.MUSIC_UNPAIR);
  assert.equal(t.store['music.extension'], undefined);
  assert.ok(c.sent.some((m) => m.t === 'unpaired'));
  assert.equal(c.closed, true);
  t.stop();
});

test('one-click pairing: the extension asks, the desktop answer decides (D-070)', async () => {
  const t = setup();
  /** @type {any[]} */ const asks = [];
  t.bus.on(TOPICS.MUSIC_PAIR_ASK, (/** @type {any} */ p) => asks.push(p));

  const a = fakeConn(); t.connect(a.conn); a.msg({ t: 'hello', ask: true });
  assert.equal(a.sent[0].t, 'waiting');
  assert.equal(a.closed, false, 'the line stays open while the user decides');
  assert.ok(asks[0].until > 0);

  const b = fakeConn(); t.connect(b.conn); b.msg({ t: 'hello', ask: true });
  assert.equal(b.sent[0].t, 'denied', 'one question at a time');

  assert.deepEqual(await t.bus.request(TOPICS.MUSIC_PAIR_ANSWER, { allow: true }), { ok: true, allowed: true });
  assert.equal(a.sent[1].t, 'paired');
  assert.match(a.sent[1].key, /^[0-9a-f]{64}$/);
  assert.equal(asks.at(-1).until, 0, 'the pet drops the question');
  assert.equal((await t.bus.request(TOPICS.MUSIC_GET)).extension.connected, true);
  t.stop();
});

test('one-click pairing: no answer or "no" pairs nothing; an answer without a question does nothing', async () => {
  const t = setup();
  assert.equal((await t.bus.request(TOPICS.MUSIC_PAIR_ANSWER, { allow: true })).ok, false);
  const a = fakeConn(); t.connect(a.conn); a.msg({ t: 'hello', ask: true });
  await t.bus.request(TOPICS.MUSIC_PAIR_ANSWER, { allow: false });
  assert.equal(a.sent[1].t, 'denied');
  assert.equal(a.closed, true);
  assert.equal(t.store['music.extension'], undefined);
  t.stop();
});
