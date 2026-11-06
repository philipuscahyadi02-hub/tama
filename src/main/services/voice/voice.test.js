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
function fakeFetch(calls) {
  return /** @type {any} */ (async (/** @type {string} */ url, /** @type {any} */ init) => {
    calls.push(url);
    if (!url.startsWith('http://127.0.0.1:10101')) throw new Error('ECONNREFUSED');
    const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), arrayBuffer: async () => new Uint8Array([82, 73, 70, 70]).buffer });
    if (url.endsWith('/version')) return ok('1.2.0');
    if (url.endsWith('/speakers')) return ok([{ name: 'Anneli', styles: [{ name: 'Normal', id: 888 }, { name: 'Happy', id: 889 }] }]);
    if (url.includes('/audio_query')) return ok({ speedScale: 1, pitchScale: 0 });
    if (url.includes('/synthesis')) { calls.push(init.body); return ok(null); }
    return { ok: false, status: 404 };
  });
}

function setup(ui = {}) {
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
  const voice = createVoice({ bus, device, sapi, vv: createVvEngines({ fetch: fakeFetch(calls) }), tamaId: 't1' });
  return { bus, voice, calls, sapiCalls, played, device };
}

test('voice: English → Windows voice with the spec pitch/rate; Japanese → AivisSpeech; quiet rules', async () => {
  const s = setup();
  const st = await s.voice.detect();
  assert.equal(st.engines[0].name, 'AivisSpeech');
  assert.equal(st.engines[0].version, '1.2.0');
  let r = await s.voice.say('Hello there ✨', 'chat');
  assert.deepEqual(r, { ok: true, engine: 'Windows' });
  assert.deepEqual(s.sapiCalls[0], { t: 'Hello there', o: { gender: 'female', pitch: 1.3, rate: 1.1 } });
  r = await s.voice.say('おはよう！', 'chat');
  assert.equal(r.engine, 'AivisSpeech');
  assert.ok(s.calls.some((c) => c.includes('/synthesis?speaker=888')));
  assert.equal(s.played.length, 2);
  s.voice.set({ anime: 'always', speaker: 889 });
  r = await s.voice.say('Hello', 'chat');
  assert.equal(r.engine, 'AivisSpeech');
  assert.ok(s.calls.some((c) => c.includes('speaker=889')));
  s.voice.set({ chat: false });
  assert.deepEqual(await s.voice.say('Hello', 'chat'), { ok: false, reason: 'off' });
  assert.equal((await s.voice.say('Hello', 'test')).ok, true); // the test button ignores quiet rules
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
