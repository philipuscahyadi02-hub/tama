// @ts-check
// Tiny SVG helpers shared by all rig parts. Colors are always palette CSS variables (D-020).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.TamaShared = root.TamaShared || {}).kit = factory();
}(globalThis, function () {
  /** Draw order. A part returns { [slot]: svgString }; compose concatenates slots in this order. */
  const SLOTS = /** @type {const} */ ([
    'hairBehind', 'motifBehind', 'legs', 'shoes', 'body', 'bodyFront', // outside the head group
    'ahoge', 'headBack', 'headwear', 'face', 'faceDetail', 'hairFront', 'headwearFront', 'headAcc',
  ]);
  const HEAD_SLOTS = new Set(['ahoge', 'headBack', 'headwear', 'face', 'faceDetail', 'hairFront', 'headwearFront', 'headAcc']);
  const BODY_SLOTS = new Set(['body', 'bodyFront']);

  /** fill with a palette token, optional stroke token + width. @param {string} f @param {string} [s] @param {number} [w] */
  const paint = (f, s, w = 1.5) => `style="fill:${col(f)}${s ? `;stroke:${col(s)};stroke-width:${w}` : ''}"`;
  /** stroke-only line. @param {string} s @param {number} w @param {string} [extra] */
  const line = (s, w, extra = '') => `style="fill:none;stroke:${col(s)};stroke-width:${w};stroke-linecap:round;stroke-linejoin:round${extra}"`;
  /** token → css color: palette token, url(#gradient) via "url:id", or a literal (#hex / rgba). @param {string} t */
  function col(t) {
    if (t.startsWith('url:')) return `url(#${t.slice(4)})`;
    if (t.startsWith('#') || t.startsWith('rgb') || t === 'none') return t;
    return `var(--${t})`;
  }
  /** Mirror an SVG fragment across the vertical center line (x = 100). @param {string} svg */
  const mirror = (svg) => `<g transform="translate(200 0) scale(-1 1)">${svg}</g>`;

  return { SLOTS, HEAD_SLOTS, BODY_SLOTS, paint, line, col, mirror };
}));
