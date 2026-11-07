// @ts-check
// Faster voice (SET-4, D-049): split a line into sentences so the first one plays while the rest are still being
// synthesized, and keep recent audio so repeated lines (greetings, deck fallbacks, the phone copy) are instant. Pure.

const MIN_CHARS = 5;

/**
 * Sentences of a spoken line, in order. Very short pieces ("えへへ。", "Hi!") are joined to the next one so each
 * part still sounds natural. @param {string} text @returns {string[]}
 */
function splitSentences(text) {
  const parts = String(text || '').match(/[^。！？!?.…]+[。！？!?.…]*[」』)）]?\s*/g) || [];
  /** @type {string[]} */ const out = [];
  let carry = '';
  for (const raw of parts) {
    const s = carry + raw; // raw keeps its trailing space, so English stays spaced and Japanese stays joined
    if (!s.trim()) continue;
    if (s.replace(/[\s。！？!?.…、,]/g, '').length < MIN_CHARS) { carry = s; continue; }
    out.push(s.trim());
    carry = '';
  }
  const rest = carry.trim();
  if (rest) {
    if (!out.length) out.push(rest);
    else out[out.length - 1] += (/[。！？…」』]$/.test(out[out.length - 1]) ? '' : ' ') + rest;
  }
  return out;
}

/**
 * A long first sentence is split once more at its first comma, so the first sound comes sooner (SET-4).
 * @param {string[]} parts @param {number} [maxFirst] @returns {string[]}
 */
function quickStart(parts, maxFirst = 20) {
  const [first, ...rest] = parts;
  if (!first || first.length <= maxFirst) return parts;
  const m = /[、,]\s*/g;
  let hit;
  while ((hit = m.exec(first))) {
    const cut = hit.index + hit[0].length;
    if (cut >= 4 && first.length - cut >= 6) return [first.slice(0, cut).trim(), first.slice(cut).trim(), ...rest];
  }
  return parts;
}

/**
 * Small least-recently-used cache. @template V
 * @param {number} max
 */
function createLru(max) {
  /** @type {Map<string, V>} */ const m = new Map();
  return {
    /** @param {string} k */
    get(k) { const v = m.get(k); if (v !== undefined) { m.delete(k); m.set(k, v); } return v; },
    /** @param {string} k @param {V} v */
    set(k, v) { m.delete(k); m.set(k, v); if (m.size > max) m.delete(String(m.keys().next().value)); },
    size: () => m.size,
    clear: () => m.clear(),
  };
}

module.exports = { splitSentences, quickStart, createLru };
