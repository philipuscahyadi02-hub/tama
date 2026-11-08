// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createVoice, speakable } = require('./index');
const { splitSentences, quickStart, createLru } = require('./chunks');
const { detectMood, styleFor, parseDub, prosodyFor } = require('./emotion');
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

test('emotion: mood guess, style per mood, translator tag', () => {
  for (const [t, m] of [['zzz… so sleepy 💤', 'sleepy'], ['gomen… I forgot 🥺', 'sad'], ['hmph! baka 💢', 'angry'], ['ehehe, gotcha 😏', 'tease'],
    ['YAY!! we did it 🎉', 'excited'], ['thank you, I love it ♡', 'sweet'], ['Good morning!', 'happy'], ['okay, here is the plan', 'calm'], ['the file is in docs', 'normal']]) {
    assert.equal(detectMood(t), m, t);
  }
  const mao = [{ name: 'ノーマル', id: 1 }, { name: 'ふつー', id: 2 }, { name: 'あまあま', id: 3 }, { name: 'おちつき', id: 4 }, { name: 'からかい', id: 5 }, { name: 'せつなめ', id: 6 }];
  assert.equal(styleFor(mao, 1, 'sad'), 6);
  assert.equal(styleFor(mao, 1, 'tease'), 5);
  assert.equal(styleFor(mao, 1, 'sweet'), 3);
  assert.equal(styleFor(mao, 1, 'sleepy'), 4); // no sleepy style: calm is the next best
  assert.equal(styleFor(mao, 2, 'normal'), 2); // normal keeps the user's pick
  const zunda = [{ name: 'ノーマル', id: 3 }, { name: 'あまあま', id: 1 }, { name: 'ツンツン', id: 7 }, { name: 'ヘロヘロ', id: 75 }, { name: 'なみだめ', id: 76 }];
  assert.equal(styleFor(zunda, 3, 'angry'), 7);
  assert.equal(styleFor(zunda, 3, 'sad'), 76);
  assert.deepEqual(parseDub('happy | おはよう！'), { mood: 'happy', text: 'おはよう！' });
  assert.deepEqual(parseDub('[sad]｜ごめんね'), { mood: 'sad', text: 'ごめんね' });
  assert.deepEqual(parseDub('おはよう！'), { mood: null, text: 'おはよう！' });
  assert.ok(prosodyFor('sleepy').speed < 1 && prosodyFor('excited').speed > 1);
});

/** Fake AivisSpeech (and optionally VOICEVOX) engines on their HTTP API. */
function fakeFetch(calls, up = { aivis: true, voicevox: false }) {
  return /** @type {any} */ (async (/** @type {string} */ url, /** @type {any} */ init) => {
    calls.push(url);
    const id = url.startsWith('http://127.0.0.1:10101') ? 'aivis' : url.startsWith('http://127.0.0.1:50021') ? 'voicevox' : '';
    if (!id || !up[id]) throw new Error('ECONNREFUSED');
    const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), arrayBuffer: async () => new Uint8Array([82, 73, 70, 70]).buffer });
    if (url.endsWith('/version')) return ok(id === 'aivis' ? '1.2.0' : '0.26.1');
    if (url.endsWith('/speakers')) {
      return ok(id === 'aivis'
        ? [{ name: 'まお', speaker_uuid: 'u-mao', styles: [{ name: 'ノーマル', id: 888 }, { name: 'あまあま', id: 889 }, { name: 'せつなめ', id: 890 }] }]
        : [{ name: 'ずんだもん', speaker_uuid: 'u-zunda', styles: [{ name: 'ノーマル', id: 3 }, { name: 'ツンツン', id: 7 }, { name: 'ささやき', id: 22, type: 'streaming_talk' }, { name: 'ハミング', id: 99, type: 'frame_decode' }] }]);
    }
    if (url.includes('/audio_query')) return ok({ speedScale: 1, pitchScale: 0, intonationScale: 1 });
    if (url.includes('/synthesis')) { calls.push(init.body); return ok(null); }
    return { ok: false, status: 404 };
  });
}

/** @param {any} [ui] @param {{ up?: any, translate?: string | null, procs?: any, now?: () => number }} [o] */
function setup(ui = {}, { up = { aivis: true, voicevox: false }, translate = 'happy | おはよう！', procs = {}, now = undefined } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-voice-'));
  const bus = new Bus();
  const device = createDeviceSettings(createStore(dir));
  /** @type {string[]} */ const calls = [];
  /** @type {any[]} */ const sapiCalls = [];
  const sapi = { synthesize: async (/** @type {string} */ t, /** @type {any} */ o) => { sapiCalls.push({ t, o }); return Buffer.from('WAV'); }, listVoices: async () => [] };
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
  const voice = createVoice({ bus, device, sapi, vv: createVvEngines({ fetch: fakeFetch(calls, up) }), tamaId: 't1', procs, now, wait: () => new Promise((r) => setTimeout(r, 5)) });
  const lastBody = () => JSON.parse(String([...calls].reverse().find((c) => c.startsWith('{'))));
  return { bus, voice, calls, sapiCalls, played, device, composed, notices, up, lastBody };
}

test('voice: English = Windows voice with the spec pitch/rate nudged by mood', async () => {
  const s = setup();
  await s.voice.detect();
  assert.equal(s.voice.status().lang, 'en');
  const r = await s.voice.say('Hello there ✨', 'chat');
  assert.deepEqual([r.engine, r.mood], ['Windows', 'happy']);
  assert.equal(s.sapiCalls[0].t, 'Hello there');
  assert.ok(Math.abs(s.sapiCalls[0].o.pitch - 1.3 * 1.06) < 1e-9 && Math.abs(s.sapiCalls[0].o.rate - 1.1 * 1.04) < 1e-9);
  assert.equal((await s.voice.say('みんな、Hi!', 'chat')).text, 'Hi!'); // the Windows voice never gets kana
});

test('voice: Japanese dub picks the style for the translator\'s mood, applies tuning, caches, and can be turned plain', async () => {
  const s = setup();
  await s.voice.detect();
  s.voice.set({ lang: 'ja' });
  let r = await s.voice.say('Good morning!', 'chat');
  assert.deepEqual([r.engine, r.lang, r.text, r.mood, r.style], ['AivisSpeech', 'ja', 'おはよう！', 'happy', 'あまあま']);
  assert.ok(s.calls.some((c) => c.includes('/synthesis?speaker=889')));
  assert.equal(s.lastBody().speedScale, 1.04);
  const asked = () => s.composed.filter((c) => c.seed === 'Good morning!'); // (the translator warm-up line is separate)
  assert.deepEqual(asked(), [{ kind: 'translate', seed: 'Good morning!' }]);
  await s.voice.say('Good morning!', 'chat'); // cached
  assert.equal(asked().length, 1);
  s.voice.set({ tune: { speed: 1.2, pitch: 0.05 } });
  await s.voice.say('Good morning!', 'chat');
  assert.ok(Math.abs(s.lastBody().speedScale - 1.2 * 1.04) < 1e-9 && Math.abs(s.lastBody().pitchScale - 0.07) < 1e-9);
  s.voice.set({ moodStyles: false });
  r = await s.voice.say('Good morning!', 'chat');
  assert.equal(r.style, 'ノーマル');
  assert.equal((/** @type {any} */ (s.voice.status().pick)).moodMap.sad, 'Wistful (せつなめ)');
  s.voice.set({ lang: 'off' });
  assert.deepEqual(await s.voice.say('Hello', 'chat'), { ok: false, reason: 'off' });
  assert.equal((await s.voice.say('Hello', 'test')).ok, true); // the test command ignores the off switch
});

test('voice: picking a VOICEVOX character; only talk styles are listed', async () => {
  const s = setup({}, { up: { aivis: true, voicevox: true } });
  await s.voice.detect();
  const zunda = /** @type {any} */ (s.voice.status().voices.find((v) => v.engine === 'voicevox'));
  assert.deepEqual(zunda.styles.map((x) => x.name), ['ノーマル', 'ツンツン', 'ささやき']);
  s.voice.set({ lang: 'ja', pick: { engine: 'voicevox', uuid: 'u-zunda', style: 3 } });
  const r = await s.voice.say('Good morning!', 'chat');
  assert.equal(r.engine, 'VOICEVOX');
  assert.ok(s.calls.some((c) => c.startsWith('http://127.0.0.1:50021/synthesis?speaker=3')));
  assert.equal((/** @type {any} */ (s.voice.status().pick)).name, 'ずんだもん');
});

test('voice: Japanese without a running engine or translation falls back to English, with one notice', async () => {
  const s = setup({}, { up: { aivis: false, voicevox: false } });
  await s.voice.detect();
  s.voice.set({ lang: 'ja' });
  assert.equal((await s.voice.say('Good morning!', 'chat')).engine, 'Windows');
  await s.voice.say('Again!', 'chat');
  assert.equal(s.notices.length, 1);
  const t = setup({}, { translate: null });
  await t.voice.detect();
  t.voice.set({ lang: 'ja' });
  assert.equal((await t.voice.say('Good morning!', 'chat')).engine, 'Windows'); // agy down: still speaks
});

test('voice: old saves (enabled/anime/speaker id) map to the new settings', async () => {
  const s = setup();
  await s.voice.detect();
  s.device.patch('voice', { enabled: false });
  assert.equal(s.voice.status().lang, 'off');
  s.device.patch('voice', { enabled: true, anime: 'always', speakerByTama: { t1: 890 } });
  assert.equal(s.voice.status().lang, 'ja');
  assert.equal((/** @type {any} */ (s.voice.status().pick)).styleName, 'せつなめ');
});

test('voice: muted stays quiet; phone chats are not spoken on the desktop', async () => {
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

test('voice: a moment is spoken once, not again when its line is copied into the chat (bug fix)', async () => {
  const s = setup();
  const stop = s.voice.start();
  s.bus.emit('event.shown', { id: 'water', kind: 'nudge', text: 'Drink some water~' });
  s.bus.emit('chat.event', { t: 'message', message: { role: 'tama', text: 'Drink some water~', quiet: true } });
  s.bus.emit('chat.event', { t: 'message', message: { role: 'tama', text: 'Morning brief: 2 meetings' } });
  await new Promise((r) => setTimeout(r, 50));
  stop();
  assert.deepEqual(s.played.map((p) => p.text), ['Drink some water', 'Morning brief: 2 meetings']); // "~" is not spoken
});

test('voice engines: Japanese dub starts the chosen voice\'s engine; others run only briefly for previews; never stop engines Tama didn\'t start', async () => {
  /** @type {string[]} */ const log = [];
  /** @type {Record<string, boolean>} */ const up = { aivis: false, voicevox: false };
  const proc = (/** @type {'aivis'|'voicevox'} */ id) => {
    let mine = false;
    return { start: () => { log.push(`start ${id}`); mine = true; setTimeout(() => { up[id] = true; }, 5); return { ok: true }; },
      stop: () => { if (mine) { log.push(`stop ${id}`); mine = false; up[id] = false; } }, find: () => 'run.exe', owned: () => mine };
  };
  const s = setup({}, { up, procs: { aivis: proc('aivis'), voicevox: proc('voicevox') } });
  const stop = s.voice.start();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(log.length, 0); // English: nothing runs
  s.voice.set({ lang: 'ja' });
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(log, ['start aivis']);
  const pv = await s.voice.preview({ engine: 'voicevox', style: 3 });
  assert.equal(pv.ok, true);
  assert.deepEqual(log, ['start aivis', 'start voicevox']);
  assert.equal(s.played.length, 1); // the preview plays on the pet
  await s.voice.syncEngines(); // voicevox is leased for a few minutes: still running
  assert.deepEqual(log, ['start aivis', 'start voicevox']);
  s.voice.set({ lang: 'en' });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(log.includes('stop aivis'));
  assert.ok(!log.includes('stop voicevox')); // still leased
  stop();
  assert.ok(log.includes('stop voicevox')); // quitting stops everything Tama started
});

test('voice engines: muted for 5 minutes stops the Japanese engine; unmuting starts it again; starting muted waits', async () => {
  /** @type {string[]} */ const log = [];
  /** @type {Record<string, boolean>} */ const up = { aivis: false, voicevox: false };
  let mine = false;
  const aivis = { start: () => { log.push('start'); mine = true; setTimeout(() => { up.aivis = true; }, 5); return { ok: true }; },
    stop: () => { if (mine) { log.push('stop'); mine = false; up.aivis = false; } }, find: () => 'run.exe', owned: () => mine };
  let t = 1_000_000;
  const s = setup({}, { up, procs: { aivis }, now: () => t });
  s.device.patch('voice', { lang: 'ja' });
  const stop = s.voice.start();
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(log, ['start']);
  s.bus.emit('ui.prefs.changed', { mute: true });
  t += 4 * 60000;
  await s.voice.syncEngines();
  assert.deepEqual(log, ['start']); // a short mute keeps it ready
  t += 60000;
  await s.voice.syncEngines();
  assert.deepEqual(log, ['start', 'stop']);
  s.bus.emit('ui.prefs.changed', { mute: false });
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(log, ['start', 'stop', 'start']);
  stop();

  const log2 = /** @type {string[]} */ ([]);
  let mine2 = false;
  const aivis2 = { start: () => { log2.push('start'); mine2 = true; return { ok: true }; }, stop: () => { if (mine2) { log2.push('stop'); mine2 = false; } }, find: () => 'run.exe', owned: () => mine2 };
  const s2 = setup({ mute: true }, { up: { aivis: false, voicevox: false }, procs: { aivis: aivis2 } });
  s2.device.patch('voice', { lang: 'ja' });
  const stop2 = s2.voice.start();
  await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(log2, []); // started muted: the engine waits
  stop2();
});

test('names: English labels for characters and styles; kana names are romanized when unknown', () => {
  const { characterEn, styleEn, romaji } = require('./names');
  assert.equal(characterEn('ずんだもん'), 'Zundamon');
  assert.equal(characterEn('東北きりたん'), 'Tohoku Kiritan');
  assert.equal(styleEn('なみだめ'), 'Teary');
  assert.equal(styleEn('ツンツン'), 'Tsun-tsun (prickly)');
  assert.equal(romaji('きりたん'), 'Kiritan');
  assert.equal(romaji('ちょっと'), 'Chotto');
  assert.equal(romaji('シャウト'), 'Shauto');
  assert.equal(characterEn('新キャラ'), ''); // kanji: no guess, the page shows the original only
});

test('faster voice: sentences split naturally; tiny pieces join the next; LRU keeps recent items (SET-4)', () => {
  assert.deepEqual(splitSentences('えへへ。今日もいっしょにがんばろうね！あとでお茶しよっか？'), ['えへへ。今日もいっしょにがんばろうね！', 'あとでお茶しよっか？']);
  assert.deepEqual(splitSentences('Hi! I finished the report for you. Want me to send it?'), ['Hi! I finished the report for you.', 'Want me to send it?']);
  assert.deepEqual(splitSentences('おはよう'), ['おはよう']);
  assert.deepEqual(splitSentences('長い文章だよ。うん'), ['長い文章だよ。うん']);
  assert.deepEqual(splitSentences(''), []);
  assert.deepEqual(quickStart(['カエルはね、口からお水を飲まないで皮膚から直接きゅうしゅうするんだよ！', 'すごいでしょ？']),
    ['カエルはね、', '口からお水を飲まないで皮膚から直接きゅうしゅうするんだよ！', 'すごいでしょ？']);
  assert.deepEqual(quickStart(['短いね、うん']), ['短いね、うん']);
  assert.deepEqual(quickStart(['ちょっと長めの文だけど読点がひとつもないままずっと続くよ']), ['ちょっと長めの文だけど読点がひとつもないままずっと続くよ']);
  const c = createLru(2);
  c.set('a', 1); c.set('b', 2); c.get('a'); c.set('c', 3);
  assert.deepEqual([c.get('a'), c.get('b'), c.get('c')], [1, undefined, 3]);
});

test('faster voice: a dubbed line plays sentence by sentence as one line; repeats skip synthesis (SET-4)', async () => {
  const s = setup({}, { translate: 'happy | おはよう、今日もいい天気だね！いっしょに散歩に行こうよ！' });
  await s.voice.detect();
  s.voice.set({ lang: 'ja' });
  const r = await s.voice.say('Good morning! Let us go for a walk!', 'chat');
  assert.equal(r.ok, true);
  assert.ok(Number(r.firstMs) >= 0 && Number(r.totalMs) >= Number(r.firstMs));
  const parts = s.played.filter((p) => p.line === s.played[s.played.length - 1].line);
  assert.deepEqual(parts.map((p) => [p.part, p.parts, p.text]), [[0, 2, 'おはよう、今日もいい天気だね！'], [1, 2, 'いっしょに散歩に行こうよ！']]);
  const synths = () => s.calls.filter((c) => c.includes('/synthesis')).length;
  const before = synths();
  await s.voice.say('Good morning! Let us go for a walk!', 'chat');
  assert.equal(synths(), before); // translation and audio both cached
  const en = setup();
  await en.voice.detect();
  await en.voice.say('Hello there', 'chat'); await en.voice.say('Hello there', 'chat');
  assert.equal(en.sapiCalls.length, 1); // English audio cached too
  assert.equal(en.played[1].parts, 1);
});

test('faster voice: a chat reply that carries its own dub is spoken without a translation call (SET-4)', async (t) => {
  const s = setup();
  await s.voice.detect();
  t.after(s.voice.start());
  s.voice.set({ lang: 'ja' });
  await new Promise((r) => setTimeout(r, 20));
  s.composed.length = 0;
  s.bus.emit('chat.event', { t: 'message', message: { role: 'user', text: 'hi' } });
  s.bus.emit('chat.event', { t: 'message', message: { role: 'tama', text: 'Hello hello!', ja: 'excited | やっほー、元気だった？' } });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(s.composed.length, 0);
  const last = s.played.at(-1);
  assert.equal(last.text, 'やっほー、元気だった？');
  assert.equal(last.mood, 'excited');
});
