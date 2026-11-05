// @ts-check
// CharacterSpec → SVG markup + CSS variables. Pure string building: runs in the renderer and in Node tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./kit'), require('./face'), require('./hair'), require('./headwear'),
      require('./outfit'), require('./accessories'), require('../palette'), require('../spec'));
  } else {
    const S = root.TamaShared;
    S.rig = factory(S.kit, S.face, S.hair, S.headwear, S.outfit, S.accessories, S.palette, S.spec);
  }
}(globalThis, function (kit, face, hair, headwear, outfit, accessories, palette, specMod) {
  /**
   * @param {any} rawSpec  any spec-like object; normalized first
   * @param {{ idPrefix?: string }} [opts]  unique per SVG on the page (gradient ids)
   * @returns {{ svg: string, vars: Record<string, string>, classes: string[], spec: any }}
   */
  function compose(rawSpec, opts = {}) {
    const spec = specMod.normalizeSpec(rawSpec);
    const id = opts.idPrefix || '';
    const p = spec.parts;
    const hw = headwear.HEADWEAR[p.headwear];

    /** @type {Record<string, string[]>} */
    const slots = {};
    /** @param {Record<string, string> | undefined} frag */
    const add = (frag) => { for (const [k, v] of Object.entries(frag || {})) (slots[k] = slots[k] || []).push(v); };

    add(hair.BACK[p.hairBack](id));
    add(hw.build(id));
    add({ legs: outfit.LEGS, shoes: outfit.SHOES[p.shoes]() });
    add(outfit.OUTFITS[p.outfit].build(id));
    add({ face: `${face.skin}${face.blush}`, hairFront: hair.FRONT[p.hairFront](id) });
    if (p.ahoge) add({ ahoge: hair.ahoge(id, hw.hood ? 0 : 24) });
    for (const a of p.accessories) {
      add(a === 'freckles' ? { faceDetail: face.FRECKLES } : accessories.ACCESSORIES[a]({ hood: hw.hood }));
    }

    /** @param {(s: string) => boolean} pick */
    const join = (pick) => kit.SLOTS.filter(pick).map((s) => (slots[s] || []).join('')).join('');
    const outside = join((s) => !kit.HEAD_SLOTS.has(s) && !kit.BODY_SLOTS.has(s));
    const bodyG = join((s) => kit.BODY_SLOTS.has(s));
    const headG = join((s) => kit.HEAD_SLOTS.has(s));

    // Layer order: shadow, back hair + motif tail + legs + shoes, body group, head group (+ expressions).
    const svg = `<defs>${face.defs(id)}</defs>
      <ellipse cx="100" cy="235" rx="48" ry="5" style="fill:rgba(0,0,0,.16)" />
      ${outside}
      <g id="${id}bodyGroup" class="bodyGroup">${bodyG}</g>
      <g id="${id}headGroup" class="headGroup">${headG}${face.expressions({ eyes: p.eyes, idPrefix: id })}</g>`;

    const classes = [`eyes-${p.eyes}`, hw.hood ? 'has-hood' : 'no-hood'];
    return { svg, vars: palette.derive(spec.palette, spec.paletteOverrides), classes, spec };
  }

  return { compose };
}));
