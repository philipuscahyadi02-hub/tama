// @ts-check
// DJ Tama (MUS-3): DJ headphones and a little DJ booth, drawn for every design from palette tokens (D-020).
// Always present in the composed SVG but hidden; the pet shows them with `.dj-on` while music plays (rig.css).
// Hands rest on the booth (they sit at y≈185): the left hand on the record, the right on the mixer.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./kit'));
  else (root.TamaShared = root.TamaShared || {}).dj = factory(root.TamaShared.kit);
}(globalThis, function (kit) {
  const { paint, line } = kit;

  /** Over-ear DJ headphones: a thick band and big cups with an accent ring. @param {boolean} hood */
  function phones(hood) {
    const top = hood ? 22 : 40;
    const band = `M44 114 Q40 ${top} 100 ${top - 6} Q160 ${top} 156 114`;
    const cup = (/** @type {number} */ x, /** @type {number} */ flip) => `
      <g transform="translate(${x} 112) scale(${flip} 1)">
        <rect x="-12" y="-17" width="22" height="34" rx="10" ${paint('ink')} />
        <rect x="-9" y="-14" width="16" height="28" rx="8" ${paint('accent-1', 'accent-line', 1.4)} />
        <ellipse cx="-1" cy="0" rx="4.5" ry="7" ${paint('accent-dark')} />
        <path d="M-6 -9 Q-4 -12 0 -12" ${line('#ffffff', 1.6, ';opacity:.7')} />
      </g>`;
    return `<g class="dj dj-phones">
      <path d="${band}" ${line('ink', 7)} />
      <path d="${band}" ${line('accent-1', 4)} />
      <path d="M70 ${top + 2} Q100 ${top - 8} 130 ${top + 2}" ${line('#ffffff', 1.4, ';opacity:.55')} />
      ${cup(42, 1)}${cup(158, -1)}
    </g>`;
  }

  /** The booth: a front panel with her accent stripe and a note badge, a record (spins) and a small mixer. */
  function deck() {
    const knob = (/** @type {number} */ x, /** @type {number} */ y) => `<circle cx="${x}" cy="${y}" r="2.6" ${paint('accent-1', 'ink', 1)} />`;
    return `<g class="dj dj-deck">
      <rect x="30" y="196" width="140" height="36" rx="9" ${paint('ink')} />
      <rect x="33" y="199" width="134" height="30" rx="7" ${paint('accent-dark')} />
      <path d="M33 214 H167" ${line('accent-1', 3)} />
      <g transform="translate(100 214)">
        <circle r="8.5" ${paint('accent-1', 'ink', 1.4)} />
        <path d="M-2 4 V-4 L4 -5.5 V2.5" ${line('ink', 1.6)} /><circle cx="-3.6" cy="4" r="2" ${paint('ink')} /><circle cx="2.4" cy="2.5" r="2" ${paint('ink')} />
      </g>
      <path d="M26 192 Q26 186 32 186 H168 Q174 186 174 192 V198 H26 Z" ${paint('accent-1', 'ink', 1.6)} />
      <g transform="translate(64 191) scale(1 .3)">
        <g class="dj-spin">
          <circle r="21" ${paint('ink')} />
          <circle r="16" style="fill:none;stroke:rgba(255,255,255,.18);stroke-width:1" />
          <circle r="11" style="fill:none;stroke:rgba(255,255,255,.12);stroke-width:1" />
          <circle r="6.5" ${paint('accent-1')} />
          <path d="M-18 -8 A20 20 0 0 1 -4 -19" ${line('#ffffff', 2.4, ';opacity:.55')} />
        </g>
      </g>
      <rect x="104" y="188" width="56" height="7" rx="3.5" ${paint('ink')} />
      <rect class="dj-fader" x="122" y="187" width="9" height="9" rx="2" ${paint('#ffffff', 'ink', 1)} />
      ${knob(110, 191.5)}${knob(150, 191.5)}
      <g class="dj-notes">
        <path class="dj-note n1" d="M40 168 V156 L48 154 V165" ${line('accent-1', 2.2)} />
        <path class="dj-note n2" d="M160 160 V150 L167 148.5 V158" ${line('accent-1', 2.2)} />
      </g>
    </g>`;
  }

  return { phones, deck };
}));
