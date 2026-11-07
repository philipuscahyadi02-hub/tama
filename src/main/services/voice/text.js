// @ts-check
// Voice text helpers (QC-4: split out of index.js): what is worth speaking, and the cache of Japanese dubs (from the
// chat reply's own [[ja: …]] marker, D-049, or the composer's translation, D-043). Pure apart from the translate call.
const { parseDub } = require('./emotion');

const MAX_CHARS = 280;
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
 * English line → her Japanese line + mood, cached (the phone voice note reuses the desktop's dub).
 * @param {{ translate: (seed: string) => Promise<any> }} deps
 */
function createDubs({ translate }) {
  /** @type {Map<string, { mood: string | null, text: string }>} */
  const dubs = new Map();
  /** Keep a dub the chat brain wrote with its reply. @param {string} raw @param {string} tagged "<feeling> | <Japanese>" */
  function remember(raw, tagged) {
    const d = parseDub(tagged);
    if (!d.text || !JAPANESE.test(d.text)) return;
    dubs.set(speakable(raw), { mood: d.mood, text: speakable(d.text) });
    if (dubs.size > CACHE) dubs.delete(String(dubs.keys().next().value));
  }

  /** English line -> her Japanese line + mood (in character, via the composer). @param {string} text */
  async function dub(text) {
    if (JAPANESE.test(text)) return { mood: null, text };
    const hit = dubs.get(text);
    if (hit) return hit;
    const raw = await translate(text).catch(() => null);
    const d = parseDub(raw);
    if (!d.text || !JAPANESE.test(d.text)) return null;
    const out = { mood: d.mood, text: speakable(d.text) };
    dubs.set(text, out);
    if (dubs.size > CACHE) dubs.delete(String(dubs.keys().next().value));
    return out;
  }

  return { remember, dub };
}

module.exports = { speakable, JAPANESE, MAX_CHARS, createDubs };
