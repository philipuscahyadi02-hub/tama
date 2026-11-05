/* Tama pet window. Ported from kero-pet/renderer/pet.js.
   This is a view: stats live in the pet service (src/main/services/pet). We render the state we
   receive and send intents via window.tama.act(). The Kero-chan art stays until the M1 rig. */
const $ = (s) => document.querySelector(s);
const petEl = $('#pet');
const svgEl = $('#kero');
const bubbleEl = $('#bubble');
const menuEl = $('#menu');
const emoteEl = $('#emote');
const T = window.tama;

// ---------------- state (read-only copy of the pet service's state) ----------------
let S = { hunger: 80, happy: 80, energy: 80, clean: 80, bond: 10, asleep: false, bornAt: Date.now(), xp: 0, pats: 0 };
let petName = 'Kero-chan';
/** Apply a { name, state } snapshot from the core. */
function applySnapshot(snap) {
  if (!snap) return;
  const wasAsleep = S.asleep;
  S = snap.state; petName = snap.name || petName;
  if (wasAsleep && !S.asleep) say('fully charged! ⚡ ohayou~');
  checkNeeds(); renderMood();
  if (!$('#stats').classList.contains('hidden')) renderStats();
}

const BOND_TITLES = [
  [0, 'Stranger-san 👀'], [20, 'Classmate 📚'], [40, 'Friend ✌️'],
  [60, 'Best friend 💞'], [80, 'Senpai noticed you!! 💖'], [100, 'Soulmates (kero) 🐸💍'],
];
const bondTitle = () => BOND_TITLES.filter(([n]) => S.bond >= n).pop()[1];

// ---------------- click-through ----------------
let capturing = false;
let dragging = false;
document.addEventListener('mousemove', (e) => {
  const over = !!e.target.closest('.hit');
  if (over !== capturing && !dragging) { capturing = over; T.setCapture(over); }
});

// ---------------- speech & emotes ----------------
let bubbleTimer = null;
let bubbleAction = null;
function say(text, ms = 3200, opts = {}) {
  if (!menuEl.classList.contains('hidden') && !opts.force) return;
  bubbleEl.textContent = text;
  bubbleEl.className = 'hit' + (opts.shout ? ' shout' : '') + (opts.onClick ? ' clicky' : '');
  bubbleAction = opts.onClick || null;
  bubbleEl.style.animation = 'none'; void bubbleEl.offsetWidth; bubbleEl.style.animation = '';
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubbleEl.classList.add('hidden'), ms);
}
bubbleEl.addEventListener('click', () => { if (bubbleAction) bubbleAction(); bubbleEl.classList.add('hidden'); });

let emoteTimer = null;
function emote(sym, ms = 1600, side = 'right') {
  emoteEl.textContent = sym;
  emoteEl.classList.toggle('left', side === 'left');
  emoteEl.classList.add('show');
  clearTimeout(emoteTimer);
  emoteTimer = setTimeout(() => emoteEl.classList.remove('show'), ms);
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const BABBLE = [
  'kero kero~ ♪', 'nyaa~?', 'ehehe~', 'kerokero desu!', '*hums anime opening*', 'ganbarimasu! 💪',
  'sugoi… the desktop is so big', 'boop! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', 'is it lunch time? 🍙', 'fufu~ 😼', 'ribbit ribbit ✨',
  '(｡•̀ᴗ-)✧', 'want to code together? 💻', 'my hood has eyes too, see? 👀',
];

// ---------------- expressions ----------------
let override = null;
let overrideUntil = 0;
function express(mood, ms = 1500) { override = mood; overrideUntil = Date.now() + ms; renderMood(); }

let agentState = 'idle';
function baseMood() {
  if (S.asleep) return 'sleep';
  if (agentState === 'permission') return 'shock';
  if (agentState !== 'idle') return 'focus';
  if (S.happy < 25 && S.hunger >= 25) return 'pout';
  if (Math.min(S.hunger, S.clean) < 25 || S.energy < 15) return 'sad';
  if (S.happy > 75 && S.hunger > 50) return 'happy';
  return 'normal';
}
function renderMood() {
  const m = override && Date.now() < overrideUntil ? override : baseMood();
  petEl.className = petEl.className.replace(/\bmood-\w+/g, '').replace(/\s+/g, ' ').trim() + ' mood-' + m;
  petEl.classList.toggle('asleep', S.asleep);
  petEl.classList.toggle('working', agentState !== 'idle');
}
function anim(cls, ms) {
  petEl.classList.remove(cls); void petEl.offsetWidth; petEl.classList.add(cls);
  setTimeout(() => petEl.classList.remove(cls), ms);
}
const hop = () => anim('hop', 500);

function particles(emoji, n = 5, kind = 'rise') {
  const fx = $('#fx');
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'particle ' + kind;
    p.textContent = Array.isArray(emoji) ? pick(emoji) : emoji;
    const cx = fx.clientWidth / 2;
    p.style.left = cx - 12 + (kind === 'drop' ? 0 : (Math.random() - 0.5) * 120) + 'px';
    p.style.bottom = (kind === 'drop' ? 130 : 110 + Math.random() * 60) + 'px';
    if (kind === 'burst') {
      const a = (i / n) * Math.PI * 2;
      p.style.setProperty('--dx', Math.cos(a) * 110 + 'px');
      p.style.setProperty('--dy', Math.sin(a) * 90 + 'px');
      p.style.left = cx - 12 + 'px'; p.style.bottom = '110px';
    } else p.style.animationDelay = (kind === 'drop' ? 0 : i * 0.12) + 's';
    fx.appendChild(p);
    setTimeout(() => p.remove(), 1800);
  }
}

function henshin(line) {
  stopWalking();
  anim('henshin', 1150);
  particles(['✨', '⭐', '💫', '🌸', '💖'], 12, 'burst');
  say(line, 3000, { shout: true });
  setTimeout(() => express('sparkle', 1800), 600);
}

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
  async sleep() {
    const r = await T.act('sleep');
    S = r.state;
    say(S.asleep ? 'oyasumi nasai… 💤' : 'fuwaa~ ohayou! ☀️');
    renderMood();
  },
  stats() { togglePanel('stats'); },
  code() { T.showTerminal(); say('let\'s code! 💻✨', 2000, { force: true }); },
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
T.onTray((a) => actions[a] && actions[a]());

// ---------------- pointer: click / drag / head-pat / cheek-poke ----------------
function svgPoint(e) {
  const r = svgEl.getBoundingClientRect();
  let x = ((e.clientX - r.left) / r.width) * 200;
  if (petEl.classList.contains('face-left')) x = 200 - x;
  return { x, y: ((e.clientY - r.top) / r.height) * 240 };
}
const onHead = (p) => p.y < 80 && Math.abs(p.x - 100) < 75;
const onCheek = (p) => p.y > 118 && p.y < 152 && Math.abs(p.x - 100) > 22 && Math.abs(p.x - 100) < 52;

// Head pats: rub the mouse left-right over the hood (no click needed).
let patDir = 0, patLastX = null, patFlips = 0, patT0 = 0;
petEl.addEventListener('mousemove', (e) => {
  if (down || dragging) return;
  const p = svgPoint(e);
  if (!onHead(p)) { patLastX = null; return; }
  if (patLastX != null) {
    const d = Math.sign(p.x - patLastX);
    if (d && d !== patDir) {
      if (patDir && Date.now() - patT0 < 1400) patFlips++; else { patFlips = 0; patT0 = Date.now(); }
      patDir = d;
    }
  }
  patLastX = p.x;
  if (patFlips >= 4) { patFlips = 0; patT0 = Date.now(); headPat(); }
});
let lastPat = 0;
function headPat() {
  if (S.asleep) { say('mmh… ehehe… (sleep-smiling)'); return; }
  if (Date.now() - lastPat < 1200) return;
  lastPat = Date.now();
  T.act('pat');
  express('pat', 2200); emote('♡'); particles(['💗', '💕', '✨'], 3);
  say(pick(['ehehe~ nade nade ♡', 'f-fueee… (≧◡≦)', 'more pats pls…', 'k-kero… *blushes*', 'nyaa~ ♡']));
}

let down = null;
petEl.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  down = { x: e.screenX, y: e.screenY, lastX: e.screenX, lastY: e.screenY, moved: false, p: svgPoint(e) };
});
window.addEventListener('mousemove', (e) => {
  if (!down) return;
  if (!down.moved && Math.hypot(e.screenX - down.x, e.screenY - down.y) > 5) {
    down.moved = true; dragging = true; petEl.classList.add('dragging');
    stopWalking(); menuEl.classList.add('hidden');
    express('shock', 99999); emote('❗');
    say(pick(['kyaa~! where are we going?!', 'hawawa!!', 'I can fly~ ✈️']));
  }
  if (down.moved) {
    T.dragBy(e.screenX - down.lastX, e.screenY - down.lastY);
    down.lastX = e.screenX; down.lastY = e.screenY;
  }
});
window.addEventListener('mouseup', () => {
  if (!down) return;
  if (down.moved) {
    dragging = false; petEl.classList.remove('dragging');
    override = null; hop(); emote('💧', 1400, 'left'); say('…phew. kero.');
  } else if (onCheek(down.p) && !S.asleep) {
    // cheek poke → puffed-cheek pout
    express('pout', 1800); emote('💢');
    say(pick(['mou~! don\'t poke! 😤', 'puni puni… hmph!', 'b-baka! 💢']));
  } else {
    const open = menuEl.classList.contains('hidden');
    bubbleEl.classList.add('hidden');
    menuEl.classList.toggle('hidden', !open);
    if (open && !S.asleep) { express('happy', 900); hop(); }
  }
  down = null;
});

// ---------------- wandering ----------------
let walkTimer = null;
let dir = 1;
function startWalking(ms) {
  if (S.asleep || agentState !== 'idle' || dragging) return;
  dir = Math.random() < 0.5 ? -1 : 1;
  petEl.classList.add('walking');
  petEl.classList.toggle('face-left', dir < 0);
  const end = Date.now() + ms;
  walkTimer = setInterval(async () => {
    if (Date.now() > end) return stopWalking();
    const r = await T.walk(dir * 2);
    if ((r.atLeft && dir < 0) || (r.atRight && dir > 0)) { dir = -dir; petEl.classList.toggle('face-left', dir < 0); }
  }, 30);
}
function stopWalking() { clearInterval(walkTimer); walkTimer = null; petEl.classList.remove('walking'); }

function behave() {
  const busyUi = !!document.querySelector('.panel:not(.hidden)') || !menuEl.classList.contains('hidden');
  if (!busyUi && !walkTimer && !dragging && agentState === 'idle') {
    const r = Math.random();
    if (r < 0.35) startWalking(2000 + Math.random() * 4000);
    else if (r < 0.55 && !S.asleep) say(pick(BABBLE), 2400);
    else if (r < 0.62 && !S.asleep) { express('smug', 1800); emote('♪'); }
  }
  setTimeout(behave, 5000 + Math.random() * 7000);
}

// ---------------- needs ----------------
const warned = {};
function checkNeeds() {
  const needs = [
    ['hunger', 'onaka suita… I\'m hungwy 🍙', 'Kero-chan is hungry!'],
    ['clean', 'I feel icky… bath pls 🛁', 'Kero-chan needs a bath'],
    ['happy', 'h-hmph! it\'s not like I want to play with you or anything… 💢', 'Kero-chan is sulking'],
  ];
  for (const [k, line, note] of needs) {
    if (S[k] < 25 && !warned[k]) { warned[k] = true; say(line, 4500); T.notify(petName, note.replace('Kero-chan', petName)); }
    else if (S[k] > 40) warned[k] = false;
  }
}

function renderStats() {
  for (const k of ['hunger', 'happy', 'energy', 'clean', 'bond']) {
    const el = document.getElementById('b-' + k);
    el.style.width = S[k] + '%';
    if (k !== 'bond') el.className = S[k] < 25 ? 'low' : S[k] < 50 ? 'mid' : '';
  }
  const days = Math.floor((Date.now() - S.bornAt) / 86400000);
  $('#statsTitle').textContent = `${petName} · Lv ${1 + Math.floor(S.xp / 5)}`;
  $('#bondTitle').textContent = bondTitle();
  $('#ageLine').textContent = `${days} day${days === 1 ? '' : 's'} together · ${S.xp} coding quests · ${S.pats} pats`;
}

// ---------------- reacting to Kero Code (the agent) ----------------
const TOOL_LINES = {
  Read: '📖 reading', Glob: '🔎 looking for', Grep: '🔍 searching', Edit: '✏️ editing', MultiEdit: '✏️ editing',
  Write: '📝 writing', Bash: '💻 running', WebFetch: '🌐 reading', WebSearch: '🌐 searching', TodoWrite: '📋 planning',
  Task: '👯 asking a friend', Agent: '👯 asking a friend',
};
const short = (s) => String(s || '').split(/[\\/]/).pop().slice(0, 28);
let lastToolSay = 0;
T.onAgent((ev) => {
  switch (ev.t) {
    case 'status':
      if (ev.state !== agentState) {
        const was = agentState;
        agentState = ev.state;
        if (was === 'idle' && ev.state !== 'idle') { stopWalking(); say(pick(['yosh, ganbaru! 💪', 'hmm hmm… 🤓', 'leave it to me~!']), 2000); }
        renderMood();
      }
      break;
    case 'tool':
      if (Date.now() - lastToolSay > 2500) {
        lastToolSay = Date.now();
        const i = ev.input || {};
        say(`${TOOL_LINES[ev.name] || '🔧 ' + ev.name} ${short(i.file_path || i.pattern || i.command || i.url || i.query || i.description || '')}`.trim(), 2200);
      }
      break;
    case 'permission':
      emote('❗'); hop();
      say(`ano… may I use ${ev.name}? 🥺\n(click to answer)`, 15000, { force: true, onClick: () => T.showTerminal() });
      break;
    case 'result':
      if (ev.isError) { express('dizzy', 2500); emote('💧', 2000, 'left'); say('hawawa… something went wrong 😵‍💫'); }
      else {
        express('sparkle', 2600); hop(); particles(['✨', '⭐', '🎉'], 6);
        say(pick(['yatta~! done! ✨', 'mission complete! (ง •̀_•́)ง', 'sugoi desho? ✨', 'kanpeki! perfect~ 💯']), 3000);
      }
      break;
    case 'mode':
      if (ev.mode === 'acceptEdits') henshin('HENSHIN! ✨ Edit-mode Kero!');
      else if (ev.mode === 'plan') henshin('Strategy mode… 📋 fufu~');
      else if (ev.mode === 'default') { express('happy', 1200); say('back to normal~ kero!'); }
      break;
    case 'error':
      express('dizzy', 2200); emote('💧', 2000, 'left');
      break;
    case 'cwd':
      express('sparkle', 1500); say(ev.isGit ? `ooh, ${short(ev.cwd)}! a new adventure~ 🗺️` : `${short(ev.cwd)}… no git here, but ok!`);
      break;
  }
});

// ---------------- boot ----------------
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'it\'s so late… go to sleep, baka! 💢';
  if (h < 11) return 'ohayou gozaimasu~! ☀️';
  if (h < 17) return 'konnichiwa~! 🌸';
  if (h < 22) return 'konbanwa~ 🌙';
  return 'oyasumi time soon… 🌙';
}

// Summoned back on screen (Ctrl+Alt+P, tray click, /summon…): play a little "tadaa".
T.onSummon(() => {
  stopWalking(); hop(); express('sparkle', 1800); particles(['✨', '⭐', '💫'], 8, 'burst');
  say(pick(['tadaa~! I\'m here! ✨', 'you called? (｡•̀ᴗ-)✧', 'kero! reporting for duty~ 🫡']), 2600, { force: true });
});
T.onPetState(applySnapshot);

(async function boot() {
  const snap = await T.getPet();
  applySnapshot(snap);
  const s = snap.state;
  const firstMeet = s.xp === 0 && s.pats === 0 && Date.now() - s.bornAt < 60000;
  if (firstMeet) {
    setTimeout(() => { express('sparkle', 2500); say(`hajimemashite! I'm ${petName} 🐸🎀\nclick me! (rub my hood for pats~)`, 6000); }, 800);
  } else if (snap.hoursAway > 2) {
    setTimeout(() => { express('sad', 2500); say(`${Math.round(snap.hoursAway)} hours… I was lonely 🥺`, 4500); }, 800);
  } else {
    setTimeout(() => say(`${greeting()} okaeri!`), 800);
  }
  // Timed expressions expire between state updates, so re-render once a second.
  setInterval(renderMood, 1000);
  setTimeout(behave, 4000);
})();
