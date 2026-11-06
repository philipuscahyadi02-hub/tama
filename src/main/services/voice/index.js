// @ts-check
// Voice (VOICE-1, TG-3, PET-8, D-022, D-042): turns the Tama's lines into speech. AivisSpeech / VOICEVOX (anime voices,
// local) when running, otherwise Windows' built-in voice with the CharacterSpec pitch/rate. Speaks chat replies and event
// lines on the desktop (not chats from the phone), stays quiet when muted, in /dnd, in a focus session or while she sleeps.
const { TOPICS } = require('../../bus-topics');

const DETECT_MS = 5 * 60000;
const MAX_CHARS = 280;
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
 * }} deps
 */
function createVoice({ bus, device, sapi, vv, tamaId }) {
  const prefs = () => ({ enabled: true, chat: true, events: true, anime: 'auto', speakerByTama: /** @type {Record<string, number>} */ ({}), ...(device.get().voice || {}) });
  /** @type {import('./vv-engine').Engine[]} */ let engines = [];
  /** @type {any[]} */ let systemVoices = [];
  let fromPhone = false;

  async function detect() {
    engines = await vv.detect().catch(() => []);
    systemVoices = await sapi.listVoices().catch(() => []);
    return status();
  }

  /** Which engine and settings to use for this text. @param {string} text @param {any} voice VoiceSpec */
  function choose(text, voice) {
    const p = prefs();
    const anime = engines[0];
    const speaker = p.speakerByTama[tamaId] ?? (anime && anime.speakers[0] && anime.speakers[0].styles[0] ? anime.speakers[0].styles[0].id : null);
    // Japanese engines read English badly (D-022): English lines use the Windows voice unless the user says always.
    const useAnime = !!anime && speaker !== null && p.anime !== 'never' && (p.anime === 'always' || JAPANESE.test(text));
    return useAnime ? { kind: 'anime', engine: anime, speaker, voice } : { kind: 'system', voice };
  }

  /** @param {string} raw @param {any} [voiceOverride] @returns {Promise<{ wav: Buffer, engine: string, text: string } | null>} */
  async function render(raw, voiceOverride) {
    const text = speakable(raw);
    if (!text) return null;
    const ch = await bus.request(TOPICS.CHARACTER_GET).catch(() => null);
    const voice = voiceOverride || (ch && ch.spec && ch.spec.voice) || { pitch: 1, rate: 1, voiceGender: 'female' };
    const c = choose(text, voice);
    if (c.kind === 'anime' && c.engine && c.speaker !== null) {
      try {
        const wav = await vv.synthesize(c.engine, text, Number(c.speaker), { speed: voice.rate, pitch: voice.pitch });
        return { wav, engine: c.engine.name, text };
      } catch { engines = []; /* engine went away: fall back and re-detect later */ }
    }
    const wav = await sapi.synthesize(text, { gender: voice.voiceGender, pitch: voice.pitch, rate: voice.rate });
    return { wav, engine: 'Windows', text };
  }

  /** Speak on the desktop if allowed right now. @param {string} text @param {'chat'|'event'|'test'} purpose */
  async function say(text, purpose) {
    const p = prefs();
    if (purpose !== 'test') {
      if (!p.enabled || (purpose === 'chat' && !p.chat) || (purpose === 'event' && !p.events)) return { ok: false, reason: 'off' };
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
    return { ok: true, engine: r.engine };
  }

  function status() {
    const p = prefs();
    return {
      ...p, speaker: p.speakerByTama[tamaId] ?? null,
      engines: engines.map((e) => ({ id: e.id, name: e.name, version: e.version, speakers: e.speakers })),
      systemVoices,
    };
  }

  /** @param {{ enabled?: boolean, chat?: boolean, events?: boolean, anime?: string, speaker?: number | null }} p */
  function set(p) {
    const cur = prefs();
    /** @type {Record<string, any>} */ const patch = {};
    for (const k of ['enabled', 'chat', 'events']) if (typeof (/** @type {any} */ (p))[k] === 'boolean') patch[k] = (/** @type {any} */ (p))[k];
    if (['auto', 'always', 'never'].includes(String(p.anime))) patch.anime = p.anime;
    if (p.speaker === null || Number.isInteger(p.speaker)) patch.speakerByTama = { ...cur.speakerByTama, [tamaId]: p.speaker };
    device.patch('voice', patch);
    return status();
  }

  function start() {
    detect().catch(() => null);
    const timer = setInterval(() => { detect().catch(() => null); }, DETECT_MS);
    const offs = [
      bus.on(TOPICS.CHAT_EVENT, (/** @type {any} */ ev) => {
        if (ev.t !== 'message') return;
        if (ev.message.role === 'user') { fromPhone = String(ev.message.text).startsWith('📱'); return; }
        if (ev.message.role === 'tama' && !fromPhone) say(ev.message.text, 'chat').catch(() => null);
      }),
      bus.on(TOPICS.EVENT_SHOWN, (/** @type {any} */ e) => { if (e && e.text) say(e.text, 'event').catch(() => null); }),
      bus.handle(TOPICS.VOICE_SAY, (/** @type {any} */ p) => say(String((p && p.text) || ''), p && p.purpose === 'test' ? 'test' : 'chat')),
      bus.handle(TOPICS.VOICE_RENDER, async (/** @type {any} */ p) => {
        const r = await render(String((p && p.text) || ''), p && p.voice);
        return r ? { wav: r.wav.toString('base64'), engine: r.engine, text: r.text } : null;
      }),
      bus.handle(TOPICS.VOICE_STATUS, () => status()),
      bus.handle(TOPICS.VOICE_SET, (/** @type {any} */ p) => set(p || {})),
      bus.handle(TOPICS.VOICE_DETECT, () => detect()),
    ];
    return () => { clearInterval(timer); for (const off of offs) off(); };
  }

  return { start, say, render, detect, status, set };
}

module.exports = { createVoice, speakable, JAPANESE };
