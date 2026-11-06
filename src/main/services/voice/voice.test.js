// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createVoice, speakable } = require('./index');
const { createVvEngines } = require('./vv-engine');
const { Bus } = require('../../bus');
const { createStore } = require('../../platform/store');
const { createDeviceSettings } = require('../../platform/store/device');

test('speakable: strips emoji, kaomoji, markdown, links and hidden markers', () => {
  assert.equal(speakable('**Ohayou~!** ✨ (｡•̀ᴗ-)✧ see https://x.y/z [[remember: likes tea]]'), 'Ohayou! see');
  assert.equal(speakable('Done 🎉 [the doc](https://docs.google.com/x) is ready ♡'), 'Done the doc is ready');
  assert.equal(speakable('I said (quietly) hi'), 'I said (quietly) hi');
  assert.equal(speakable('🍙✨'), '');
  const long = speakable(`${'This is a sentence. '.repeat(30)}`);
  assert.ok(long.length <= 281 && long.endsWith('.'));
});

/** A fake AivisSpeech engine on the HTTP API. */
function fakeFetch(calls, engine = true) {
  return /** @type {any} */ (async (/** @type {string} */ url, /** @type {any} */ init) => {
    calls.push(url);
    if (!engine || !url.startsWith('http://127.0.0.1:10101')) throw new Error('ECONNREFUSED');
    const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), arrayBuffer: async () => new Uint8Array([82, 73, 70, 70]).buffer });
    if (url.endsWith('/version')) return ok('1.2.0');
    if (url.endsWith('/speakers')) return ok([{ name: 'Anneli', styles: [{ name: 'Normal', id: 888 }, { name: 'Happy', id: 889 }] }]);
    if (url.includes('/audio_query')) return ok({ speedScale: 1, pitchScale: 0 });
    if (url.includes('/synthesis')) { calls.push(init.body); return ok(null); }
    return { ok: false, status: 404 };
  });
}

/** @param {any} [ui] @param {{ engine?: boolean, translate?: string | null }} [o] */
function setup(ui = {}, { engine = true, translate = 'おはよう！' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-voice-'));
  const bus = new Bus();
  const device = createDeviceSettings(createStore(dir));
  /** @type {string[]} */ const calls = [];
  /** @type {any[]} */ const sapiCalls = [];
  const sapi = { synthesize: async (/** @type {string} */ t, /** @type {any} */ o) => { sapiCalls.push({ t, o }); return Buffer.from('WAV'); }, listVoices: async () => [{ name: 'Zira', culture: 'en-US', gender: 'female' }] };
  bus.handle('character.get', () => ({ spec: { voice: { pitch: 1.3, rate: 1.1, voiceGender: 'female' } } }));
  bus.handle('ui.prefs.get', () => ({ mute: false, dnd: false, ...ui }));
  bus.handle('prod.get', () => ({ focus: null }));
  bus.handle('pet.get', () => ({ state: { asleep: false } }));
  /** @type {any[]} */ const played = [];
  bus.on('voice.play', (p) => played.push(p));
  /** @type {any[]} */ const composed = [];
  bus.handle('brain.compose', (p) => { composed.push(p); return translate; });
  /** @type {string[]} */ const notices = [];
  bus.on('brain.notice', (n) => notices.push(n.text));
  /** @type {any[]} */ const changes = [];
  bus.on('voice.changed', (st) => changes.push(st));
  const voice = createVoice({ bus, device, sapi, vv: createVvEngines({ fetch: fakeFetch(calls, engine) }), tamaId: 't1' });
  return { bus, voice, calls, sapiCalls, played, device, composed, notices, changes };
}

test('voice: en = Windows voice with the spec pitch/rate; ja = in-character dub read by AivisSpeech; off = quiet', async () => {
  const s = setup();
  const st = await s.voice.detect();
  assert.equal(st.engines[0].name, 'AivisSpeech');
  assert.equal(st.lang, 'en'); // default
  let r = await s.voice.say('Hello there ✨', 'chat');
  assert.equal(r.engine, 'Windows');
  assert.deepEqual(s.sapiCalls[0], { t: 'Hello there', o: { gender: 'female', pitch: 1.3, rate: 1.1 } });
  s.voice.set({ lang: 'ja' });
  r = await s.voice.say('Good morning!', 'chat');
  assert.deepEqual([r.engine, r.lang, r.text], ['AivisSpeech', 'ja', 'おはよう！']);
  assert.deepEqual(s.composed, [{ kind: 'translate', seed: 'Good morning!' }]);
  assert.ok(s.calls.some((c) => c.includes('/synthesis?speaker=888')));
  await s.voice.say('Good morning!', 'chat'); // cached: no second translation
  assert.equal(s.composed.length, 1);
  s.voice.set({ speaker: 889 });
  await s.voice.say('おやすみ', 'chat'); // already Japanese: no translation
  assert.equal(s.composed.length, 1);
  assert.ok(s.calls.some((c) => c.includes('speaker=889')));
  // The phone voice note can ask for a language explicitly.
  const en = await s.voice.render('Good morning!', undefined, 'en');
  assert.equal(en && en.engine, 'Windows');
  s.voice.set({ lang: 'off' });
  assert.deepEqual(await s.voice.say('Hello', 'chat'), { ok: false, reason: 'off' });
  assert.equal((await s.voice.say('Hello', 'test')).ok, true); // the test command ignores the off switch
  assert.equal(s.changes.at(-1).lang, 'off'); // the tray follows
});

test('voice: ja without a running engine or translation falls back to English, with one notice', async () => {
  const s = setup({}, { engine: false });
  await s.voice.detect();
  s.voice.set({ lang: 'ja' });
  const r = await s.voice.say('Good morning!', 'chat');
  assert.equal(r.engine, 'Windows');
  await s.voice.say('Again!', 'chat');
  assert.equal(s.notices.length, 1);
  assert.match(s.notices[0], /AivisSpeech/);
  const t = setup({}, { translate: null });
  await t.voice.detect();
  t.voice.set({ lang: 'ja' });
  assert.equal((await t.voice.say('Good morning!', 'chat')).engine, 'Windows'); // agy down: still speaks
  assert.equal((await s.voice.say('みんな、Hi!', 'chat')).text, 'Hi!'); // the Windows voice never gets kana
});

test('voice: old saves (enabled/anime) map to the language setting', () => {
  const s = setup();
  s.device.patch('voice', { enabled: false });
  assert.equal(s.voice.status().lang, 'off');
  s.device.patch('voice', { enabled: true, anime: 'always' });
  assert.equal(s.voice.status().lang, 'ja');
});

test('voice: muted / dnd stay quiet; phone chats are not spoken on the desktop', async () => {
  const m = setup({ mute: true });
  assert.deepEqual(await m.voice.say('Hi', 'event'), { ok: false, reason: 'muted' });
  const s = setup();
  const stop = s.voice.start();
  s.bus.emit('chat.event', { t: 'message', message: { role: 'user', text: '📱 hi from phone' } });
  s.bus.emit('chat.event', { t: 'message', message: { role: 'tama', text: 'Hi phone!' } });
  s.bus.emit('chat.event', { t: 'message', message: { role: 'user', text: 'hi from desk' } });
  s.bus.emit('chat.event', { t: 'message', message: { role: 'tama', text: 'Hi desk!' } });
  await new Promise((r) => setTimeout(r, 50));
  stop();
  assert.deepEqual(s.played.map((p) => p.text), ['Hi desk!']);
});
