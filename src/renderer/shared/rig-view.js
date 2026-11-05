/* Renderer helper: paint a CharacterSpec into an <svg class="rig-svg"> inside a .tama-rig element.
   Used by the pet window, onboarding previews and the dev gallery. */
(function () {
  const RIG_CLASSES = /\b(eyes-\w+|has-hood|no-hood)\b/g;

  /**
   * @param {Element} rootEl  the .tama-rig element (gets eye/hood classes)
   * @param {SVGSVGElement} svgEl
   * @param {object} spec
   * @param {string} [idPrefix]  unique per rig on the page
   * @returns {object} the normalized spec actually drawn
   */
  function renderRig(rootEl, svgEl, spec, idPrefix = '') {
    const r = window.TamaShared.rig.compose(spec, { idPrefix });
    svgEl.innerHTML = r.svg;
    for (const [k, v] of Object.entries(r.vars)) svgEl.style.setProperty(k, v);
    rootEl.className = rootEl.className.replace(RIG_CLASSES, '').replace(/\s+/g, ' ').trim();
    rootEl.classList.add('tama-rig', ...r.classes);
    return r.spec;
  }

  /** The unhatched egg (ONB-1). Uses the same 200x240 box and stands where the feet would be. */
  const EGG_SVG = `
    <ellipse cx="100" cy="235" rx="44" ry="5" style="fill:rgba(0,0,0,.16)" />
    <g class="egg-body">
      <path d="M100 96 C138 96 152 160 150 190 C148 222 126 236 100 236 C74 236 52 222 50 190 C48 160 62 96 100 96 Z" style="fill:#fff8ec;stroke:#3a2a4d;stroke-width:2.5" />
      <ellipse cx="80" cy="150" rx="11" ry="9" style="fill:#ffc4dc" />
      <ellipse cx="122" cy="176" rx="14" ry="11" style="fill:#c8f0b8" />
      <ellipse cx="88" cy="204" rx="9" ry="7" style="fill:#c9dcff" />
      <ellipse cx="118" cy="126" rx="7" ry="6" style="fill:#ffe69a" />
      <path d="M70 130 Q74 112 88 106" style="fill:none;stroke:#fff;stroke-width:5;stroke-linecap:round;opacity:.9" />
      <path class="egg-crack" d="M74 170 L86 160 L94 172 L104 158 L114 170 L126 160" style="fill:none;stroke:#3a2a4d;stroke-width:2;stroke-linejoin:round" />
    </g>`;

  /** @param {Element} rootEl @param {SVGSVGElement} svgEl */
  function renderEgg(rootEl, svgEl) {
    svgEl.innerHTML = EGG_SVG;
    rootEl.className = rootEl.className.replace(RIG_CLASSES, '').replace(/\s+/g, ' ').trim();
    rootEl.classList.add('tama-rig', 'egg');
  }

  window.TamaShared.renderRig = renderRig;
  window.TamaShared.renderEgg = renderEgg;
}());
