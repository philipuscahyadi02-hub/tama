// @ts-check
// UI theme from a CharacterSpec (ART-4, TERM-2, D-032): the terminal, chat window and pet UI take their colors and
// flavor text from the active Tama instead of a hard-coded Kero-chan. Pure; shared by main (tests) and renderers.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./palette'));
  else (root.TamaShared = root.TamaShared || {}).theme = factory(root.TamaShared.palette);
}(globalThis, function (palette) {
  const { mix, contrast, saturation, luminance } = palette;

  /**
   * Terminal looks. Variants unlock with bond level (BOND-3): index into the bond LEVELS
   * (0 Stranger, 1 Acquaintance, 2 Buddy, 3 Partner, 4 Soulmate).
   */
  const VARIANTS = [
    { id: 'night', label: 'Night (dark)', minLevel: 0 },
    { id: 'day', label: 'Day (light)', minLevel: 1 },
    { id: 'pastel', label: 'Pastel', minLevel: 3 },
    { id: 'neon', label: 'Neon night', minLevel: 4 },
  ];

  /** @param {{palette?: Record<string, string>}} spec */
  function base(spec) {
    const p = spec.palette || {};
    const pick = (/** @type {string} */ k, /** @type {string} */ d) => (palette.isHex(p[k]) ? p[k] : d);
    const colors = { hair: pick('hair', '#ff8fbf'), eyes: pick('eyes', '#5b9cff'), main: pick('main', '#a77bdb'), accent: pick('accent', '#ffd34f') };
    // The two most colorful base colors become the UI accents (black hair or a white outfit make poor accents).
    const ranked = [colors.hair, colors.accent, colors.eyes, colors.main]
      .map((c, i) => ({ c, score: saturation(c) * (1 - Math.abs(luminance(c) - 0.45)) - i * 0.01 }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
    const accent2 = ranked.find((c) => c !== ranked[0] && Math.abs(luminance(c) - luminance(ranked[0])) + Math.abs(saturation(c) - saturation(ranked[0])) > 0.05) || ranked[1];
    return { ...colors, accent1: ranked[0], accent2 };
  }

  /** Move `fg` toward white (dark bg) or black (light bg) until it is readable on `bg`. */
  function readable(/** @type {string} */ fg, /** @type {string} */ bg, min = 4.5) {
    const toward = luminance(bg) < 0.4 ? '#ffffff' : '#000000';
    let c = fg;
    for (let t = 0.08; contrast(c, bg) < min && t <= 1; t += 0.08) c = mix(fg, toward, t);
    return c;
  }

  /**
   * Terminal tokens (`--tama-*`) for a variant. Every color the terminal CSS uses comes from here.
   * @param {any} spec @param {string} [variant]
   * @returns {Record<string, string>}
   */
  function terminalVars(spec, variant = 'night') {
    const b = base(spec);
    const dark = variant === 'night' || variant === 'neon';
    const ink = '#2b2340';
    let bg;
    if (variant === 'day') bg = mix(b.main, '#ffffff', 0.94);
    else if (variant === 'pastel') bg = mix(b.hair, '#ffffff', 0.86);
    else if (variant === 'neon') bg = mix(b.accent1, '#07060b', 0.93);
    else bg = mix(b.main, '#16131f', 0.9);
    const toward = dark ? '#ffffff' : '#000000';
    const fg = dark ? mix(bg, '#ffffff', 0.88) : mix(bg, ink, 0.9);
    const accent = readable(variant === 'neon' ? mix(b.accent1, '#ffffff', 0.15) : b.accent1, bg);
    const accent2 = readable(b.accent2, bg);
    const sem = (/** @type {string} */ c) => readable(dark ? c : mix(c, '#000000', 0.25), bg);
    return {
      '--tama-bg': bg,
      '--tama-bg2': mix(bg, toward, dark ? 0.05 : 0.04),
      '--tama-panel': mix(bg, toward, dark ? 0.03 : 0.5),
      '--tama-deep': mix(bg, dark ? '#000000' : '#ffffff', dark ? 0.35 : 0.6),
      '--tama-head1': mix(bg, toward, dark ? 0.07 : 0.03),
      '--tama-head2': mix(bg, toward, dark ? 0.03 : 0.0),
      '--tama-line': mix(bg, toward, dark ? 0.16 : 0.14),
      '--tama-edge': mix(bg, accent, 0.35),
      '--tama-fg': fg,
      '--tama-fg2': mix(fg, bg, 0.12),
      '--tama-dim': readable(mix(fg, bg, 0.45), bg, 3.2),
      '--tama-accent': accent,
      '--tama-accent2': accent2,
      '--tama-warn': sem('#ffd36a'),
      '--tama-info': sem('#8ec5ff'),
      '--tama-bad': sem('#ff6f86'),
      '--tama-good': sem('#8be07a'),
      '--tama-scheme': dark ? 'dark' : 'light',
    };
  }

  /** Chat window tokens (light, soft). @param {any} spec @returns {Record<string, string>} */
  function chatVars(spec) {
    const b = base(spec);
    const main = b.main;
    const inkOn = (/** @type {string} */ hex) => (luminance(hex) > 0.45 ? '#2b2340' : '#ffffff');
    const user = b.accent1;
    return {
      '--tama-bg': mix(main, '#ffffff', 0.92),
      '--tama-panel': '#ffffff',
      '--tama-head': mix(b.hair, '#ffffff', 0.7),
      '--tama-accent': b.accent1,
      '--tama-accent-ink': inkOn(b.accent1),
      '--tama-bubble': mix(main, '#ffffff', 0.8),
      '--tama-bubble-line': mix(main, '#ffffff', 0.62),
      '--tama-user': user,
      '--tama-user-ink': inkOn(user),
      '--tama-line': mix(main, '#ffffff', 0.7),
    };
  }

  /** Pet bubble + menu tokens. @param {any} spec @returns {Record<string, string>} */
  function petVars(spec) {
    const b = base(spec);
    return {
      '--tama-menu-1': mix(b.accent1, '#ffffff', 0.72),
      '--tama-menu-2': mix(b.accent2, '#ffffff', 0.72),
      '--tama-menu-hover': mix(b.accent1, '#ffffff', 0.55),
    };
  }

  /** "kero~" → "Kero"; "nya!" → "Nya". @param {string} s */
  const word = (s) => {
    const m = /[a-z][a-z-]{1,11}/i.exec(String(s || ''));
    return m ? m[0].charAt(0).toUpperCase() + m[0].slice(1).toLowerCase() : '';
  };

  const GENERIC_VERBS = ['Pondering', 'Sparkling', 'Ganbatte-ing', 'Doki-doki-ing', 'Henshin-ing', 'Mogu-mogu-ing', 'Tinkering', 'Scheming'];

  /**
   * Flavor text for the terminal (TERM-2).
   * @param {any} spec
   * @returns {{ name: string, title: string, subtitle: string, verbs: string[], caret: string, glyphs: string[], emoji: string }}
   */
  function flavor(spec) {
    const name = String(spec.name || 'Tama');
    const sp = spec.speech || {};
    const own = [...(sp.tics || []), ...(sp.catchphrases || [])].map(word).filter(Boolean).map((w) => `${w}-ing`);
    const short = word(name.split(/[-\s]/)[0]);
    const verbs = [...new Set([...own, short ? `${short}-ing` : '', ...GENERIC_VERBS].filter(Boolean))];
    const p = spec.personality || {};
    const caret = (p.chaos || 0) >= 70 ? '✦' : (p.tsundere || 0) >= 70 ? '»' : (p.energy || 0) <= 25 ? '›' : '❯';
    const emoji = (sp.emoji && sp.emoji[0]) || '✨';
    const motif = String(spec.motif || '').trim();
    return {
      name,
      title: `${name} Code`,
      subtitle: motif ? `Claude Code, with your ${motif}. /help for commands.` : 'Claude Code, with your Tama. /help for commands.',
      verbs,
      caret,
      glyphs: ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'],
      emoji,
    };
  }

  /** Variants this bond level can use. @param {number} levelIndex */
  function unlocked(levelIndex) { return VARIANTS.filter((v) => (levelIndex || 0) >= v.minLevel); }

  return { VARIANTS, terminalVars, chatVars, petVars, flavor, unlocked, readable };
}));
