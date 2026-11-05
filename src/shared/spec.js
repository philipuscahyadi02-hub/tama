// @ts-check
// CharacterSpec: the complete, portable description of a Tama's look, personality and voice (D-020).
// normalizeSpec() is the gate every design passes through: anything unknown is dropped or replaced
// with a gender-appropriate default, so a sloppy or hostile LLM reply can never break the rig.
/**
 * @typedef {Object} CharacterSpec
 * @property {string} name
 * @property {'girl'|'boy'|'nonbinary'} gender
 * @property {{subject: string, object: string, possessive: string}} pronouns
 * @property {string} motif        one-line description ("frog-girl in a raincoat")
 * @property {string} designPrompt the user's own words
 * @property {{hairBack: string, hairFront: string, headwear: string, outfit: string, shoes: string,
 *   accessories: string[], ahoge: boolean, eyes: string}} parts
 * @property {Record<string, string>} palette  base colors (palette.BASE_KEYS)
 * @property {Record<string, string>} [paletteOverrides]  exact tokens (presets only)
 * @property {{energy: number, tsundere: number, formality: number, chaos: number}} personality  0..100
 * @property {{style: string, tics: string[], catchphrases: string[], emoji: string[], catchphraseRate: number}} speech
 * @property {{prompt: string, pitch: number, rate: number, voiceGender: 'female'|'male'|'neutral', notes: string}} voice
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./catalog'), require('./palette'));
  else (root.TamaShared = root.TamaShared || {}).spec = factory(root.TamaShared.catalog, root.TamaShared.palette);
}(globalThis, function (catalog, palette) {


  const PRONOUNS = {
    girl: { subject: 'she', object: 'her', possessive: 'her' },
    boy: { subject: 'he', object: 'him', possessive: 'his' },
    nonbinary: { subject: 'they', object: 'them', possessive: 'their' },
  };

  /** Defaults per gender; every part is available to everyone, these are just starting points. */
  const DEFAULT_PARTS = {
    girl: { hairBack: 'twintails', hairFront: 'kero', headwear: 'cat-ears', outfit: 'cardigan-skirt', shoes: 'loafers', accessories: [], ahoge: true, eyes: 'round' },
    boy: { hairBack: 'short', hairFront: 'messy', headwear: 'none', outfit: 'hoodie', shoes: 'sneakers', accessories: [], ahoge: true, eyes: 'round' },
    nonbinary: { hairBack: 'bob', hairFront: 'swept', headwear: 'bear-hood', outfit: 'overalls', shoes: 'sneakers', accessories: [], ahoge: true, eyes: 'round' },
  };
  const DEFAULT_PALETTE = { hair: '#ff8fbf', eyes: '#36a865', main: '#84d16d', accent: '#ffd34f', skin: '#ffe6d8', shoes: '#ffcf4a' };
  const SKIN_TONES = ['#ffe6d8', '#ffdcc2', '#f3c9a5', '#d9a77f', '#b07a52', '#8a5a3c'];

  /** Built-in Kero-chan (ported from kero-pet, D-016). paletteOverrides pin her exact original colors. */
  const KERO = {
    name: 'Kero-chan', gender: 'girl', motif: 'chibi frog-girl in a raincoat', designPrompt: '',
    parts: { hairBack: 'twintails', hairFront: 'kero', headwear: 'frog-hood', outfit: 'raincoat-dress', shoes: 'rainboots', accessories: [], ahoge: true, eyes: 'round' },
    palette: { hair: '#ff8fbf', eyes: '#36a865', main: '#84d16d', accent: '#ffd34f', skin: '#ffe6d8', shoes: '#ffcf4a' },
    paletteOverrides: {
      'hair-2': '#ffb8d6', 'hair-line': '#e8729f', 'hair-strand': '#ff7fb0', 'hair-shine': '#ffe0ee', brow: '#c9507e',
      'eye-1': '#1c5e3f', 'eye-2': '#36a865', 'eye-3': '#a8f5aa', 'eye-pupil': '#123a28', 'eye-glint': '#d2ffd6',
      'main-1': '#93dc7b', 'main-2': '#74c75f', 'main-line': '#5fb04c', 'main-dark': '#62b84e', 'main-light': '#c4f0b4',
      'accent-1': '#ffd34f', 'accent-line': '#e7a92a', 'accent-dark': '#f0b429', 'skin-shade': '#ffd9cc',
      'shoe-1': '#ffcf4a', 'shoe-line': '#e7a92a',
    },
    personality: { energy: 75, tsundere: 35, formality: 10, chaos: 40 },
    speech: { style: 'bubbly anime-speak with Japanese interjections', tics: ['kero~', 'ehehe'], catchphrases: ['yatta~!', 'ganbaru!'], emoji: ['🐸', '🎀', '✨'], catchphraseRate: 0.3 },
    voice: { prompt: 'bright, bubbly, a little squeaky', pitch: 1.5, rate: 1.1, voiceGender: 'female', notes: '' },
  };
  const PRESETS = { kero: KERO };

  /** @param {unknown} v @param {number} lo @param {number} hi @param {number} d */
  const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  /** @param {unknown} v @param {number} max @param {string} d */
  const str = (v, max, d) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : d);
  /** @param {unknown} v @param {number} n @param {number} max */
  const strs = (v, n, max) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, n).map((x) => x.trim().slice(0, max)) : []);
  /** @param {string} category @param {unknown} v @param {string} d */
  const part = (category, v, d) => (typeof v === 'string' && catalog.ids(category).includes(v) ? v : d);

  /**
   * Make any input (LLM output, old file, user edit) into a valid CharacterSpec.
   * @param {any} input @returns {CharacterSpec}
   */
  function normalizeSpec(input) {
    const i = input && typeof input === 'object' ? input : {};
    const gender = catalog.GENDERS.includes(i.gender) ? i.gender : 'girl';
    const dp = DEFAULT_PARTS[/** @type {'girl'|'boy'|'nonbinary'} */ (gender)];
    const p = i.parts && typeof i.parts === 'object' ? i.parts : {};
    const pal = i.palette && typeof i.palette === 'object' ? i.palette : {};
    /** @type {Record<string, string>} */
    const basePalette = {};
    for (const k of palette.BASE_KEYS) basePalette[k] = palette.isHex(pal[k]) ? pal[k].toLowerCase() : DEFAULT_PALETTE[k];
    const per = i.personality || {};
    const sp = i.speech || {};
    const vo = i.voice || {};
    // Filter + dedupe first, then cap, so junk entries can't push out valid ones.
    const accessories = [...new Set(strs(p.accessories, 20, 40).filter((a) => catalog.ids('accessories').includes(a)))].slice(0, 3);
    /** @type {CharacterSpec} */
    const spec = {
      name: str(i.name, 24, gender === 'boy' ? 'Tama-kun' : 'Tama-chan'),
      gender,
      pronouns: PRONOUNS[/** @type {'girl'|'boy'|'nonbinary'} */ (gender)],
      motif: str(i.motif, 80, ''),
      designPrompt: str(i.designPrompt, 400, ''),
      parts: {
        hairBack: part('hairBack', p.hairBack, dp.hairBack),
        hairFront: part('hairFront', p.hairFront, dp.hairFront),
        headwear: part('headwear', p.headwear, dp.headwear),
        outfit: part('outfit', p.outfit, dp.outfit),
        shoes: part('shoes', p.shoes, dp.shoes),
        accessories,
        ahoge: typeof p.ahoge === 'boolean' ? p.ahoge : dp.ahoge,
        eyes: part('eyes', p.eyes, dp.eyes),
      },
      palette: basePalette,
      personality: {
        energy: num(per.energy, 0, 100, 60), tsundere: num(per.tsundere, 0, 100, 20),
        formality: num(per.formality, 0, 100, 20), chaos: num(per.chaos, 0, 100, 30),
      },
      speech: {
        style: str(sp.style, 160, 'cheerful and friendly'),
        tics: strs(sp.tics, 4, 24), catchphrases: strs(sp.catchphrases, 4, 40), emoji: strs(sp.emoji, 5, 8),
        catchphraseRate: num(sp.catchphraseRate, 0, 1, 0.25),
      },
      voice: {
        prompt: str(vo.prompt, 300, ''),
        pitch: num(vo.pitch, 0.5, 2, gender === 'boy' ? 1 : 1.3),
        rate: num(vo.rate, 0.6, 1.6, 1),
        voiceGender: ['female', 'male', 'neutral'].includes(vo.voiceGender) ? vo.voiceGender : (gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : 'neutral'),
        notes: str(vo.notes, 200, ''),
      },
    };
    if (i.paletteOverrides && typeof i.paletteOverrides === 'object') {
      /** @type {Record<string, string>} */
      const o = {};
      for (const [k, v] of Object.entries(i.paletteOverrides)) if (/^[a-z0-9-]{1,20}$/.test(k) && palette.isHex(v)) o[k] = v;
      if (Object.keys(o).length) spec.paletteOverrides = o;
    }
    return spec;
  }

  /** @param {string} name */
  const preset = (name) => normalizeSpec(/** @type {any} */ (PRESETS)[name] || KERO);

  return { normalizeSpec, preset, PRESETS, PRONOUNS, DEFAULT_PARTS, DEFAULT_PALETTE, SKIN_TONES };
}));
