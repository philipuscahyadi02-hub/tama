/* Pet pointer input (QC-4: split out of pet.js): click opens the menu, drag carries her, rubbing her head pats,
   poking a cheek makes her pout. Loaded after pet.js and shares its globals. */
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
  } else if (eventOpen) {
    hop(); // answer the open question first (or press "later")
  } else {
    const open = menuEl.classList.contains('hidden');
    bubbleEl.classList.add('hidden');
    menuEl.classList.toggle('hidden', !open);
    if (open && !S.asleep) { express('happy', 900); hop(); }
  }
  down = null;
});

