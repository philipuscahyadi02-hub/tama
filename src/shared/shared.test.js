// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const palette = require('./palette');
const catalog = require('./catalog');
const { normalizeSpec, preset } = require('./spec');
const { compose } = require('./rig/compose');

test('palette: derive makes every token as a hex color; overrides win', () => {
  const vars = palette.derive({ hair: '#2e2a38', eyes: '#5b9cff', main: '#a77bdb', accent: '#ffd34f', skin: '#ffe6d8', shoes: '#ffffff' }, { 'hair-1': '#000000', bad: 'red' });
  for (const v of Object.values(vars)) assert.match(v, /^#[0-9a-f]{6}$/i);
  assert.equal(vars['--hair-1'], '#000000');
  assert.equal(vars['--bad'], undefined);
  // black hair: line/shine must be lighter than the hair, or the outline disappears
  assert.ok(palette.luminance(vars['--hair-line']) > palette.luminance('#000000'));
});

test('normalizeSpec: garbage in → valid spec out (LLM output gate)', () => {
  const s = normalizeSpec({
    name: '  ' + 'x'.repeat(100), gender: 'dragon',
    parts: { hairBack: 'mohawk', headwear: 'frog-hood', accessories: ['ribbon', 'ribbon', 'laser', 5, 'scarf', 'flower', 'freckles'] },
    palette: { hair: 'pink', eyes: '#00FF00' }, personality: { energy: 500, chaos: 'lots' }, voice: { pitch: 9 },
    paletteOverrides: { 'hair-1': '#123456', 'evil;}': '#000000' },
  });
  assert.equal(s.gender, 'girl');
  assert.equal(s.name.length, 24);
  assert.equal(s.parts.hairBack, 'twintails');
  assert.equal(s.parts.headwear, 'frog-hood');
  assert.deepEqual(s.parts.accessories, ['ribbon', 'scarf', 'flower']); // deduped, unknown dropped, max 3
  assert.equal(s.palette.hair, '#ff8fbf');
  assert.equal(s.palette.eyes, '#00ff00');
  assert.equal(s.personality.energy, 100);
  assert.equal(s.personality.chaos, 30);
  assert.equal(s.voice.pitch, 2);
  assert.deepEqual(s.paletteOverrides, { 'hair-1': '#123456' });
  assert.deepEqual(s.pronouns, { subject: 'she', object: 'her', possessive: 'her' });
});

test('gender sets pronouns and default parts, but any part is allowed for anyone', () => {
  const boy = normalizeSpec({ gender: 'boy' });
  assert.equal(boy.pronouns.subject, 'he');
  assert.equal(boy.parts.outfit, 'hoodie');
  const boyInDress = normalizeSpec({ gender: 'boy', parts: { outfit: 'raincoat-dress' } });
  assert.equal(boyInDress.parts.outfit, 'raincoat-dress');
  assert.equal(normalizeSpec({ gender: 'nonbinary' }).pronouns.subject, 'they');
});

test('every catalog part combination composes into SVG without undefined/NaN', () => {
  let n = 0;
  for (const headwear of catalog.ids('headwear')) {
    for (const hairBack of catalog.ids('hairBack')) {
      for (const outfit of catalog.ids('outfit')) {
        for (const eyes of catalog.ids('eyes')) {
          const r = compose({ parts: { headwear, hairBack, outfit, eyes, hairFront: 'swept', shoes: 'sneakers', accessories: catalog.ids('accessories').slice(0, 3) } }, { idPrefix: `t${n++}-` });
          assert.doesNotMatch(r.svg, /undefined|NaN/);
          assert.match(r.svg, /class="headGroup"/);
        }
      }
    }
  }
  for (const a of catalog.ids('accessories')) assert.doesNotMatch(compose({ parts: { accessories: [a] } }).svg, /undefined|NaN/);
});

test('Kero-chan preset reproduces kero-pet exactly: original colors pinned', () => {
  const r = compose(preset('kero'));
  assert.equal(r.vars['--hair-line'], '#e8729f');
  assert.equal(r.vars['--main-dark'], '#62b84e');
  assert.equal(r.vars['--eye-pupil'], '#123a28');
  assert.match(r.svg, /class="hood-eyes"/);
  assert.match(r.svg, /class="tail tail-l"/);
  assert.deepEqual(r.classes, ['eyes-round', 'has-hood']);
});

test('ids are prefixed so several rigs can share one page', () => {
  const a = compose(preset('kero'), { idPrefix: 'a-' }).svg;
  assert.match(a, /id="a-iris"/);
  assert.match(a, /url\(#a-hair\)/);
  assert.doesNotMatch(a, /url\(#hair\)/);
});
