/* Dev-only: renders sample designs and every mood so parts can be judged visually (TAMA_GALLERY=1).
   ?set=designs (default) | moods */
const S = window.TamaShared;
const set = new URLSearchParams(location.search).get('set') || 'designs';
const grid = document.getElementById('grid');
let n = 0;

function cell(spec, mood, caption) {
  const c = document.createElement('div');
  c.className = 'cell';
  c.innerHTML = `<div class="tama-rig mood-${mood}"><svg class="rig-svg" viewBox="0 0 200 240"></svg></div><div class="cap">${caption}</div>`;
  grid.appendChild(c);
  S.renderRig(c.firstChild, c.querySelector('svg'), spec, `g${n++}-`);
}

const C = S.catalog.COLORS;
const DESIGNS = [
  ['Kero-chan', S.spec.preset('kero')],
  ['cat girl', { gender: 'girl', parts: { headwear: 'cat-ears', hairBack: 'long', hairFront: 'hime', outfit: 'sailor', shoes: 'loafers', accessories: ['ribbon'] }, palette: { hair: C.black, eyes: '#e8505b', main: C.navy, accent: '#e8505b', skin: '#ffe6d8', shoes: '#4a3a3a' } }],
  ['sleepy cat boy', { gender: 'boy', parts: { headwear: 'cat-ears', hairBack: 'short', hairFront: 'messy', outfit: 'hoodie', shoes: 'sneakers', eyes: 'sleepy', accessories: ['headphones'] }, palette: { hair: C.silver, eyes: C.teal, main: C.lavender, accent: '#5b5b7a', skin: '#ffdcc2', shoes: '#ffffff' } }],
  ['bunny', { gender: 'girl', parts: { headwear: 'bunny-hood', hairBack: 'bob', hairFront: 'swept', outfit: 'cardigan-skirt', shoes: 'loafers', accessories: ['flower'] }, palette: { hair: C.blonde, eyes: C.blue, main: '#fff1f6', accent: C.pink, skin: '#ffe6d8', shoes: '#8a5a44' } }],
  ['bear nb', { gender: 'nonbinary', parts: { headwear: 'bear-hood', hairBack: 'bob', hairFront: 'swept', outfit: 'overalls', shoes: 'sneakers', accessories: ['freckles', 'round-glasses'] }, palette: { hair: C.brown, eyes: '#8a5a44', main: C.brown, accent: C.orange, skin: '#f3c9a5', shoes: '#e8505b' } }],
  ['fox', { gender: 'boy', parts: { headwear: 'fox-ears', hairBack: 'ponytail', hairFront: 'swept', outfit: 'hoodie', shoes: 'sneakers', eyes: 'sharp', accessories: ['scarf'] }, palette: { hair: C.orange, eyes: C.gold, main: '#3a3a4a', accent: '#e8505b', skin: '#d9a77f', shoes: '#ffffff' } }],
  ['plain long', { gender: 'girl', parts: { headwear: 'none', hairBack: 'long', hairFront: 'kero', outfit: 'raincoat-dress', shoes: 'rainboots', accessories: ['star-clip'] }, palette: { hair: C.purple, eyes: C.mint, main: C.mint, accent: C.yellow, skin: '#ffe6d8', shoes: '#5b9cff' } }],
  ['plain short boy', { gender: 'boy', parts: { headwear: 'none', hairBack: 'short', hairFront: 'messy', outfit: 'overalls', shoes: 'loafers', accessories: [] }, palette: { hair: C.chocolate, eyes: C.blue, main: C.blue, accent: C.yellow, skin: '#b07a52', shoes: '#3a3a4a' } }],
  ['frog boy', { gender: 'boy', parts: { headwear: 'frog-hood', hairBack: 'short', hairFront: 'messy', outfit: 'hoodie', shoes: 'rainboots' }, palette: { hair: C.navy, eyes: C.green, main: C.green, accent: C.yellow, skin: '#ffe6d8', shoes: C.yellow } }],
  ['twintail sailor', { gender: 'girl', parts: { headwear: 'none', hairBack: 'twintails', hairFront: 'hime', outfit: 'sailor', shoes: 'loafers', eyes: 'sharp', accessories: ['ribbon'] }, palette: { hair: C['sky blue'], eyes: C.purple, main: C.purple, accent: C.red, skin: '#ffe6d8', shoes: '#3a3a4a' } }],
];
const MOODS = ['normal', 'happy', 'sparkle', 'sad', 'sleep', 'focus', 'smug', 'shock', 'pout', 'dizzy', 'pat', 'eat'];

if (set === 'moods') {
  for (const [name, spec] of DESIGNS.slice(1, 4)) for (const m of MOODS) cell(spec, m, `${name}: ${m}`);
} else {
  for (const [name, spec] of DESIGNS) cell(spec, 'normal', name);
  for (const [name, spec] of DESIGNS) cell(spec, 'happy', `${name} (happy)`);
}
