// @ts-check
// Outfits (body + arms + lower garment), legs, and shoes. All share the chibi body skeleton.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./kit'));
  else (root.TamaShared = root.TamaShared || {}).outfit = factory(root.TamaShared.kit);
}(globalThis, function (kit) {
  const { paint, line, mirror } = kit;
  const M = (/** @type {string} */ id) => `url:${id}main`;

  /** Arms with sleeves in `sleeve` color. @param {string} sleeve @param {string} sleeveLine */
  const arms = (sleeve, sleeveLine) => `
    <g class="arm arm-l"><ellipse cx="68" cy="170" rx="9.5" ry="17" transform="rotate(18 68 170)" ${paint(sleeve, sleeveLine, 1.2)} /><circle cx="62" cy="185" r="6.5" ${paint('skin')} /></g>
    <g class="arm arm-r"><ellipse cx="132" cy="170" rx="9.5" ry="17" transform="rotate(-18 132 170)" ${paint(sleeve, sleeveLine, 1.2)} /><circle cx="138" cy="185" r="6.5" ${paint('skin')} /></g>`;

  /** Big ribbon bow at the collar. */
  const collarBow = `
    <path d="M100 163 Q86 154 87 167 Q89 174 100 167 Z" ${paint('accent-1', 'accent-line', 1.2)} />
    <path d="M100 163 Q114 154 113 167 Q111 174 100 167 Z" ${paint('accent-1', 'accent-line', 1.2)} />
    <path d="M98 166 L94 177 M102 166 L106 177" ${line('accent-line', 2.4)} />
    <circle cx="100" cy="165" r="3.4" ${paint('accent-dark')} />`;

  /** @type {Record<string, { skirt: boolean, build: (id: string) => Record<string, string> }>} */
  const OUTFITS = {
    // Ported from kero-pet: raincoat dress with sailor collar and bow.
    'raincoat-dress': {
      skirt: true,
      build: (id) => ({
        body: `
          <path d="M74 148 Q66 180 54 210 Q100 220 146 210 Q134 180 126 148 Z" ${paint(M(id), 'main-line')} />
          <path d="M54 210 Q59.6 218 65.2 211.6 Q70.8 219.6 76.4 213 Q82 220.6 87.6 213.8 Q93.2 221 98.8 214 Q104.4 221 110 213.8 Q115.6 220.6 121.2 213 Q126.8 219.6 132.4 211.6 Q138 218 146 210 Q100 222 54 210 Z" ${paint('main-light')} />
          <circle cx="100" cy="186" r="2.6" ${paint('main-line')} /><circle cx="100" cy="198" r="2.6" ${paint('main-line')} />
          <path d="M78 147 L100 160 L88 172 Q78 162 78 147 Z" ${paint('cloth', 'cloth-line', 1)} />
          <path d="M122 147 L100 160 L112 172 Q122 162 122 147 Z" ${paint('cloth', 'cloth-line', 1)} />
          ${collarBow}${arms(M(id), 'main-line')}`,
      }),
    },

    hoodie: {
      skirt: false,
      build: (id) => ({
        body: `
          <path d="M70 202 L70 214 L98 214 L99 206 L101 206 L102 214 L130 214 L130 202 Z" ${paint('accent-dark', 'accent-line', 1.2)} />
          <path d="M74 148 Q66 176 64 204 Q100 210 136 204 Q134 176 126 148 Z" ${paint(M(id), 'main-line')} />
          <path d="M80 186 Q100 182 120 186 L118 200 Q100 203 82 200 Z" ${paint('main-dark')} opacity=".55" />
          <path d="M78 148 Q100 168 122 148" ${paint('main-dark', 'main-line', 1.2)} />
          <path d="M93 158 L92 176 M107 158 L108 176" ${line('cloth', 2)} />
          <circle cx="92" cy="177" r="2" ${paint('cloth')} /><circle cx="108" cy="177" r="2" ${paint('cloth')} />
          ${arms(M(id), 'main-line')}`,
      }),
    },

    sailor: {
      skirt: true,
      build: (id) => {
        const collar = `<path d="M76 147 L100 162 L90 176 Q74 166 76 147 Z" ${paint(M(id), 'main-line', 1.2)} />
          <path d="M80 152 L97 163" ${line('cloth', 1.6)} />`;
        return {
          body: `
            <path d="M68 186 L56 212 Q100 222 144 212 L132 186 Z" ${paint(M(id), 'main-line')} />
            <path d="M78 190 L70 214 M92 190 L88 218 M108 190 L112 218 M122 190 L130 214" ${line('main-line', 1.4)} opacity=".8" />
            <path d="M74 148 Q68 168 66 190 Q100 196 134 190 Q132 168 126 148 Z" ${paint('cloth', 'cloth-line', 1.2)} />
            ${collar}${mirror(collar)}${collarBow}${arms('cloth', 'cloth-line')}`,
        };
      },
    },

    overalls: {
      skirt: false,
      build: (id) => ({
        body: `
          <path d="M74 148 Q68 172 66 196 Q100 202 134 196 Q132 172 126 148 Z" ${paint('cloth', 'cloth-line', 1.2)} />
          <path d="M70 196 L70 214 L98 214 L99 206 L101 206 L102 214 L130 214 L130 196 Z" ${paint(M(id), 'main-line', 1.2)} />
          <path d="M80 168 L120 168 L124 198 L76 198 Z" ${paint(M(id), 'main-line', 1.2)} />
          <path d="M80 168 L76 150 M120 168 L124 150" ${line('main-2', 5)} />
          <circle cx="82" cy="171" r="2.4" ${paint('accent-1', 'accent-line', 1)} /><circle cx="118" cy="171" r="2.4" ${paint('accent-1', 'accent-line', 1)} />
          <rect x="92" y="178" width="16" height="10" rx="2" ${paint('main-dark')} />
          ${arms('cloth', 'cloth-line')}`,
      }),
    },

    'cardigan-skirt': {
      skirt: true,
      build: (id) => ({
        body: `
          <path d="M70 186 L58 212 Q100 220 142 212 L130 186 Z" ${paint('accent-1', 'accent-line')} />
          <path d="M74 148 Q68 170 66 192 Q100 198 134 192 Q132 170 126 148 Z" ${paint(M(id), 'main-line')} />
          <path d="M88 150 L100 166 L112 150 L108 194 L92 194 Z" ${paint('cloth', 'cloth-line', 1)} />
          <circle cx="94" cy="176" r="1.8" ${paint('main-line')} /><circle cx="94" cy="186" r="1.8" ${paint('main-line')} />
          <path d="M90 152 L100 166 L110 152" ${line('accent-line', 2)} />
          ${arms(M(id), 'main-line')}`,
      }),
    },
  };

  /** Bare legs (skin). Short-legged outfits cover the top with shorts. */
  const LEGS = `<rect x="86" y="208" width="9" height="14" ${paint('skin')} /><rect x="105" y="208" width="9" height="14" ${paint('skin')} />`;

  /** @type {Record<string, () => string>} */
  const SHOES = {
    // Ported from kero-pet: yellow rain boots with white socks.
    rainboots: () => `
      <rect x="84" y="216" width="13" height="7" rx="2" ${paint('cloth')} /><rect x="103" y="216" width="13" height="7" rx="2" ${paint('cloth')} />
      <rect x="76" y="221" width="23" height="12" rx="6" ${paint('shoe-1', 'shoe-line')} /><rect x="101" y="221" width="23" height="12" rx="6" ${paint('shoe-1', 'shoe-line')} />`,
    sneakers: () => `
      <rect x="85" y="218" width="11" height="5" ${paint('cloth')} /><rect x="104" y="218" width="11" height="5" ${paint('cloth')} />
      <path d="M78 233 Q76 224 86 222 L96 222 Q100 226 99 233 Z" ${paint('shoe-1', 'shoe-line', 1.4)} />
      <path d="M122 233 Q124 224 114 222 L104 222 Q100 226 101 233 Z" ${paint('shoe-1', 'shoe-line', 1.4)} />
      <path d="M77 231 L99 231 M101 231 L123 231" ${line('cloth', 2.6)} />`,
    loafers: () => `
      <rect x="85" y="210" width="11" height="14" ${paint('cloth', 'cloth-line', 1)} /><rect x="104" y="210" width="11" height="14" ${paint('cloth', 'cloth-line', 1)} />
      <path d="M80 233 Q78 225 87 223 L97 223 Q99 227 98 233 Z" ${paint('shoe-1', 'shoe-line', 1.4)} />
      <path d="M120 233 Q122 225 113 223 L103 223 Q101 227 102 233 Z" ${paint('shoe-1', 'shoe-line', 1.4)} />`,
  };

  return { OUTFITS, LEGS, SHOES };
}));
