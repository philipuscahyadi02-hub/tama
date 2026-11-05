// @ts-check
// Every selectable rig part with a label and keywords. The designer (LLM and keyword fallback) may
// only pick ids listed here (ART-2). Adding a part = draw it in src/shared/rig/* + list it here.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.TamaShared = root.TamaShared || {}).catalog = factory();
}(globalThis, function () {
  /** @typedef {{ id: string, label: string, keywords: string[] }} Part */

  /** @type {Record<string, Part[]>} */
  const PARTS = {
    hairBack: [
      { id: 'twintails', label: 'Twin tails', keywords: ['twintail', 'twin tail', 'pigtail', 'twin-tail'] },
      { id: 'long', label: 'Long', keywords: ['long hair', 'long'] },
      { id: 'ponytail', label: 'Ponytail', keywords: ['ponytail', 'pony tail'] },
      { id: 'bob', label: 'Bob', keywords: ['bob', 'medium', 'shoulder'] },
      { id: 'short', label: 'Short', keywords: ['short hair', 'short', 'buzz', 'crop'] },
    ],
    hairFront: [
      { id: 'kero', label: 'Choppy bangs', keywords: ['choppy', 'fluffy', 'cute bangs'] },
      { id: 'hime', label: 'Hime cut', keywords: ['hime', 'blunt', 'straight', 'princess', 'elegant'] },
      { id: 'swept', label: 'Side-swept', keywords: ['swept', 'side part', 'cool', 'calm'] },
      { id: 'messy', label: 'Messy spikes', keywords: ['messy', 'spiky', 'wild', 'boyish', 'bed head'] },
    ],
    headwear: [
      { id: 'frog-hood', label: 'Frog hood', keywords: ['frog', 'kero', 'toad', 'rain'] },
      { id: 'bunny-hood', label: 'Bunny hood', keywords: ['bunny', 'rabbit', 'usagi'] },
      { id: 'bear-hood', label: 'Bear hood', keywords: ['bear', 'kuma', 'teddy', 'panda'] },
      { id: 'cat-ears', label: 'Cat ears + tail', keywords: ['cat', 'neko', 'kitten', 'kitty', 'nya'] },
      { id: 'fox-ears', label: 'Fox ears + tail', keywords: ['fox', 'kitsune'] },
      { id: 'none', label: 'Nothing', keywords: ['human', 'plain', 'no ears'] },
    ],
    outfit: [
      { id: 'raincoat-dress', label: 'Raincoat dress', keywords: ['raincoat', 'dress', 'rain'] },
      { id: 'hoodie', label: 'Hoodie', keywords: ['hoodie', 'sweater', 'sleepy', 'cozy', 'casual', 'gamer'] },
      { id: 'sailor', label: 'Sailor uniform', keywords: ['sailor', 'school', 'uniform', 'student', 'seifuku'] },
      { id: 'overalls', label: 'Overalls', keywords: ['overalls', 'farmer', 'mechanic', 'dungarees', 'workshop'] },
      { id: 'cardigan-skirt', label: 'Cardigan & skirt', keywords: ['cardigan', 'skirt', 'librarian', 'soft', 'bookworm'] },
    ],
    shoes: [
      { id: 'rainboots', label: 'Rain boots', keywords: ['boots', 'rain'] },
      { id: 'sneakers', label: 'Sneakers', keywords: ['sneaker', 'sporty', 'runner', 'shoes'] },
      { id: 'loafers', label: 'Loafers & socks', keywords: ['loafer', 'school', 'socks', 'formal'] },
    ],
    accessories: [
      { id: 'star-clip', label: 'Star hair clip', keywords: ['star', 'clip', 'sparkle'] },
      { id: 'ribbon', label: 'Big ribbon', keywords: ['ribbon', 'bow'] },
      { id: 'flower', label: 'Flower', keywords: ['flower', 'sakura', 'blossom', 'floral'] },
      { id: 'headphones', label: 'Headphones', keywords: ['headphone', 'music', 'gamer', 'dj'] },
      { id: 'round-glasses', label: 'Round glasses', keywords: ['glasses', 'nerd', 'smart', 'bookworm', 'megane'] },
      { id: 'freckles', label: 'Freckles', keywords: ['freckle'] },
      { id: 'scarf', label: 'Scarf', keywords: ['scarf', 'winter', 'cold', 'muffler'] },
    ],
    eyes: [
      { id: 'round', label: 'Round sparkly', keywords: ['round', 'big eyes', 'sparkly', 'cute'] },
      { id: 'sleepy', label: 'Sleepy', keywords: ['sleepy', 'drowsy', 'lazy', 'tired', 'half-closed'] },
      { id: 'sharp', label: 'Sharp', keywords: ['sharp', 'cool', 'serious', 'tsundere', 'smug'] },
    ],
  };

  /** Named colors the keyword designer understands (hex values tuned for anime hair/eyes). */
  const COLORS = {
    pink: '#ff8fbf', red: '#e8505b', orange: '#ff9a4d', yellow: '#ffd34f', blonde: '#f6d26b', gold: '#e8b93c',
    green: '#84d16d', mint: '#8fe3c4', teal: '#3fb8b0', blue: '#5b9cff', navy: '#3a4f8f', 'sky blue': '#8cc8ff',
    purple: '#a77bdb', lavender: '#c3a6f0', lilac: '#c9a2e8', brown: '#8a5a44', chocolate: '#6b3f2e',
    black: '#2e2a38', white: '#f4f1f6', silver: '#c8cdd8', grey: '#9a98a6', gray: '#9a98a6', cream: '#fff1d6',
  };

  const GENDERS = /** @type {const} */ (['girl', 'boy', 'nonbinary']);

  /** @param {string} category */
  const ids = (category) => (PARTS[category] || []).map((p) => p.id);

  return { PARTS, COLORS, GENDERS, ids };
}));
