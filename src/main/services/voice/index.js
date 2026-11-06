// @ts-check
// Voice (VOICE-1, TG-3, PET-8, D-022, D-042..D-045): turns the Tama's lines into speech. One setting, `lang`:
//   'en'  - Windows' built-in voice reads the English text (CharacterSpec pitch/rate);
//   'ja'  - Japanese dub: the composer (agy/Gemini, no Claude tokens) rewrites the line in character and tags its mood;
//           the chosen AivisSpeech / VOICEVOX character reads it in the style that fits that mood;
//   'off' - no voice on the desktop.
// Each Tama has her own voice pick (engine + character + base style) and tuning (pitch, speed, intonation).
// Speaks chat replies and event lines on the desktop (not chats from the phone), stays quiet when muted, in /dnd,
// in a focus session or while she sleeps.
const { TOPICS } = require('../../bus-topics');
const { MOODS, detectMood, styleFor, prosodyFor, parseDub } = require('./emotion');
const { createEngineManager } = require('./engines');

const DETECT_MS = 5 * 60000;
const SYNC_MS = 60000;
const MAX_CHARS = 280;
const LANGS = ['en', 'ja', 'off'];
const CACHE = 60;
const JAPANESE = /[぀-ヿ㐀-䶿一-鿿]/;
const SAMPLE = 'こんにちは！今日もいっしょにがんばろうね。';

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

/** @param {number | undefined} v @param {number} lo @param {number} hi @param {number} d */
const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

/**
 * @param {{
 *   bus: import('../../bus').BusInstance, device: import('../../platform/store/device').DeviceSettings,
 *   sapi: { synthesize: (text: string, o: any) => Promise<Buffer>, listVoices: () => Promise<any[]> },
 *   vv: ReturnType<typeof import('./vv-engine').createVvEngines>, tamaId: string,
 *   procs?: Record<string, import('./engines').EngineProc>, wait?: (ms: number) => Promise<void>,
 * }} deps
 */
function createVoice({ bus, device, sapi, vv, tamaId, procs = {}, wait }) {
  const mgr = createEngineManager({ vv, procs, device, wait, onChange: () => bus.emit(TOPICS.VOICE_CHANGED, status()) });
  const prefs = () => {
    const p = { chat: true, events: true, gpu: true, moodStyles: true, pickByTama: /** @type {Record<string, any>} */ ({}),
      tuneByTama: /** @type {Record<string, any>} */ ({}), speakerByTama: /** @type {Record<string, number>} */ ({}), ...(device.get().voice || {}) };
    // Older saves had enabled/anime; map them to the single language choice.
    if (!LANGS.includes(p.lang)) p.lang = p.enabled === false ? 'off' : p.anime === 'always' ? 'ja' : 'en';
    return p;
  };
  /** @type {Map<string, { mood: string | null, text: string }>} English line -> dub (also reused for the phone voice note). */
  const dubs = new Map();
  /** @type {Map<string, any>} engine:uuid -> { policy, portrait } */
  const infos = new Map();
  let warnedNoEngine = false;
  /** @type {any[]} */ let systemVoices = [];
  let fromPhone = false;

  const tune = () => {
    const t = prefs().tuneByTama[tamaId] || {};
    return { pitch: num(t.pitch, -0.15, 0.15, 0), speed: num(t.speed, 0.5, 2, 1), intonation: num(t.intonation, 0, 2, 1) };
  };

  /** This Tama's voice: engine + character + base style (defaults to the first known voice). */
  function pick() {
    const p = prefs();
    const all = mgr.voices();
    const want = p.pickByTama[tamaId];
    const legacy = p.speakerByTama[tamaId];
    let sp = want && all.find((v) => v.engine === want.engine && v.uuid === want.uuid);
    if (!sp && Number.isInteger(legacy)) sp = all.find((v) => v.styles.some((s) => s.id === legacy));
    sp = sp || all.find((v) => v.engine === 'aivis') || all[0];
    if (!sp) return null;
    const base = (want && sp.styles.find((s) => s.id === want.style)) || (Number.isInteger(legacy) && sp.styles.find((s) => s.id === legacy)) || sp.styles[0];
    return { engine: sp.engine, speaker: sp, style: base ? base.id : 0 };
  }

  /** English line -> her Japanese line + mood (in character, via the composer). @param {string} text */
  async function dub(text) {
    if (JAPANESE.test(text)) return { mood: null, text };
    const hit = dubs.get(text);
    if (hit) return hit;
    const raw = await bus.request(TOPICS.BRAIN_COMPOSE, { kind: 'translate', seed: text }).catch(() => null);
    const d = parseDub(raw);
    if (!d.text || !JAPANESE.test(d.text)) return null;
    const out = { mood: d.mood, text: speakable(d.text) };
    dubs.set(text, out);
    if (dubs.size > CACHE) dubs.delete(String(dubs.keys().next().value));
    return out;
  }

  /** @param {any} engine @param {string} text @param {{ speaker: any, style: number }} who @param {string} mood */
  function synthJa(engine, text, who, mood) {
    const p = prefs();
    const t = tune();
    const pr = p.moodStyles ? prosodyFor(mood) : prosodyFor('normal');
    const style = p.moodStyles ? styleFor(who.speaker.styles, who.style, mood) : who.style;
    const styleName = (who.speaker.styles.find((/** @type {any} */ s) => s.id === style) || {}).name || '';
    return vv.synthesize(engine, text, style, { speedScale: t.speed * pr.speed, pitchScale: t.pitch + pr.pitch, intonationScale: t.intonation * pr.intonation })
      .then((wav) => ({ wav, styleName }));
  }

  /**
   * @param {string} raw @param {any} [voiceOverride] VoiceSpec @param {'en'|'ja'} [langOverride]
   * @returns {Promise<{ wav: Buffer, engine: string, text: string, lang: 'en'|'ja', mood: string, style?: string } | null>}
   */
  async function render(raw, voiceOverride, langOverride) {
    const text = speakable(raw);
    if (!text) return null;
    const ch = await bus.request(TOPICS.CHARACTER_GET).catch(() => null);
    const voice = voiceOverride || (ch && ch.spec && ch.spec.voice) || { pitch: 1, rate: 1, voiceGender: 'female' };
    const lang = langOverride || (prefs().lang === 'ja' ? 'ja' : 'en');
    let mood = detectMood(raw);
    if (lang === 'ja') {
      const who = pick();
      const engine = who && mgr.get(who.engine);
      if (!who || !engine) noEngine(who && who.engine);
      else {
        const d = await dub(text);
        if (d) {
          mood = d.mood || detectMood(`${raw} ${d.text}`);
          try {
            const r = await synthJa(engine, d.text, who, mood);
            return { wav: r.wav, engine: engine.name, text: d.text, lang: 'ja', mood, style: r.styleName };
          } catch { mgr.detect().catch(() => null); /* engine went away: English now, re-detect */ }
        }
      }
    }
    // The Windows voices are English-only: don't feed them kana or kanji.
    const en = text.replace(/[぀-ヿ㐀-䶿一-鿿　-〿！-｠]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!en) return null;
    const pr = prefs().moodStyles ? prosodyFor(mood) : prosodyFor('normal');
    const wav = await sapi.synthesize(en, { gender: voice.voiceGender, pitch: (voice.pitch || 1) * (1 + pr.pitch * 3), rate: (voice.rate || 1) * pr.speed });
    return { wav, engine: 'Windows', text: en, lang: 'en', mood };
  }

  /** @param {string | null | undefined} engineId */
  function noEngine(engineId) {
    if (engineId && mgr.isBooting(engineId)) return; // still warming up: English for now, no nagging
    if (engineId) mgr.ensure(engineId).catch(() => null);
    if (warnedNoEngine) return;
    warnedNoEngine = true;
    const installed = mgr.status().some((e) => e.installed);
    bus.emit(TOPICS.BRAIN_NOTICE, { text: installed
      ? "My Japanese voice is still waking up~ I'll use my English voice for a moment."
      : "Japanese voice needs AivisSpeech or VOICEVOX installed on this PC~ I'll use my English voice until then." });
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
    bus.emit(TOPICS.VOICE_PLAY, { wav: r.wav.toString('base64'), text: r.text, engine: r.engine, mood: r.mood });
    return { ok: true, engine: r.engine, lang: r.lang, text: r.text, mood: r.mood, style: r.style };
  }

  /**
   * Voice page preview: one character/style with the given tuning, played by the pet (mouth moves). Starts that
   * engine if needed and keeps it a few minutes. @param {{ engine: string, style: number, tune?: any, mood?: string, text?: string }} p
   */
  async function preview(p) {
    const id = String(p.engine || '');
    if (!procs[id] && !mgr.get(id)) return { ok: false, reason: 'unknown engine' };
    mgr.lease(id);
    const engine = await mgr.ensure(id);
    if (!engine) return { ok: false, reason: mgr.status().find((e) => e.id === id)?.installed ? 'engine did not start' : 'not installed' };
    if (!Number.isInteger(p.style)) return { ok: true }; // just load the engine's voices
    const t = { ...tune(), ...(p.tune || {}) };
    const pr = prosodyFor(String(p.mood || 'normal'));
    const wav = await vv.synthesize(engine, String(p.text || SAMPLE).slice(0, 200), Number(p.style), {
      speedScale: num(t.speed, 0.5, 2, 1) * pr.speed, pitchScale: num(t.pitch, -0.15, 0.15, 0) + pr.pitch, intonationScale: num(t.intonation, 0, 2, 1) * pr.intonation,
    });
    bus.emit(TOPICS.VOICE_PLAY, { wav: wav.toString('base64'), text: SAMPLE, engine: engine.name });
    return { ok: true };
  }

  /** Portrait + terms for a character (engine must be running; cached). @param {{ engine: string, uuid: string }} p */
  async function info(p) {
    const key = `${p.engine}:${p.uuid}`;
    if (infos.has(key)) return infos.get(key);
    const engine = mgr.get(String(p.engine));
    if (!engine) return null;
    const r = await vv.speakerInfo(engine, String(p.uuid)).catch(() => null);
    if (r) infos.set(key, r);
    return r;
  }

  function status() {
    const p = prefs();
    const who = pick();
    const engines = mgr.status();
    return {
      lang: p.lang, chat: p.chat, events: p.events, gpu: p.gpu !== false, moodStyles: p.moodStyles !== false, tune: tune(),
      pick: who ? { engine: who.engine, uuid: who.speaker.uuid, name: who.speaker.name, nameEn: who.speaker.en || '', style: who.style,
        styleName: (who.speaker.styles.find((s) => s.id === who.style) || {}).name || '',
        styleNameEn: (who.speaker.styles.find((s) => s.id === who.style) || {}).en || '',
        // Which style each mood uses with this voice (shown on the Voice page).
        moodMap: Object.fromEntries(MOODS.map((m) => {
          const st = who.speaker.styles.find((s) => s.id === styleFor(who.speaker.styles, who.style, m)) || { name: '', en: '' };
          return [m, st.en ? `${st.en} (${st.name})` : st.name];
        })) } : null,
      speaker: who ? who.style : null,
      engines, voices: mgr.voices(), systemVoices,
      engineInstalled: engines.some((e) => e.installed), engineStartedByTama: engines.some((e) => e.startedByTama), engineBooting: engines.some((e) => e.booting),
    };
  }

  const needed = () => (prefs().lang === 'ja' ? (pick() || { engine: Object.keys(procs)[0] || null }).engine : null);
  /** Start/stop engines for the current choice; warm the voice up so her first line isn't late. */
  async function syncEngines() {
    const id = needed();
    await mgr.sync(id);
    const who = pick();
    const engine = who && mgr.get(who.engine);
    if (engine && who && id === who.engine && !warmed.has(who.engine)) {
      warmed.add(who.engine);
      await vv.synthesize(engine, 'はい', who.style).catch(() => null);
    }
  }
  const warmed = new Set();

  /** @param {{ lang?: string, chat?: boolean, events?: boolean, gpu?: boolean, moodStyles?: boolean, speaker?: number | null,
   *   pick?: { engine: string, uuid: string, style: number } | null, tune?: { pitch?: number, speed?: number, intonation?: number } }} p */
  function set(p) {
    const cur = prefs();
    /** @type {Record<string, any>} */ const patch = {};
    for (const k of ['chat', 'events', 'gpu', 'moodStyles']) if (typeof (/** @type {any} */ (p))[k] === 'boolean') patch[k] = (/** @type {any} */ (p))[k];
    if (LANGS.includes(String(p.lang))) { patch.lang = p.lang; warnedNoEngine = false; }
    if (p.pick && typeof p.pick.engine === 'string' && typeof p.pick.uuid === 'string' && Number.isInteger(p.pick.style)) {
      patch.pickByTama = { ...cur.pickByTama, [tamaId]: { engine: p.pick.engine, uuid: p.pick.uuid, style: p.pick.style } };
    } else if (p.speaker === null || Number.isInteger(p.speaker)) {
      const sp = p.speaker === null ? null : mgr.voices().find((v) => v.styles.some((s) => s.id === p.speaker));
      patch.pickByTama = { ...cur.pickByTama, [tamaId]: sp ? { engine: sp.engine, uuid: sp.uuid, style: p.speaker } : null };
    }
    if (p.tune && typeof p.tune === 'object') {
      const t = { ...tune(), ...p.tune };
      patch.tuneByTama = { ...cur.tuneByTama, [tamaId]: { pitch: num(t.pitch, -0.15, 0.15, 0), speed: num(t.speed, 0.5, 2, 1), intonation: num(t.intonation, 0, 2, 1) } };
    }
    const restart = typeof p.gpu === 'boolean' && p.gpu !== (cur.gpu !== false);
    device.patch('voice', patch);
    if (restart) { for (const proc of Object.values(procs)) proc.stop(); warmed.clear(); mgr.detect().catch(() => null); }
    if (patch.lang || patch.pickByTama || restart) syncEngines().catch(() => null);
    const st = status();
    bus.emit(TOPICS.VOICE_CHANGED, st);
    return st;
  }

  async function detect() {
    await mgr.detect();
    systemVoices = await sapi.listVoices().catch(() => []);
    return status();
  }

  function start() {
    detect().then(() => syncEngines()).catch(() => null);
    const t1 = setInterval(() => { detect().catch(() => null); }, DETECT_MS);
    const t2 = setInterval(() => { syncEngines().catch(() => null); }, SYNC_MS); // ends preview leases
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
        return r ? { wav: r.wav.toString('base64'), engine: r.engine, text: r.text, lang: r.lang, mood: r.mood } : null;
      }),
      bus.handle(TOPICS.VOICE_STATUS, () => status()),
      bus.handle(TOPICS.VOICE_SET, (/** @type {any} */ p) => set(p || {})),
      bus.handle(TOPICS.VOICE_DETECT, () => detect()),
      bus.handle(TOPICS.VOICE_PREVIEW, (/** @type {any} */ p) => preview(p || {})),
      bus.handle(TOPICS.VOICE_INFO, (/** @type {any} */ p) => info(p || {})),
    ];
    return () => { clearInterval(t1); clearInterval(t2); for (const off of offs) off(); mgr.stopAll(); };
  }

  return { start, say, render, detect, status, set, preview, info, syncEngines };
}

module.exports = { createVoice, speakable, JAPANESE, LANGS, SAMPLE };
