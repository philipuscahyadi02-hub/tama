// @ts-check
// Face skin + the full expression layer, shared by every design (ART-3). Ported from kero-pet's SVG.
// Which pieces are visible per mood is controlled by pet.css (.mood-* classes).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./kit'));
  else (root.TamaShared = root.TamaShared || {}).face = factory(root.TamaShared.kit);
}(globalThis, function (kit) {
  const { paint, line } = kit;

  const skin = `<path d="M50 101 Q50 154 100 156 Q150 154 150 101 Q150 62 100 62 Q50 62 50 101 Z" ${paint('skin')} />`;

  const blush = `<g class="blush">
    <ellipse cx="62" cy="133" rx="11" ry="6" ${paint('blush')} opacity=".55" />
    <ellipse cx="138" cy="133" rx="11" ry="6" ${paint('blush')} opacity=".55" />
    <path d="M56 136 L59 130 M61 136 L64 130 M66 136 L69 130 M132 136 L135 130 M137 136 L140 130 M142 136 L145 130" ${line('blush-line', 1.5)} />
  </g>`;

  /** One open eye. @param {number} cx @param {string} id  gradient id prefix */
  const eye = (cx, id) => `<g class="eye">
      <ellipse cx="${cx}" cy="114" rx="12.5" ry="15" ${paint('#fff')} />
      <ellipse cx="${cx}" cy="116" rx="11" ry="13.5" ${paint(`url:${id}iris`)} />
      <ellipse cx="${cx}" cy="117" rx="5" ry="7" ${paint('eye-pupil')} />
      <ellipse cx="${cx}" cy="124" rx="7" ry="3.2" ${paint('eye-glint')} opacity=".55" />
      <g class="hl"><ellipse cx="${cx - 4.5}" cy="107.5" rx="4.6" ry="5.6" ${paint('#fff')} /><circle cx="${cx + 4}" cy="121" r="2.2" ${paint('#fff')} /></g>
      <g class="stars"><use href="#${id}star" transform="translate(${cx - 5} 108) scale(1.4)" /><use href="#${id}star" transform="translate(${cx + 4.5} 121) scale(.7)" /></g>
    </g>`;

  /**
   * Eye shape variants (spec.parts.eyes). 'sharp' squashes the open eyes a little and angles the lashes.
   * @param {string} style @param {string} id
   */
  function openEyes(style, id) {
    const lashes = style === 'sharp'
      ? '<path d="M63 108 Q77 97 92 103" /><path d="M64 108 L57 105" /><path d="M108 103 Q123 97 137 108" /><path d="M136 108 L143 105" />'
      : '<path d="M63 106 Q77 93 91 104" /><path d="M64 106 L58.5 101.5" /><path d="M109 104 Q123 93 137 106" /><path d="M136 106 L141.5 101.5" />';
    const pair = `${eye(77, id)}${eye(123, id)}`;
    const shaped = style === 'sharp' ? `<g transform="translate(0 116) scale(1 .84) translate(0 -116)">${pair}</g>` : pair;
    return `<g class="eyes eyes-open">${shaped}<g ${line('ink', 4.2)}>${lashes}</g></g>`;
  }

  /** @param {{ eyes?: string, idPrefix?: string }} opts */
  function expressions({ eyes = 'round', idPrefix = '' } = {}) {
    const id = idPrefix;
    return `
    ${openEyes(eyes, id)}
    <g class="lids">
      <path d="M61 103 Q77 90 93 103 L93 112 Q77 106 61 112 Z" ${paint('skin')} />
      <path d="M107 103 Q123 90 139 103 L139 112 Q123 106 107 112 Z" ${paint('skin')} />
      <path d="M62 112 Q77 106 92 112 M108 112 Q123 106 138 112" ${line('ink', 3.6)} />
    </g>
    <g class="eyes eyes-happy" ${line('ink', 4.5)}><path d="M65 117 Q77 102 89 117" /><path d="M111 117 Q123 102 135 117" /></g>
    <g class="eyes eyes-closed" ${line('ink', 3.8)}>
      <path d="M65 112 Q77 122 89 112" /><path d="M66 113 L61 110" /><path d="M111 112 Q123 122 135 112" /><path d="M134 113 L139 110" />
    </g>
    <g class="eyes eyes-dizzy" ${line('ink', 2.6)}>
      <path d="M77 114 m-2 0 a2 2 0 1 1 4 0 a4 4 0 1 1 -8 0 a6 6 0 1 1 12 0 a8 8 0 1 1 -16 0" />
      <path d="M123 114 m-2 0 a2 2 0 1 1 4 0 a4 4 0 1 1 -8 0 a6 6 0 1 1 12 0 a8 8 0 1 1 -16 0" />
    </g>
    <g class="eyes eyes-shock">
      <ellipse cx="77" cy="114" rx="11" ry="14" ${paint('#fff', 'ink', 2.6)} />
      <ellipse cx="123" cy="114" rx="11" ry="14" ${paint('#fff', 'ink', 2.6)} />
      <circle cx="77" cy="115" r="3.6" ${paint('ink')} /><circle cx="123" cy="115" r="3.6" ${paint('ink')} />
    </g>
    <g class="brows brows-angry" ${line('brow', 3)}><path d="M64 96 L86 102" /><path d="M136 96 L114 102" /></g>
    <g class="brows brows-sad" ${line('brow', 3)}><path d="M64 101 L86 95" /><path d="M136 101 L114 95" /></g>
    <g class="tears">
      <ellipse cx="77" cy="127" rx="10" ry="3" ${paint('#bfe9ff')} opacity=".9" />
      <ellipse cx="123" cy="127" rx="10" ry="3" ${paint('#bfe9ff')} opacity=".9" />
      <path class="stream" d="M69 129 Q66 141 70 152" ${line('#8fd3ff', 3.2)} />
      <path class="stream" d="M131 129 Q134 141 130 152" ${line('#8fd3ff', 3.2)} />
    </g>
    <g class="glasses" style="fill:rgba(200,230,255,.18);stroke:#8a5a44;stroke-width:2.8">
      <circle cx="77" cy="114" r="16.5" /><circle cx="123" cy="114" r="16.5" />
      <path d="M93.5 111 Q100 106 106.5 111 M60.5 111 L51 106 M139.5 111 L149 106" style="fill:none" />
      <path d="M66 104 L71 100 M112 104 L117 100" style="stroke:#fff;stroke-width:2.2;stroke-linecap:round" />
    </g>
    <path class="mouth mouth-cat" d="M92 139 Q96 144 100 139 Q104 144 108 139" ${line('mouth', 2.6)} />
    <g class="mouth mouth-smile">
      <path d="M90 137 Q100 152 110 137 Z" ${paint('mouth-in', 'mouth')} stroke-linejoin="round" />
      <path d="M94.5 143.5 Q100 148.5 105.5 143.5 Q100 141 94.5 143.5 Z" ${paint('tongue')} />
      <path d="M93 137.5 L95.5 141 L97.5 137.8 Z" ${paint('#fff')} />
    </g>
    <ellipse class="mouth mouth-o" cx="100" cy="142" rx="4" ry="4.6" ${paint('mouth')} />
    <path class="mouth mouth-wobble" d="M90 143 Q94 139 98 143 Q102 147 106 143 Q108 141 110 142" ${line('mouth', 2.6)} />
    <path class="mouth mouth-pout" d="M98 136 Q105 138 99 141.5 Q105 145 98 147" ${line('mouth', 2.6)} />
    <path class="mouth mouth-flat" d="M94 141 Q100 143 106 141" ${line('mouth', 2.6)} />
    <ellipse class="puff" cx="134" cy="136" rx="13" ry="10" ${paint('skin-shade')} />`;
  }

  /** Shared <defs>: iris gradient + sparkle star, id-prefixed so several rigs can share a page. @param {string} id */
  const defs = (id) => `
    <linearGradient id="${id}iris" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--eye-1)" /><stop offset=".55" style="stop-color:var(--eye-2)" /><stop offset="1" style="stop-color:var(--eye-3)" />
    </linearGradient>
    <linearGradient id="${id}hair" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--hair-1)" /><stop offset="1" style="stop-color:var(--hair-2)" />
    </linearGradient>
    <linearGradient id="${id}main" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--main-1)" /><stop offset="1" style="stop-color:var(--main-2)" />
    </linearGradient>
    <g id="${id}star"><path d="M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3 Z" style="fill:#fff" /></g>`;

  const FRECKLES = `<g ${paint('#d9967a')} opacity=".7"><circle cx="66" cy="128" r="1.3" /><circle cx="71" cy="131" r="1.1" /><circle cx="62" cy="132" r="1" /><circle cx="134" cy="128" r="1.3" /><circle cx="129" cy="131" r="1.1" /><circle cx="138" cy="132" r="1" /></g>`;

  return { skin, blush, expressions, defs, FRECKLES };
}));
