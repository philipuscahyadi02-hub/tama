/* DJ Tama (MUS-3): while music plays she puts on her DJ headphones, stands at her booth, nods on every beat, scratches
   the record every 8 beats and now and then does a "drop" with sparkles. She doesn't wander while DJing. A new song
   brings a short DJ line from the core (assets/music/dj-lines.json). Loaded after pet.js and shares its globals
   (petEl, svgEl, T, S, isEgg, petName, say, express, emote, hop, stopWalking). */
let djOn = false;
let djDrops = [];
let djPrefs = { musicDj: true, musicBeat: true };
let djBeats = 0;
let djAngle = 0;
let djState = null;
window.djOn = false;

const djReduced = () => document.body.classList.contains('reduce-motion');

/** One beat: a small nod, a scratch every 8th, a drop now and then. */
function djBeat(_n, bpm) {
  if (!djOn || djReduced()) return;
  djBeats += 1;
  const period = bpm ? 60000 / bpm : 535;
  // Half-time: she bobs and the record turns on every 2nd beat, in the same frames (NFR-1: fewer full repaints).
  if (djBeats % 2 === 1) return djExtras(period);
  const head = svgEl.querySelector('.headGroup');
  if (head) head.animate([{ transform: 'none' }, { transform: 'rotate(-3deg) translateY(3px)', offset: 0.35 }, { transform: 'none' }], { duration: Math.min(300, period * 0.6), easing: 'ease-out' });
  // The record turns a quarter turn (short steps instead of a nonstop spin: NFR-1).
  const rec = svgEl.querySelector('.dj-spin');
  if (rec) { const a = djAngle; djAngle += 90; rec.animate([{ transform: `rotate(${a}deg)` }, { transform: `rotate(${djAngle}deg)` }], { duration: 220, easing: 'ease-out', fill: 'forwards' }); }
  djExtras(period);
}

/** Every few beats: a note floats up, the left hand scratches, the fader slides, now and then a drop. */
function djExtras(period) {
  if (djBeats % 8 === 4) {
    const note = svgEl.querySelector(djBeats % 16 === 4 ? '.dj-note.n1' : '.dj-note.n2');
    if (note) note.animate([{ transform: 'translateY(6px)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'translateY(-16px) rotate(12deg)', opacity: 0 }], { duration: 1300, easing: 'ease-out' });
  }
  if (djBeats % 8 === 0) {
    const arm = svgEl.querySelector('.arm-l');
    if (arm) arm.animate([{ transform: 'none' }, { transform: 'rotate(14deg)' }, { transform: 'rotate(-6deg)' }, { transform: 'rotate(12deg)' }, { transform: 'none' }], { duration: Math.min(700, period * 1.4), easing: 'ease-in-out' });
  }
  const fader = svgEl.querySelector('.dj-fader');
  if (fader && djBeats % 4 === 0) fader.animate([{ transform: 'none' }, { transform: `translateX(${djBeats % 8 === 0 ? 14 : -8}px)` }, { transform: 'none' }], { duration: 320, easing: 'ease-in-out' });
  if (djBeats % 64 === 32) djDrop();
}

function djDrop() {
  hop();
  express('sparkle', 1600);
  emote(pick(['🔥', '✨', '🎶']), 1400);
  if (djDrops.length && Math.random() < 0.5) say(pick(djDrops), 2200);
}

let djGrooveTimer = null;

/** Start the beat: the real one from the PC's audio, or (beat sync off / reduced motion) a steady groove timer. */
function startBeat() {
  window.TamaDjBeat.stop();
  clearTimeout(djGrooveTimer);
  if (!djOn || djReduced()) return;
  if (djPrefs.musicBeat !== false) { window.TamaDjBeat.start(djBeat); return; }
  let n = 0;
  const tick = () => { if (!djOn) return; djBeat(++n, 112); djGrooveTimer = setTimeout(tick, 60000 / 112); };
  tick();
}

function setDj(on) {
  on = !!on && !isEgg && !S.asleep && djPrefs.musicDj !== false;
  if (on === djOn) return;
  djOn = on;
  window.djOn = on;
  petEl.classList.toggle('dj-on', on);
  if (on) { stopWalking(); djBeats = 0; startBeat(); } else { window.TamaDjBeat.stop(); clearTimeout(djGrooveTimer); }
}

T.music.onWidget((p) => {
  if (!p || !('djLine' in p)) return; // the widget's own updates go to the widget window only
  djState = p.state;
  djDrops = p.drops || [];
  setDj(!!(djState && djState.playing));
  if (p.djLine && djOn) {
    emote('🎧', 1600);
    say(p.djLine.replace(/\{name\}/g, petName || 'Tama'), 3200);
  }
});

function applyDjPrefs(p) {
  if (!p) return;
  const beatChanged = (p.musicBeat !== false) !== (djPrefs.musicBeat !== false);
  djPrefs = { musicDj: p.musicDj !== false, musicBeat: p.musicBeat !== false };
  if (!djPrefs.musicDj) setDj(false);
  else if (djState && djState.playing) { if (djOn && beatChanged) startBeat(); else setDj(true); }
}
T.ui.prefs().then(applyDjPrefs).catch(() => {});
T.ui.onPrefs(applyDjPrefs);
// Falling asleep or a restyle ends the set; the next music update starts it again.
T.onPetState(() => setTimeout(() => { if (djOn && S.asleep) setDj(false); }, 0));
