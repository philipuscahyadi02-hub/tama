// @ts-check
// Keyword designer: works with no AI at all (offline, no Claude login, model error). Pure + deterministic
// for a given seed so it's testable. Quality is "decent", the LLM path is "good" (D-021).
const catalog = require('../../../shared/catalog');
const specMod = require('../../../shared/spec');

/** Simple seeded PRNG (mulberry32). @param {number} seed */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** @param {string} s */
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** @param {string} text @param {string} category */
function findPart(text, category) {
  for (const p of catalog.PARTS[category]) if (p.keywords.some((k) => text.includes(k))) return p.id;
  return null;
}

/** Longest names first so "sky blue hair" isn't read as "blue hair". */
const COLOR_ENTRIES = Object.entries(catalog.COLORS).sort((x, y) => y[0].length - x[0].length);

/** "blue hair", "hair is blue", "make the hair blue", "red eyes" → color for that feature. @param {string} text @param {string} feature */
function colorFor(text, feature) {
  for (const [name, hex] of COLOR_ENTRIES) {
    if ([`${name} ${feature}`, `${name}-${feature}`, `${feature} is ${name}`, `${feature} ${name}`, `${feature} to ${name}`]
      .some((p) => text.includes(p))) return hex;
  }
  return null;
}

/** First color word anywhere (for the outfit/main color). @param {string} text */
function anyColor(text) {
  /** @type {string | null} */
  let best = null;
  let at = Infinity;
  for (const [name, hex] of COLOR_ENTRIES) {
    const i = text.search(new RegExp(`\\b${name}\\b`));
    if (i >= 0 && i < at) { at = i; best = hex; }
  }
  return best;
}

const HAIR = ['#ff8fbf', '#2e2a38', '#f6d26b', '#8a5a44', '#c8cdd8', '#a77bdb', '#5b9cff', '#ff9a4d', '#8fe3c4'];
const EYES = ['#36a865', '#5b9cff', '#e8505b', '#a77bdb', '#e8b93c', '#3fb8b0', '#8a5a44'];
const MAIN = ['#84d16d', '#a77bdb', '#ff8fbf', '#5b9cff', '#ffd34f', '#3a4f8f', '#fff1f6', '#8a5a44', '#8fe3c4'];
const ACCENT = ['#ffd34f', '#e8505b', '#ff8fbf', '#5b9cff', '#ffffff', '#ff9a4d'];
const NAMES = ['Mochi', 'Yuki', 'Hana', 'Kuro', 'Sora', 'Momo', 'Riku', 'Nami', 'Pochi', 'Tsuki', 'Kiki', 'Haru'];

const TRAITS = [
  { k: ['sleepy', 'lazy', 'calm', 'chill'], p: { energy: 20, chaos: 15 }, tics: ['fuwaa~', 'zzz'], emoji: ['💤', '☁️'] },
  { k: ['energetic', 'hyper', 'bubbly', 'cheerful', 'happy'], p: { energy: 90, chaos: 55 }, tics: ['yay~!', 'ehehe'], emoji: ['✨', '🎉'] },
  { k: ['tsundere', 'grumpy', 'proud'], p: { tsundere: 85 }, tics: ['hmph', 'b-baka'], emoji: ['💢', '😤'] },
  { k: ['polite', 'elegant', 'princess', 'butler', 'formal'], p: { formality: 85, chaos: 10 }, tics: ['desu', 'if you please'], emoji: ['🌸', '🍵'] },
  { k: ['chaotic', 'gremlin', 'mischievous', 'prank'], p: { chaos: 90, energy: 80 }, tics: ['hehehe', 'oops~'], emoji: ['😈', '💥'] },
  { k: ['shy', 'quiet', 'timid'], p: { energy: 35, formality: 50 }, tics: ['u-um…', 'eto…'], emoji: ['🥺', '🌷'] },
];
const MOTIF_TICS = { 'cat-ears': ['nya~'], 'fox-ears': ['kon kon~'], 'frog-hood': ['kero~'], 'bunny-hood': ['pyon~'], 'bear-hood': ['kuma~'] };

/**
 * @param {{ gender: string, prompt: string, name?: string, seed?: number }} req
 * @returns {import('../../../shared/spec').CharacterSpec[]}  3 variants
 */
function designFromText({ gender, prompt, name, seed }) {
  const text = ` ${String(prompt || '').toLowerCase()} `;
  const r = rng(seed ?? hash(`${gender}|${text}`));
  const pick = (/** @type {any[]} */ a) => a[Math.floor(r() * a.length)];
  const dp = specMod.DEFAULT_PARTS[/** @type {'girl'|'boy'|'nonbinary'} */ (catalog.GENDERS.includes(/** @type {any} */ (gender)) ? gender : 'girl')];

  const personality = { energy: 60, tsundere: 20, formality: 20, chaos: 30 };
  const tics = [];
  const emoji = [];
  for (const t of TRAITS) {
    if (t.k.some((k) => text.includes(k))) { Object.assign(personality, t.p); tics.push(...t.tics); emoji.push(...t.emoji); }
  }

  const found = {
    hairBack: findPart(text, 'hairBack'), hairFront: findPart(text, 'hairFront'), headwear: findPart(text, 'headwear'),
    outfit: findPart(text, 'outfit'), shoes: findPart(text, 'shoes'), eyes: findPart(text, 'eyes'),
  };
  const accessories = catalog.PARTS.accessories.filter((a) => a.keywords.some((k) => text.includes(k))).map((a) => a.id).slice(0, 3);
  const hair = colorFor(text, 'hair');
  const eyes = colorFor(text, 'eyes') || colorFor(text, 'eye');
  const main = anyColor(text.replace(/\w+[ -](hair|eyes?)\b/g, ''));

  // Distinct suggested names per variant (unless the user gave one).
  const names = [...NAMES].sort(() => r() - 0.5).slice(0, 3);
  return [0, 1, 2].map((v) => {
    const parts = {
      hairBack: found.hairBack || (v === 0 ? dp.hairBack : pick(catalog.ids('hairBack'))),
      hairFront: found.hairFront || (v === 0 ? dp.hairFront : pick(catalog.ids('hairFront'))),
      headwear: found.headwear || (v === 0 ? dp.headwear : pick(catalog.ids('headwear'))),
      outfit: found.outfit || (v === 0 ? dp.outfit : pick(catalog.ids('outfit'))),
      shoes: found.shoes || (v === 0 ? dp.shoes : pick(catalog.ids('shoes'))),
      eyes: found.eyes || (personality.energy < 35 ? 'sleepy' : v === 2 ? pick(catalog.ids('eyes')) : 'round'),
      accessories: accessories.length ? accessories : v === 0 ? [] : [pick(catalog.ids('accessories'))],
      ahoge: v !== 2 || r() < 0.5,
    };
    const motifTics = MOTIF_TICS[/** @type {keyof typeof MOTIF_TICS} */ (parts.headwear)] || [];
    return specMod.normalizeSpec({
      name: name || names[v],
      gender,
      motif: String(prompt || '').slice(0, 80),
      designPrompt: prompt,
      parts,
      palette: {
        hair: hair || (v === 0 ? specMod.DEFAULT_PALETTE.hair : pick(HAIR)),
        eyes: eyes || pick(EYES),
        main: main || (v === 0 ? specMod.DEFAULT_PALETTE.main : pick(MAIN)),
        accent: pick(ACCENT),
        skin: v === 0 ? specMod.SKIN_TONES[0] : pick(specMod.SKIN_TONES.slice(0, 4)),
        shoes: pick(['#ffcf4a', '#3a3a4a', '#ffffff', '#e8505b', '#8a5a44']),
      },
      personality,
      speech: { style: 'cute and friendly', tics: [...new Set([...motifTics, ...tics])], catchphrases: ['yatta~!', 'leave it to me!'], emoji: [...new Set([...emoji, '✨'])] },
    });
  });
}

/**
 * Apply a change request to an existing spec without AI (colors + part keywords only).
 * @param {{ spec: any, instruction: string }} req
 */
function refineFromText({ spec, instruction }) {
  const text = ` ${String(instruction || '').toLowerCase()} `;
  const base = specMod.normalizeSpec(spec);
  const parts = { ...base.parts };
  for (const cat of ['hairBack', 'hairFront', 'headwear', 'outfit', 'shoes', 'eyes']) {
    const id = findPart(text, cat);
    if (id) /** @type {any} */ (parts)[cat] = id;
  }
  const addAcc = catalog.PARTS.accessories.filter((a) => a.keywords.some((k) => text.includes(k))).map((a) => a.id);
  if (addAcc.length) parts.accessories = [...new Set([...addAcc, ...parts.accessories])].slice(0, 3);
  if (/no (ahoge|antenna)/.test(text)) parts.ahoge = false;
  const palette = { ...base.palette };
  const hair = colorFor(text, 'hair');
  const eyes = colorFor(text, 'eyes') || colorFor(text, 'eye');
  if (hair) palette.hair = hair;
  if (eyes) palette.eyes = eyes;
  for (const f of ['outfit', 'hood', 'hoodie', 'dress', 'clothes']) {
    const c = colorFor(text, f);
    if (c) palette.main = c;
  }
  const { paletteOverrides: _drop, ...rest } = base; // a custom change ends the pinned preset colors
  const changed = specMod.normalizeSpec({ ...rest, parts, palette });
  const alternatives = designFromText({ gender: base.gender, prompt: `${base.designPrompt} ${instruction}`, name: base.name }).slice(1)
    .map((v) => specMod.normalizeSpec({ ...v, motif: base.motif, designPrompt: base.designPrompt }));
  return [changed, ...alternatives];
}

/** @param {{ voicePrompt: string, gender: string }} req */
function voiceFromText({ voicePrompt, gender }) {
  const t = String(voicePrompt || '').toLowerCase();
  let pitch = gender === 'boy' ? 1 : 1.3;
  let rate = 1;
  if (/high|squeak|tiny|childlike|cute/.test(t)) pitch += 0.3;
  if (/deep|low|husky|raspy/.test(t)) pitch -= 0.35;
  if (/fast|hyper|excited|energetic/.test(t)) rate += 0.2;
  if (/slow|sleepy|soft|calm|gentle|whisper/.test(t)) rate -= 0.15;
  const voiceGender = /male voice|boy voice|man/.test(t) ? 'male' : /female|girl voice|woman/.test(t) ? 'female' : gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : 'neutral';
  return {
    pitch: Math.max(0.5, Math.min(2, pitch)), rate: Math.max(0.6, Math.min(1.6, rate)),
    voiceGender, notes: 'keyword mapping (offline)', speech: null,
  };
}

module.exports = { designFromText, refineFromText, voiceFromText };
