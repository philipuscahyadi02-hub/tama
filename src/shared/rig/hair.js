// @ts-check
// Hair parts: back styles (behind body + head cap), front styles (bangs + side locks), ahoge.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./kit'));
  else (root.TamaShared = root.TamaShared || {}).hair = factory(root.TamaShared.kit);
}(globalThis, function (kit) {
  const { paint, line, mirror } = kit;
  const H = (/** @type {string} */ id) => `url:${id}hair`;

  /** Back-of-head hair mass, visible when there's no hood. @param {string} id */
  const cap = (id) => `<ellipse cx="100" cy="98" rx="56" ry="50" ${paint(H(id), 'hair-line', 1.2)} />`;

  /** @type {Record<string, (id: string) => Record<string, string>>} */
  const BACK = {
    // Ported from kero-pet: two long tails swinging behind the body.
    twintails: (id) => {
      const tail = `<path d="M46 124 C20 140 14 176 28 208 C32 217 26 224 18 229 C42 231 54 211 52 189 C50 166 60 146 58 128 Z" ${paint(H(id), 'hair-line')} />
        <path d="M44 140 C32 160 30 186 38 206" ${line('hair-strand', 2)} opacity=".7" />`;
      return { hairBehind: `<g class="tail tail-l">${tail}</g><g class="tail tail-r">${mirror(tail)}</g>`, headBack: cap(id) };
    },
    long: (id) => ({
      hairBehind: `<path d="M50 92 Q34 150 40 214 Q70 224 100 222 Q130 224 160 214 Q166 150 150 92 Z" ${paint(H(id), 'hair-line')} />
        <path d="M52 140 Q48 176 54 208 M148 140 Q152 176 146 208" ${line('hair-strand', 2)} opacity=".6" />`,
      headBack: cap(id),
    }),
    ponytail: (id) => ({
      hairBehind: `<g class="tail tail-pony"><path d="M128 66 C176 60 186 120 170 168 C164 186 170 198 178 206 C150 206 146 180 152 160 C160 124 152 92 124 84 Z" ${paint(H(id), 'hair-line')} />
        <path d="M150 92 C166 116 166 146 158 168" ${line('hair-strand', 2)} opacity=".6" /></g>`,
      headBack: `${cap(id)}<circle cx="132" cy="70" r="6" ${paint('accent-1', 'accent-line', 1.2)} />`,
    }),
    bob: (id) => ({
      hairBehind: `<path d="M48 96 Q38 140 50 164 Q100 176 150 164 Q162 140 152 96 Z" ${paint(H(id), 'hair-line')} />`,
      headBack: cap(id),
    }),
    short: (id) => ({ headBack: cap(id) }),
  };

  /** @type {Record<string, (id: string) => string>} */
  const FRONT = {
    // Ported from kero-pet: choppy anime bangs + side locks + shine.
    kero: (id) => `
      <path d="M55 86 Q44 120 50 152 Q57 140 59 122 Q61 104 64 92 Z" ${paint(H(id))} />
      <path d="M145 86 Q156 120 150 152 Q143 140 141 122 Q139 104 136 92 Z" ${paint(H(id))} />
      <path d="M50 103 Q47 66 100 61 Q153 66 150 103 Q145 93 141 85 Q137 99 128 105 Q127 91 118 82 Q114 99 104 105 Q102 89 96 80 Q88 97 78 103 Q80 89 76 82 Q66 95 58 105 Q60 93 62 87 Q54 95 50 103 Z" ${paint(H(id), 'hair-line', 1.2)} stroke-linejoin="round" />
      <path d="M66 76 Q100 64 134 76" ${line('hair-shine', 3.2)} opacity=".9" />
      <path d="M72 82 L74 76 M126 82 L124 76" ${line('hair-shine', 2)} />`,
    // Straight blunt fringe + long straight side locks.
    hime: (id) => `
      <path d="M49 92 L48 160 Q54 164 61 158 L62 98 Z" ${paint(H(id), 'hair-line', 1.2)} />
      <path d="M151 92 L152 160 Q146 164 139 158 L138 98 Z" ${paint(H(id), 'hair-line', 1.2)} />
      <path d="M48 101 Q45 60 100 57 Q155 60 152 101 Q126 95 100 96 Q74 95 48 101 Z" ${paint(H(id), 'hair-line', 1.2)} />
      <path d="M64 74 Q100 62 136 74" ${line('hair-shine', 3.2)} opacity=".9" />`,
    // Side-swept bangs, short side locks.
    swept: (id) => `
      <path d="M53 88 Q45 112 51 136 Q58 126 60 112 Q62 100 65 92 Z" ${paint(H(id))} />
      <path d="M147 88 Q155 112 149 136 Q142 126 140 112 Q138 100 135 92 Z" ${paint(H(id))} />
      <path d="M49 104 Q46 62 100 58 Q154 60 152 102 Q146 86 128 78 Q138 92 134 106 Q122 86 98 80 Q110 94 104 104 Q88 86 70 84 Q62 94 49 104 Z" ${paint(H(id), 'hair-line', 1.2)} stroke-linejoin="round" />
      <path d="M70 74 Q104 62 136 76" ${line('hair-shine', 3)} opacity=".85" />`,
    // Spiky boyish fringe + sideburns.
    messy: (id) => `
      <path d="M52 92 L50 128 L58 120 L60 98 Z" ${paint(H(id), 'hair-line', 1.2)} />
      <path d="M148 92 L150 128 L142 120 L140 98 Z" ${paint(H(id), 'hair-line', 1.2)} />
      <path d="M48 106 Q44 58 100 55 Q156 58 152 106 L144 92 L138 104 L128 86 L118 102 L108 84 L98 100 L88 84 L80 102 L70 88 L62 104 L56 92 Z" ${paint(H(id), 'hair-line', 1.2)} stroke-linejoin="round" />
      <path d="M68 72 Q100 60 132 72" ${line('hair-shine', 3)} opacity=".8" />`,
  };

  /** The springy anime antenna. dy shifts it down onto the head when there's no hood. @param {string} id @param {number} dy */
  const ahoge = (id, dy) => `<path class="ahoge" transform="translate(0 ${dy})" d="M101 26 Q94 8 110 3 Q103 13 106 25 Z" ${paint(H(id), 'hair-line', 1.2)} />`;

  return { BACK, FRONT, ahoge };
}));
