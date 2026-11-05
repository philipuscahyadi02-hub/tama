// @ts-check
// Motif headwear: animal hoods (cover the head) and ears (sit on the hair). Plus motif tails.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./kit'));
  else (root.TamaShared = root.TamaShared || {}).headwear = factory(root.TamaShared.kit);
}(globalThis, function (kit) {
  const { paint, line, mirror } = kit;
  const M = (/** @type {string} */ id) => `url:${id}main`;
  const H = (/** @type {string} */ id) => `url:${id}hair`;

  /** The hood body every hood shares: big circle + darker rim around the face. @param {string} id */
  const hoodShell = (id) => `
    <circle cx="100" cy="90" r="68" ${paint(M(id))} />
    <path d="M45 100 Q45 160 100 162 Q155 160 155 100 Q155 55 100 55 Q45 55 45 100 Z" ${paint('main-dark')} />`;

  /** @type {Record<string, { hood: boolean, build: (id: string) => Record<string, string> }>} */
  const HEADWEAR = {
    none: { hood: false, build: () => ({}) },

    // Ported from kero-pet: frog hood with big googly eyes.
    'frog-hood': {
      hood: true,
      build: (id) => ({
        headwear: `
          <circle cx="56" cy="34" r="22" ${paint(M(id))} />
          <circle cx="144" cy="34" r="22" ${paint(M(id))} />
          <circle cx="100" cy="90" r="68" ${paint(M(id))} />
          <g class="hood-eyes">
            <circle cx="56" cy="32" r="14" ${paint('#fff')} /><circle cx="144" cy="32" r="14" ${paint('#fff')} />
            <circle cx="58" cy="34" r="7" ${paint('ink')} /><circle cx="142" cy="34" r="7" ${paint('ink')} />
            <circle cx="60" cy="31" r="2.5" ${paint('#fff')} /><circle cx="144" cy="31" r="2.5" ${paint('#fff')} />
          </g>
          <ellipse cx="74" cy="56" rx="6" ry="3" ${paint('blush')} opacity=".5" />
          <ellipse cx="126" cy="56" rx="6" ry="3" ${paint('blush')} opacity=".5" />
          <path d="M45 100 Q45 160 100 162 Q155 160 155 100 Q155 55 100 55 Q45 55 45 100 Z" ${paint('main-dark')} />`,
      }),
    },

    'bunny-hood': {
      hood: true,
      build: (id) => {
        const ear = `<g transform="rotate(-14 72 40)"><ellipse cx="72" cy="12" rx="14" ry="36" ${paint(M(id), 'main-line', 1.4)} />
          <ellipse cx="72" cy="14" rx="7" ry="26" ${paint('blush')} opacity=".75" /></g>`;
        return { headwear: `${ear}${mirror(ear)}${hoodShell(id)}` };
      },
    },

    'bear-hood': {
      hood: true,
      build: (id) => {
        const ear = `<circle cx="50" cy="42" r="20" ${paint(M(id), 'main-line', 1.4)} /><circle cx="50" cy="42" r="10" ${paint('main-light')} />`;
        return { headwear: `${ear}${mirror(ear)}${hoodShell(id)}` };
      },
    },

    'cat-ears': {
      hood: false,
      build: (id) => {
        const ear = `<path d="M58 72 L50 26 L88 54 Z" ${paint(H(id), 'hair-line', 1.4)} stroke-linejoin="round" />
          <path d="M61 64 L56 38 L78 55 Z" ${paint('blush')} opacity=".8" />`;
        return {
          headwear: `${ear}${mirror(ear)}`,
          motifBehind: `<g class="motif-tail"><path d="M136 206 C170 206 176 176 166 156 C160 144 168 132 178 134" ${line('hair-line', 11)} />
            <path d="M136 206 C170 206 176 176 166 156 C160 144 168 132 178 134" ${line('hair-1', 8)} /></g>`,
        };
      },
    },

    'fox-ears': {
      hood: false,
      build: (id) => {
        const ear = `<path d="M56 76 L44 18 L92 54 Z" ${paint(H(id), 'hair-line', 1.4)} stroke-linejoin="round" />
          <path d="M60 66 L52 34 L80 55 Z" ${paint('#fff')} opacity=".85" />`;
        return {
          headwear: `${ear}${mirror(ear)}`,
          motifBehind: `<g class="motif-tail"><path d="M132 210 C176 214 196 170 176 136 C170 160 160 176 132 188 Z" ${paint(H(id), 'hair-line', 1.5)} />
            <path d="M176 136 C186 150 186 162 182 170 C176 160 172 150 176 136 Z" ${paint('#fff')} /></g>`,
        };
      },
    },
  };

  return { HEADWEAR };
}));
