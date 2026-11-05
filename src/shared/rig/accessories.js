// @ts-check
// Accessories. Each returns slot fragments; `hood` tells head accessories where the head top is.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./kit'));
  else (root.TamaShared = root.TamaShared || {}).accessories = factory(root.TamaShared.kit);
}(globalThis, function (kit) {
  const { paint, line, mirror } = kit;

  const star = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ s) =>
    `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -10 L2.9 -4 L9.5 -3.1 L4.7 1.5 L5.9 8.1 L0 5 L-5.9 8.1 L-4.7 1.5 L-9.5 -3.1 L-2.9 -4 Z" ${paint('accent-1', 'accent-line', 1.4)} stroke-linejoin="round" />`;

  /** @type {Record<string, (o: { hood: boolean }) => Record<string, string>>} */
  const ACCESSORIES = {
    'star-clip': () => ({ headAcc: star(134, 80, 0.9) }),
    ribbon: ({ hood }) => {
      const y = hood ? 40 : 52;
      const half = `<path d="M100 ${y} Q78 ${y - 18} 76 ${y + 2} Q80 ${y + 14} 100 ${y + 4} Z" ${paint('accent-1', 'accent-line', 1.4)} />`;
      return { headAcc: `${half}${mirror(half)}<circle cx="100" cy="${y + 2}" r="5" ${paint('accent-dark', 'accent-line', 1.2)} />` };
    },
    flower: () => {
      const petals = [0, 72, 144, 216, 288].map((a) =>
        `<ellipse cx="70" cy="72" rx="5" ry="8" transform="rotate(${a} 70 80)" ${paint('blush', 'blush-line', 1)} />`).join('');
      return { headAcc: `${petals}<circle cx="70" cy="80" r="4" ${paint('accent-1', 'accent-line', 1)} />` };
    },
    headphones: ({ hood }) => {
      const top = hood ? 26 : 44;
      return {
        headAcc: `<path d="M48 112 Q46 ${top} 100 ${top - 4} Q154 ${top} 152 112" ${line('ink', 5)} />
          <path d="M48 112 Q46 ${top} 100 ${top - 4} Q154 ${top} 152 112" ${line('accent-1', 3)} />
          <rect x="38" y="100" width="16" height="26" rx="7" ${paint('accent-1', 'accent-line', 1.5)} />
          <rect x="146" y="100" width="16" height="26" rx="7" ${paint('accent-1', 'accent-line', 1.5)} />`,
      };
    },
    'round-glasses': () => ({
      faceDetail: `<g style="fill:rgba(255,255,255,.12);stroke:var(--ink);stroke-width:1.6">
        <circle cx="77" cy="114" r="15" /><circle cx="123" cy="114" r="15" />
        <path d="M92 112 Q100 108 108 112" style="fill:none" /></g>`,
    }),
    freckles: () => ({ faceDetail: '' }), // filled in by compose from face.FRECKLES
    scarf: () => ({
      bodyFront: `<path d="M74 146 Q100 160 126 146 L128 156 Q100 170 72 156 Z" ${paint('accent-1', 'accent-line', 1.4)} />
        <path d="M112 158 L120 188 L110 190 L104 162 Z" ${paint('accent-1', 'accent-line', 1.4)} />
        <path d="M110 184 L120 184 M108 178 L118 178" ${line('accent-line', 1.2)} />`,
    }),
  };

  return { ACCESSORIES };
}));
