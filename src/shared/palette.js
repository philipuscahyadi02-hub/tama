// @ts-check
// Character palette: 6 base colors → the CSS variables the rig paints with (D-020).
// Shared by main (validation, tests) and renderer (plain <script>, registers TamaShared.palette).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.TamaShared = root.TamaShared || {}).palette = factory();
}(globalThis, function () {
  /** The base colors a CharacterSpec stores. */
  const BASE_KEYS = /** @type {const} */ (['hair', 'eyes', 'main', 'accent', 'skin', 'shoes']);

  const HEX = /^#([0-9a-f]{6})$/i;
  /** @param {unknown} v */
  const isHex = (v) => typeof v === 'string' && HEX.test(v);

  /** @param {string} hex @returns {[number, number, number]} */
  function toRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /** @param {number[]} rgb */
  const toHex = (rgb) => `#${rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`;

  /** @param {number} r @param {number} g @param {number} b @returns {[number, number, number]} h 0..360, s,l 0..1 */
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s, l];
  }

  /** @param {number} h @param {number} s @param {number} l @returns {number[]} */
  function hslToRgb(h, s, l) {
    const k = (/** @type {number} */ n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (/** @type {number} */ n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }

  /**
   * Shift lightness (dl in -1..1) and optionally saturation. Anime shading: darker = a bit more saturated.
   * @param {string} hex @param {number} dl @param {number} [ds]
   */
  function shade(hex, dl, ds = dl < 0 ? 0.08 : -0.05) {
    const [h, s, l] = rgbToHsl(...toRgb(hex));
    return toHex(hslToRgb(h, Math.max(0, Math.min(1, s + ds)), Math.max(0, Math.min(1, l + dl))));
  }

  /** Mix two colors (t = 0 → a, 1 → b). @param {string} a @param {string} b @param {number} t */
  function mix(a, b, t) {
    const x = toRgb(a);
    const y = toRgb(b);
    return toHex(x.map((c, i) => c + (y[i] - c) * t));
  }

  /** Relative luminance 0..1. @param {string} hex */
  function luminance(hex) {
    const [r, g, b] = toRgb(hex).map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Base colors → CSS variable map. `overrides` lets a preset pin exact tokens (Kero-chan does).
   * @param {Record<string, string>} base
   * @param {Record<string, string>} [overrides]
   * @returns {Record<string, string>}  e.g. { '--hair-1': '#ff8fbf', ... }
   */
  function derive(base, overrides = {}) {
    const { hair, eyes, main, accent, skin, shoes } = base;
    const darkHair = luminance(hair) < 0.08;
    /** @type {Record<string, string>} */
    const t = {
      'hair-1': hair,
      'hair-2': mix(hair, '#ffffff', 0.28),
      'hair-line': darkHair ? shade(hair, 0.18) : shade(hair, -0.16),
      'hair-strand': darkHair ? shade(hair, 0.1) : shade(hair, -0.04),
      'hair-shine': mix(hair, '#ffffff', darkHair ? 0.45 : 0.72),
      brow: darkHair ? shade(hair, 0.12) : shade(hair, -0.3),
      'eye-1': shade(eyes, -0.25),
      'eye-2': eyes,
      'eye-3': mix(eyes, '#ffffff', 0.55),
      'eye-pupil': shade(eyes, -0.38),
      'eye-glint': mix(eyes, '#ffffff', 0.8),
      'main-1': shade(main, 0.04),
      'main-2': shade(main, -0.04),
      'main-line': shade(main, -0.16),
      'main-dark': shade(main, -0.12),
      'main-light': mix(main, '#ffffff', 0.55),
      'accent-1': accent,
      'accent-line': shade(accent, -0.18),
      'accent-dark': shade(accent, -0.08),
      skin,
      'skin-shade': shade(skin, -0.05),
      'shoe-1': shoes,
      'shoe-line': shade(shoes, -0.16),
      cloth: '#ffffff',
      'cloth-line': '#d9e6f5',
      blush: '#ff9fb8',
      'blush-line': '#ff6f96',
      ink: '#2b2340',
      mouth: '#a33c55',
      'mouth-in': '#c2405c',
      tongue: '#ff8fa3',
    };
    for (const [k, v] of Object.entries(overrides)) if (isHex(v)) t[k] = v;
    /** @type {Record<string, string>} */
    const vars = {};
    for (const [k, v] of Object.entries(t)) vars[`--${k}`] = v;
    return vars;
  }

  return { BASE_KEYS, isHex, shade, mix, luminance, derive };
}));
