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
  if (eventOpen && !opts.force) return; // an open event question wins over babble
  bubbleEl.textContent = text;
  bubbleEl.className = 'hit' + (opts.shout ? ' shout' : '') + (opts.onClick ? ' clicky' : '');
  bubbleAction = opts.onClick || null;
  bubbleEl.style.animation = 'none'; void bubbleEl.offsetWidth; bubbleEl.style.animation = '';
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubbleEl.classList.add('hidden'), ms);
}
bubbleEl.addEventListener('click', () => { if (bubbleAction) bubbleAction(); bubbleEl.classList.add('hidden'); });

// ---------------- events (EVT-2, D-033): her line + choice / quest buttons ----------------
const eventBox = $('#eventBox');
let eventOpen = null; // { id }
let eventTimer = null;
function closeEvent() { eventOpen = null; eventBox.classList.add('hidden'); clearTimeout(eventTimer); }
T.events.onShow((p) => {
  if (isEgg) return;
  if (p.kind === 'reply') { closeEvent(); express('happy', 2200); emote('♡'); say(p.text, 4500, { force: true }); return; }
  stopWalking(); menuEl.classList.add('hidden'); bubbleEl.classList.add('hidden');
  eventOpen = { id: p.id };
  eventBox.querySelector('.etext').textContent = p.text;
  const opts = eventBox.querySelector('.eopts');
  opts.innerHTML = '';
  const labels = p.choices.length ? p.choices : p.quest ? [p.quest] : [];
  labels.forEach((label, i) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', async () => {
      const id = eventOpen && eventOpen.id;
      closeEvent();
      if (id) { const r = await T.events.answer(id, i); if (r && r.error) say(r.error, 3000, { force: true }); }
    });
    opts.appendChild(b);
  });
  eventBox.classList.remove('hidden');
  hop(); express(p.kind === 'nudge' ? 'focus' : 'sparkle', 2000); emote(p.kind === 'nudge' ? '💧' : '💭', 2000);
  clearTimeout(eventTimer);
  // Plain lines fade after a while; questions wait longer (the core forgets them after 5 minutes).
  eventTimer = setTimeout(closeEvent, labels.length ? 4 * 60000 : Math.min(15000, 5000 + p.text.length * 60));
});
eventBox.querySelector('.elater').addEventListener('click', () => {
  const id = eventOpen && eventOpen.id;
  closeEvent();
  if (id) T.events.dismiss(id);
  say('okay, later then~', 2000, { force: true });
});

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

// ---------------- wandering ----------------
let walkTimer = null;
let dir = 1;
function startWalking(ms) {
  if (S.asleep || isEgg || agentState !== 'idle' || dragging || document.body.classList.contains('reduce-motion')) return;
  dir =Math.random() < 0.5 ? -1 : 1;
  petEl.classList.add('walking');
  petEl.classList.toggle('face-left', dir < 0);
  const end = Date.now() + ms;
  walkTimer = setInterval(async () => {
    if (Date.now() > end) return stopWalking();
    const r = await T.walk(dir * 3);
    if ((r.atLeft && dir < 0) || (r.atRight && dir > 0)) { dir = -dir; petEl.classList.toggle('face-left', dir < 0); }
  }, 45); // same speed as 2px/30ms with a third fewer window moves (NFR-1)
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
  // Menu colors follow the character (ART-4).
  for (const [k, v] of Object.entries(window.TamaShared.theme.petVars(spec))) document.documentElement.style.setProperty(k, v);
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

// ---------------- calm idle (NFR-1) ----------------
// Idle sway runs in short bursts instead of forever; blinks are one-shots. Keeps idle CPU low (see rig.css .calm).
function aliveBurst() {
  petEl.classList.remove('calm');
  // QC-3 (D-053): 5–7 s of sway every 28–40 s (was 6–9 s every 18–28 s); walking, blinks and talk fill the gaps.
  setTimeout(() => petEl.classList.add('calm'), 5000 + Math.random() * 2000);
  setTimeout(aliveBurst, 28000 + Math.random() * 12000);
}
function blinkLoop() {
  if (petEl.classList.contains('calm')) anim('blink-now', 260);
  setTimeout(blinkLoop, 2800 + Math.random() * 3500);
}
setTimeout(aliveBurst, 4000);
setTimeout(blinkLoop, 3000);

// ---------------- reduced motion + mute (PET-8) ----------------
const osReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let motionPref = 'auto';
function applyMotion() {
  document.body.classList.toggle('reduce-motion', motionPref === 'reduced' || (motionPref === 'auto' && osReduced.matches));
}
function applyUiPrefs(p) {
  if (!p) return;
  motionPref = p.motion || 'auto';
  applyMotion();
  if (p.mute && window.TamaVoicePlayer) window.TamaVoicePlayer.stop();
}
osReduced.addEventListener('change', applyMotion);
T.ui.onPrefs(applyUiPrefs);
T.ui.prefs().then(applyUiPrefs).catch(() => {});

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
