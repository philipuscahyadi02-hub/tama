/* Tama pet window. Ported from kero-pet/renderer/pet.js.
   This is a view: stats live in the pet service (src/main/services/pet). We render the state we
   receive and send intents via window.tama.act(). The character is drawn by the shared rig from
   the active Tama's CharacterSpec (src/shared); lines use the spec's speech tics/catchphrases. */
const $ = (s) => document.querySelector(s);
const petEl = $('#pet');
const svgEl = $('#kero');
const bubbleEl = $('#bubble');
const menuEl = $('#menu');
const emoteEl = $('#emote');
const T = window.tama;

// ---------------- state (read-only copy of the pet service's state) ----------------
let S = { hunger: 80, happy: 80, energy: 80, clean: 80, bond: 10, asleep: false, bornAt: Date.now(), xp: 0, pats: 0 };
let petName = 'Tama';
let spec = null;          // active CharacterSpec
let isEgg = false;        // unhatched: show the egg, no care actions (ONB-1)
let focusing = false;     // focus timer running: quiet, glasses on (PROD-1)
/** A random verbal tic from the character's speech style ("" if none). */
const tic = () => (spec && spec.speech.tics.length ? ' ' + pick(spec.speech.tics) : '');
const myEmoji = () => (spec && spec.speech.emoji.length ? pick(spec.speech.emoji) : '✨');
/** Apply a { name, state } snapshot from the core. */
let level = { index: 0, title: 'Stranger', emoji: '👀', progress: 0, xp: 0, next: 60 };
let charging = false;
function applySnapshot(snap) {
  if (!snap) return;
  const wasAsleep = S.asleep;
  const wasKind = S.sleepKind;
  const wasCharging = charging;
  S = snap.state; petName = snap.name || petName;
  if (snap.level) level = snap.level;
  charging = !!snap.charging;
  if (wasAsleep && !S.asleep) {
    if (wasKind === 'auto') say(`ah! you're back~ okaeri!${tic()}`);
    else if (wasKind === 'nap') say('power nap complete! ⚡ genki 100%!');
    else say('fully charged! ⚡ ohayou~');
  }
  if (!wasCharging && charging && !S.asleep && spec) { emote('🔌', 1800); say('ooh, charging~ ⚡ that tickles', 2400); }
  checkNeeds(); renderMood();
  if (!$('#stats').classList.contains('hidden')) renderStats();
}


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
  'ehehe~', '*hums anime opening*', 'ganbarimasu! 💪', 'sugoi… the desktop is so big',
  'boop! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', 'is it lunch time? 🍙', 'fufu~ 😼', '(｡•̀ᴗ-)✧', 'want to code together? 💻',
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
  petEl.classList.toggle('working', focusing || agentState !== 'idle');
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
T.onTray((a) => !isEgg && actions[a] && actions[a]());

// ---------------- pointer: click / drag / head-pat / cheek-poke ----------------
function svgPoint(e) {
  const r = svgEl.getBoundingClientRect();
  let x = ((e.clientX - r.left) / r.width) * 200;
  if (petEl.classList.contains('face-left')) x = 200 - x;
  return { x, y: ((e.clientY - r.top) / r.height) * 240 };
}
const onHead = (p) => p.y < 80 && Math.abs(p.x - 100) < 75;
const onCheek = (p) => p.y > 118 && p.y < 152 && Math.abs(p.x - 100) > 22 && Math.abs(p.x - 100) < 52;

// Head pats: rub the mouse left-right over the head (no click needed).
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
  if (isEgg) { anim('wobble', 900); say('*crack…?* 🥚'); return; }
  if (S.asleep) { say('mmh… ehehe… (sleep-smiling)'); return; }
  if (Date.now() - lastPat < 1200) return;
  lastPat = Date.now();
  T.act('pat');
  express('pat', 2200); emote('♡'); particles(['💗', '💕', '✨'], 3);
  say(pick(['ehehe~ nade nade ♡', 'f-fueee… (≧◡≦)', 'more pats pls…', `*blushes*${tic()}`, `${myEmoji()} ♡`]));
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
    override = null; hop(); emote('💧', 1400, 'left'); say(isEgg ? '*wobble*' : `…phew.${tic()}`);
  } else if (isEgg) {
    // The egg is the onboarding entry point (ONB-1).
    anim('wobble', 900); say('✨ something is hatching… ✨', 2500, { force: true });
    T.openOnboarding();
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
  if (S.asleep || isEgg || agentState !== 'idle' || dragging) return;
  dir =Math.random() < 0.5 ? -1 : 1;
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
  if (isEgg) {
    if (Math.random() < 0.6) anim('wobble', 900);
  } else if (!busyUi && !walkTimer && !dragging && agentState === 'idle' && !focusing) {
    const r = Math.random();
    if (r < 0.35) startWalking(2000 + Math.random() * 4000);
    else if (r < 0.55 && !S.asleep) say(pick([...BABBLE, ...(spec ? spec.speech.catchphrases : [])]) + tic(), 2400);
    else if (r < 0.62 && !S.asleep) { express('smug', 1800); emote('♪'); }
  }
  setTimeout(behave, 5000 + Math.random() * 7000);
}

// ---------------- needs ----------------
const warned = {};
function checkNeeds() {
  if (isEgg) return;
  const needs = [
    ['hunger', 'onaka suita… I\'m hungwy 🍙', 'is hungry!'],
    ['clean', 'I feel icky… bath pls 🛁', 'needs a bath'],
    ['happy', 'h-hmph! it\'s not like I want to play with you or anything… 💢', 'is sulking'],
  ];
  for (const [k, line, note] of needs) {
    if (S[k] < 25 && !warned[k]) { warned[k] = true; say(line, 4500); T.notify(petName, `${petName} ${note}`); }
    else if (S[k] > 40) warned[k] = false;
  }
}

function renderStats() {
  for (const k of ['hunger', 'happy', 'energy', 'clean']) {
    const el = document.getElementById('b-' + k);
    el.style.width = S[k] + '%';
    el.className = S[k] < 25 ? 'low' : S[k] < 50 ? 'mid' : '';
  }
  $('#b-bond').style.width = Math.round(level.progress * 100) + '%';
  const days = Math.floor((Date.now() - S.bornAt) / 86400000);
  $('#statsTitle').textContent = `${petName} · Lv ${level.index + 1}${charging ? ' · 🔌' : ''}${S.asleep ? ' · 💤' : ''}`;
  $('#bondTitle').textContent = `${level.title} ${level.emoji}` + (level.next ? `  (${Math.floor(level.xp)} / ${level.next})` : '  (max!)');
  const st = S.streak || { count: 0 };
  $('#streakLine').textContent = st.count ? `🔥 ${st.count}-day streak` : 'do something productive today to start a streak 🔥';
  $('#ageLine').textContent = `${days} day${days === 1 ? '' : 's'} together · ${S.xp} quests · ${S.pats} pats`;
}

// ---------------- productivity (PROD-1/2) ----------------

T.prod.onFocus((f) => {
  focusing = f.phase === 'focus';
  petEl.classList.toggle('working', focusing || agentState !== 'idle');
  if (f.completed) {
    stopWalking(); hop(); express('sparkle', 2600); particles(['⏱️', '✨', '💗'], 8, 'burst');
    say(`focus done!! otsukaresama~ break time ☕${tic()}`, 4000, { force: true });
  } else if (f.breakOver) say('break over! one more round? ⏱️', 3000);
});
T.prod.onReminder((r) => {
  stopWalking(); hop(); emote('⏰', 3000);
  say(`⏰ ${r.text}`, 12000, { shout: true, force: true });
});
T.prod.onCommit((c) => { emote('💗', 1600); say(`nice commit in ${c.repo}~ ✨`, 2400); });
T.prod.get().then((s) => { focusing = s.focus.phase === 'focus'; petEl.classList.toggle('working', focusing); });

// Bond XP from care and productivity (BOND-1..3): floating hearts, streaks, level-ups.
T.onBond((b) => {
  if (isEgg) return;
  if (b.levelUp) {
    stopWalking(); hop(); express('sparkle', 3200); particles(['💖', '✨', '🎉', '💞'], 14, 'burst');
    say(`LEVEL UP!! we're ${b.levelUp.title} now ${b.levelUp.emoji}${tic()}`, 5000, { shout: true, force: true });
    T.notify(petName, `Bond level up: ${b.levelUp.title} ${b.levelUp.emoji}`);
  } else if (b.streak && b.streak.count > 1) {
    emote('🔥', 2000); say(`${b.streak.count}-day streak! ganbatta ne~ 🔥`, 3000);
  } else if (b.gained >= 1 && ['commit', 'focus', 'todo'].includes(b.source)) {
    particles(['💗'], Math.min(4, Math.ceil(b.gained)), 'rise');
  }
  if (!$('#stats').classList.contains('hidden')) renderStats();
});

// ---------------- reacting to the agent ----------------
const TOOL_LINES = {
  Read: '📖 reading', Glob: '🔎 looking for', Grep: '🔍 searching', Edit: '✏️ editing', MultiEdit: '✏️ editing',
  Write: '📝 writing', Bash: '💻 running', WebFetch: '🌐 reading', WebSearch: '🌐 searching', TodoWrite: '📋 planning',
  Task: '👯 asking a friend', Agent: '👯 asking a friend',
};
const short = (s) => String(s || '').split(/[\\/]/).pop().slice(0, 28);
let lastToolSay = 0;
T.onBrainNotice((n) => { if (!isEgg) { emote(n.kind === 'warn' ? '💭' : '✨', 1800); say(n.text, 6000); } });
let liteReply = '';
T.onAgent((ev) => {
  if (ev.role === 'lite') {
    // Chat brain: show the reply in the bubble (desktop chat), no quest celebration (PET-4).
    if (ev.t === 'text-start') liteReply = '';
    else if (ev.t === 'text-delta') liteReply += ev.text;
    else if (ev.t === 'result' && !ev.isError && liteReply.trim()) {
      const t = liteReply.trim();
      say(t.length > 220 ? `${t.slice(0, 217)}…` : t, Math.min(14000, 4000 + t.length * 45), { force: true });
    }
    return;
  }
  if (ev.role === 'brain') return;
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
      if (ev.mode === 'acceptEdits') henshin(`HENSHIN! ✨ Edit-mode ${petName}!`);
      else if (ev.mode === 'plan') henshin('Strategy mode… 📋 fufu~');
      else if (ev.mode === 'default') { express('happy', 1200); say(`back to normal~${tic()}`); }
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
  say(pick(['tadaa~! I\'m here! ✨', 'you called? (｡•̀ᴗ-)✧', `${petName}, reporting for duty~ 🫡`]), 2600, { force: true });
});
T.onPetState(applySnapshot);

// ---------------- character (rig) ----------------
/** Draw the egg or the hatched character from { spec, stage }. */
function applyCharacter(ch) {
  isEgg = ch.stage === 'egg';
  petEl.classList.toggle('egg', isEgg);
  if (isEgg) { window.TamaShared.renderEgg(petEl, svgEl); return; }
  spec = window.TamaShared.renderRig(petEl, svgEl, ch.spec);
  petName = spec.name;
  renderMood();
}
// Hatched, restyled or reborn from onboarding.
T.onCharacter((ch) => {
  const wasEgg = isEgg;
  applyCharacter(ch);
  stopWalking(); hop(); express('sparkle', 2600); particles(['✨', '⭐', '💖', '🌸'], 12, 'burst');
  say(wasEgg ? `hajimemashite! I'm ${petName} ${myEmoji()}\nclick me! (rub my head for pats~)` : `ta-da~ how do I look?${tic()} ${myEmoji()}`, 5000, { force: true });
});

(async function boot() {
  applyCharacter(await T.getCharacter());
  const snap = await T.getPet();
  applySnapshot(snap);
  const s = snap.state;
  const firstMeet = s.xp === 0 && s.pats === 0 && Date.now() - s.bornAt < 60000;
  if (isEgg) {
    setTimeout(() => say('*wobble wobble*\n(click the egg!)', 6000), 800);
  } else if (firstMeet) {
    setTimeout(() => { express('sparkle', 2500); say(`hajimemashite! I'm ${petName} ${myEmoji()}\nclick me! (rub my head for pats~)`, 6000); }, 800);
  } else if (snap.hoursAway > 2) {
    setTimeout(() => { express('sad', 2500); say(`${Math.round(snap.hoursAway)} hours… I was lonely 🥺`, 4500); }, 800);
  } else {
    setTimeout(() => say(`${greeting()} okaeri!`), 800);
  }
  // Timed expressions expire between state updates, so re-render once a second.
  setInterval(renderMood, 1000);
  setTimeout(behave, 4000);
})();
