/* Pet care buttons and panels (QC-4: split out of pet.js). Loaded after pet.js and shares its globals (S, T, say,
   express, …); each action asks the pet service first and the reply's `reason` picks her reaction. */
// ---------------- care actions ----------------
// Each action asks the core first; the reply's `reason` picks the in-character reaction.
const actions = {
  async feed() {
    const r = await T.act('feed');
    if (!r.ok && r.reason === 'asleep') return say('zzz… (shh! sleeping)');
    if (!r.ok) { express('pout', 1500); emote('💢'); return say('mou~ I\'m full! 🙅‍♀️'); }
    particles(pick(['🍙', '🍓', '🍡', '🍮', '🍰', '🍜']), 1, 'drop');
    setTimeout(() => {
      express('eat', 1700); say(pick(['itadakimasu! 🙏', 'oishii~!! ✨', 'mogu mogu…', 'umai! (๑˃ᴗ˂)ﻭ']));
      emote('♡');
    }, 650);
  },
  async play() {
    const r = await T.act('play');
    if (!r.ok && r.reason === 'asleep') return say('zzz…');
    if (!r.ok) { express('sad'); emote('💧', 1800, 'left'); return say('too sleepy… 🥱'); }
    let n = 0; const t = setInterval(() => { hop(); if (++n >= 3) clearInterval(t); }, 480);
    express('sparkle', 1800); particles(['🎀', '💖', '⭐', '🌸'], 6);
    say(pick(['wheee~!', 'mou ikkai! once more!', 'kyaa~ ♪', 'tanoshii~!!']));
  },
  async clean() {
    const r = await T.act('clean');
    if (!r.ok) return say('zzz…');
    particles('🫧', 8); express('happy', 1500); emote('✨');
    say('pika pika~ squeaky clean! ✨');
  },
  async snack() {
    const r = await T.act('snack');
    if (!r.ok && r.reason === 'asleep') return say('zzz… (shh!)');
    if (r.reason === 'cooldown') { express('pout', 1500); return say(`no more sugar for ${Math.ceil(r.retryInMs / 60000)} min… 🍬`); }
    if (r.reason === 'full-energy') return say(`I'm already full of energy!${tic()} ⚡`);
    particles(['⚡', '🍬', '🧃'], 5); express('sparkle', 1600); hop();
    say(pick(['energy~ charged! ⚡', 'gulp gulp… GENKI! 🧃', 'sugar rush~!! 🍬']));
  },
  async nap() {
    if (S.asleep) {
      const r = await T.act('sleep');
      S = r.state; renderMood();
      return say('fuwaa~ ohayou! ☀️');
    }
    const r = await T.act('nap');
    if (r.reason === 'not-tired') return say(`not sleepy at all!${tic()} ✨`);
    S = r.state; renderMood();
    say('just a little power nap… 10 min… 💤');
  },
  async sleep() {
    const r = await T.act('sleep');
    S = r.state;
    say(S.asleep ? 'oyasumi nasai… 💤' : 'fuwaa~ ohayou! ☀️');
    renderMood();
  },
  stats() { togglePanel('stats'); },
  async focus() {
    const s = await T.prod.get();
    if (s.focus.phase === 'focus') { await T.prod.focusStop(); return say('focus stopped. otsukare~'); }
    const r = await T.prod.focusStart(25);
    if (r.ok) { express('focus', 2000); say(`focus mode! 25 min, I'll be quiet~ ganbatte! ⏱️`, 3200, { force: true }); }
  },
  wardrobe() { T.openOnboarding('restyle'); say(`ooh, new clothes?${tic()}`, 2000, { force: true }); },
  code() { T.showTerminal(); say('let\'s code! 💻✨', 2000, { force: true }); },
  chat() { T.showChat(); say(pick(['let\'s talk~ 💬', 'hm? what is it~?', 'I\'m all ears! 👂✨']), 2000, { force: true }); },
};

function togglePanel(id) {
  const el = document.getElementById(id);
  const willOpen = el.classList.contains('hidden');
  el.classList.toggle('hidden', !willOpen);
  if (willOpen) bubbleEl.classList.add('hidden');
  renderStats();
}
document.querySelectorAll('[data-close]').forEach((b) =>
  b.addEventListener('click', () => document.getElementById(b.dataset.close).classList.add('hidden')));
menuEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  menuEl.classList.add('hidden');
  actions[b.dataset.act]();
});
// The caption under the buttons names whatever you hover (no native tooltips needed).
const menuCap = $('#menuCap');
menuEl.addEventListener('mouseover', (e) => {
  const b = e.target.closest('button[data-label]');
  menuCap.textContent = b ? b.dataset.label : 'what shall we do?';
});
menuEl.addEventListener('mouseleave', () => { menuCap.textContent = 'what shall we do?'; });
T.onTray((a) => !isEgg && actions[a] && actions[a]());

