// @ts-check
// Voice (VOICE-1, TG-3, PET-8, D-022, D-042, D-043): turns the Tama's lines into speech. One setting, `lang`:
//   'en'  - Windows' built-in voice reads the English text (CharacterSpec pitch/rate);
//   'ja'  - Japanese dub: the line is translated in character by the composer (agy/Gemini, no Claude tokens) and
//           AivisSpeech / VOICEVOX reads it; without a running engine it falls back to 'en';
//   'off' - no voice on the desktop.
// Speaks chat replies and event lines on the desktop (not chats from the phone), stays quiet when muted, in /dnd,
// in a focus session or while she sleeps.
const { TOPICS } = require('../../bus-topics');

const DETECT_MS = 5 * 60000;
/** First start unpacks models and can take minutes; later starts take ~20 s. */
const ENGINE_BOOT_MS = 5 * 60000;
const ENGINE_POLL_MS = 3000;
const MAX_CHARS = 280;
const LANGS = ['en', 'ja', 'off'];
const CACHE = 60;
const JAPANESE = /[぀-ヿ㐀-䶿一-鿿]/;

/** Text → what should be spoken: no emoji, kaomoji, markdown, links or hidden markers. Pure. @param {string} s */
function speakable(s) {
  let t = String(s || '')
    .replace(/\[\[[^\]]*\]\]/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_`#>|]/g, '')
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/[(（][^()（）]{0,12}[)）]/g, (m) => (/[a-z]{3,}/i.test(m) ? m : ' ')) // (｡•̀ᴗ-)✧ style faces
    .replace(/[♡♥✧✦✨★☆♪~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/ ([!?.,])/g, '$1')
    .trim();
  if (t.length > MAX_CHARS) {
    const cut = t.slice(0, MAX_CHARS);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('。'));
    t = end > 80 ? cut.slice(0, end + 1) : `${cut}…`;
  }
  return t;
}

/**
 * @param {{
 *   bus: import('../../bus').BusInstance, device: import('../../platform/store/device').DeviceSettings,
 *   sapi: { synthesize: (text: string, o: any) => Promise<Buffer>, listVoices: () => Promise<any[]> },
 *   vv: ReturnType<typeof import('./vv-engine').createVvEngines>, tamaId: string,
 *   engineProc?: { start: () => { ok: boolean, reason?: string }, stop: () => void, find: () => string | null, owned: () => boolean },
 *   wait?: (ms: number) => Promise<void>,
 * }} deps
 */
function createVoice({ bus, device, sapi, vv, tamaId, engineProc, wait = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const prefs = () => {
    const p = { chat: true, events: true, gpu: true, speakerByTama: /** @type {Record<string, number>} */ ({}), ...(device.get().voice || {}) };
    // Older saves had enabled/anime; map them to the single language choice.
    if (!LANGS.includes(p.lang)) p.lang = p.enabled === false ? 'off' : p.anime === 'always' ? 'ja' : 'en';
    return p;
  };
  /** @type {Map<string, string>} English line -> Japanese dub (also reused for the phone voice note of the same reply). */
  const dubs = new Map();
  let warnedNoEngine = false;
  let booting = false;
  let stopped = false;

  /**
   * Japanese dub on → make sure an engine runs (start the installed headless one, hidden); off → stop the one Tama
   * started (D-044). Never touches an engine the user runs themselves.
   */
  async function syncEngine() {
    if (!engineProc) return;
    if (prefs().lang !== 'ja') { engineProc.stop(); return; }
    if (engines.length || booting) return;
    engines = await vv.detect().catch(() => []);
    if (engines.length) return;
    const r = engineProc.start();
    if (!r.ok) return;
    booting = true;
    try {
      for (let t = 0; t < ENGINE_BOOT_MS && !stopped && prefs().lang === 'ja'; t += ENGINE_POLL_MS) {
        await wait(ENGINE_POLL_MS);
        engines = await vv.detect().catch(() => []);
        if (engines.length) {
          // The first synthesis loads the voice model (~15 s); do it now so her first real line isn't late.
          const a = animeVoice();
          if (a) await vv.synthesize(a.engine, 'はい', a.speaker).catch(() => null);
          bus.emit(TOPICS.VOICE_CHANGED, status());
          return;
        }
      }
    } finally { booting = false; }
  }
  /** @type {import('./vv-engine').Engine[]} */ let engines = [];
  /** @type {any[]} */ let systemVoices = [];
  let fromPhone = false;

  async function detect() {
    engines = await vv.detect().catch(() => []);
    systemVoices = await sapi.listVoices().catch(() => []);
    return status();
  }

  /** The anime engine + speaker to use, or null. */
  function animeVoice() {
    const anime = engines[0];
    if (!anime) return null;
    const speaker = prefs().speakerByTama[tamaId] ?? (anime.speakers[0] && anime.speakers[0].styles[0] ? anime.speakers[0].styles[0].id : null);
    return speaker === null ? null : { engine: anime, speaker: Number(speaker) };
  }

  /** English line -> her Japanese line (in character, via the composer). Null when agy is unavailable. @param {string} text */
  async function dub(text) {
    if (JAPANESE.test(text)) return text;
    const hit = dubs.get(text);
    if (hit) return hit;
    const ja = await bus.request(TOPICS.BRAIN_COMPOSE, { kind: 'translate', seed: text }).catch(() => null);
    const out = ja && JAPANESE.test(String(ja)) ? speakable(String(ja)) : null;
    if (out) { dubs.set(text, out); if (dubs.size > CACHE) dubs.delete(String(dubs.keys().next().value)); }
    return out;
  }

  /**
   * @param {string} raw @param {any} [voiceOverride] VoiceSpec @param {'en'|'ja'} [langOverride]
   * @returns {Promise<{ wav: Buffer, engine: string, text: string, lang: 'en'|'ja' } | null>}
   */
  async function render(raw, voiceOverride, langOverride) {
    const text = speakable(raw);
    if (!text) return null;
    const ch = await bus.request(TOPICS.CHARACTER_GET).catch(() => null);
    const voice = voiceOverride || (ch && ch.spec && ch.spec.voice) || { pitch: 1, rate: 1, voiceGender: 'female' };
    const lang = langOverride || (prefs().lang === 'ja' ? 'ja' : 'en');
    if (lang === 'ja') {
      const a = animeVoice();
      if (!a) noEngineNotice();
      else {
        const ja = await dub(text);
        if (ja) {
          try {
            const wav = await vv.synthesize(a.engine, ja, a.speaker, { speed: voice.rate, pitch: voice.pitch });
            return { wav, engine: a.engine.name, text: ja, lang: 'ja' };
          } catch { engines = []; /* engine went away: fall back now, re-detect later */ }
        }
      }
    }
    // The Windows voices are English-only: don't feed them kana or kanji.
    const en = text.replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\u3000-\u303f\uff01-\uff60]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!en) return null;
    const wav = await sapi.synthesize(en, { gender: voice.voiceGender, pitch: voice.pitch, rate: voice.rate });
    return { wav, engine: 'Windows', text: en, lang: 'en' };
  }

  function noEngineNotice() {
    if (booting) return; // still warming up: English for now, no nagging
    if (warnedNoEngine) return;
    warnedNoEngine = true;
    const installed = engineProc && engineProc.find();
    bus.emit(TOPICS.BRAIN_NOTICE, { text: installed
      ? "My Japanese voice didn't start~ I'll use my English voice for now. (/voice ja to try again)"
      : "Japanese voice needs AivisSpeech installed on this PC~ I'll use my English voice until then." });
  }

  /** Speak on the desktop if allowed right now. @param {string} text @param {'chat'|'event'|'test'} purpose */
  async function say(text, purpose) {
    const p = prefs();
    if (purpose !== 'test') {
      if (p.lang === 'off' || (purpose === 'chat' && !p.chat) || (purpose === 'event' && !p.events)) return { ok: false, reason: 'off' };
      const [ui, prod, pet] = await Promise.all([
        bus.request(TOPICS.UI_PREFS_GET).catch(() => null), bus.request(TOPICS.PROD_GET).catch(() => null), bus.request(TOPICS.PET_GET).catch(() => null),
      ]);
      if (ui && (ui.mute || ui.dnd)) return { ok: false, reason: ui.mute ? 'muted' : 'dnd' };
      if (prod && prod.focus && prod.focus.phase === 'focus') return { ok: false, reason: 'focus' };
      if (pet && pet.state && pet.state.asleep) return { ok: false, reason: 'asleep' };
    }
    const r = await render(text).catch((e) => { bus.emit(TOPICS.APP_ERROR, { topic: 'voice', message: String(e.message || e) }); return null; });
    if (!r) return { ok: false, reason: 'error' };
    bus.emit(TOPICS.VOICE_PLAY, { wav: r.wav.toString('base64'), text: r.text, engine: r.engine });
    return { ok: true, engine: r.engine, lang: r.lang, text: r.text };
  }

  function status() {
    const p = prefs();
    return {
      lang: p.lang, chat: p.chat, events: p.events, gpu: p.gpu !== false, speaker: p.speakerByTama[tamaId] ?? null,
      engineInstalled: !!(engineProc && engineProc.find()), engineStartedByTama: !!(engineProc && engineProc.owned()), engineBooting: booting,
      engines: engines.map((e) => ({ id: e.id, name: e.name, version: e.version, speakers: e.speakers })),
      systemVoices,
    };
  }

  /** @param {{ lang?: string, chat?: boolean, events?: boolean, gpu?: boolean, speaker?: number | null }} p */
  function set(p) {
    const cur = prefs();
    /** @type {Record<string, any>} */ const patch = {};
    for (const k of ['chat', 'events', 'gpu']) if (typeof (/** @type {any} */ (p))[k] === 'boolean') patch[k] = (/** @type {any} */ (p))[k];
    if (LANGS.includes(String(p.lang))) { patch.lang = p.lang; warnedNoEngine = false; }
    const restart = typeof p.gpu === 'boolean' && p.gpu !== (cur.gpu !== false) && engineProc && engineProc.owned();
    if (p.speaker === null || Number.isInteger(p.speaker)) patch.speakerByTama = { ...cur.speakerByTama, [tamaId]: p.speaker };
    device.patch('voice', patch);
    if (restart && engineProc) { engineProc.stop(); engines = []; }
    if (patch.lang || restart) syncEngine().catch(() => null);
    const st = status();
    bus.emit(TOPICS.VOICE_CHANGED, st);
    return st;
  }

  function start() {
    detect().then(() => syncEngine()).catch(() => null);
    const timer = setInterval(() => { if (!booting) detect().catch(() => null); }, DETECT_MS);
    const offs = [
      bus.on(TOPICS.CHAT_EVENT, (/** @type {any} */ ev) => {
        if (ev.t !== 'message') return;
        if (ev.message.role === 'user') { fromPhone = String(ev.message.text).startsWith('📱'); return; }
        if (ev.message.role === 'tama' && !fromPhone) say(ev.message.text, 'chat').catch(() => null);
      }),
      bus.on(TOPICS.EVENT_SHOWN, (/** @type {any} */ e) => { if (e && e.text) say(e.text, 'event').catch(() => null); }),
      bus.handle(TOPICS.VOICE_SAY, (/** @type {any} */ p) => say(String((p && p.text) || ''), p && p.purpose === 'test' ? 'test' : 'chat')),
      bus.handle(TOPICS.VOICE_RENDER, async (/** @type {any} */ p) => {
        const r = await render(String((p && p.text) || ''), p && p.voice, p && (p.lang === 'en' || p.lang === 'ja') ? p.lang : undefined);
        return r ? { wav: r.wav.toString('base64'), engine: r.engine, text: r.text, lang: r.lang } : null;
      }),
      bus.handle(TOPICS.VOICE_STATUS, () => status()),
      bus.handle(TOPICS.VOICE_SET, (/** @type {any} */ p) => set(p || {})),
      bus.handle(TOPICS.VOICE_DETECT, () => detect()),
    ];
    return () => { stopped = true; clearInterval(timer); for (const off of offs) off(); if (engineProc) engineProc.stop(); };
  }

  return { start, say, render, detect, status, set, syncEngine };
}

module.exports = { createVoice, speakable, JAPANESE, LANGS };
