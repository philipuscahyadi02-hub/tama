/* Tama terminal — a Claude Code-style terminal UI (ported from kero-pet/renderer/terminal.js).
   Colors, title, caret, spinner words and the live avatar come from the active Tama (TERM-2, ART-4, D-032). */
const $ = (s) => document.querySelector(s);
const K = window.tama;
const screenEl = $('#screen');
const tx = $('#transcript');
const input = $('#input');

const st = {
  cwd: null, isGit: false, mode: 'default', model: null, effort: null, busy: false, totalCost: 0,
  spec: null, flavor: null, variant: 'night', modeConfirmUntil: 0,
  lastSessionId: null, commands: [], history: [], histIdx: -1,
  tools: new Map(), // tool_use id -> { el, name, input }
  textEl: null, textBuf: '',
  perms: [], // queue of pending permission requests
  turnStart: 0,
  progress: null, // { verb, chars } while a tool's input is still streaming (e.g. a big Write)
};

// ---------------- helpers ----------------
const { esc, trunc, fmtDur, md, diffHtml } = window.TermFormat;
const { rel, toolLabel, toolExtra, toolSummary } = window.TermFormat.make(() => st.cwd);
const nearBottom = () => screenEl.scrollHeight - screenEl.scrollTop - screenEl.clientHeight < 80;
function scroll(force) { if (force || nearBottom()) requestAnimationFrame(() => { screenEl.scrollTop = screenEl.scrollHeight; }); }
function add(html, cls) {
  const stick = nearBottom();
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.innerHTML = html;
  tx.appendChild(d);
  if (stick) scroll(true);
  return d;
}
const info = (t) => add(esc(t), 'info');
const error = (t) => add(esc(t), 'error');

// ---------------- spinner ----------------
let GLYPHS = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
let VERBS = ['Pondering', 'Sparkling', 'Ganbatte-ing', 'Doki-doki-ing'];
const tamaName = () => (st.flavor ? st.flavor.name : 'your Tama');

// ---------------- theme + live avatar (TERM-2) ----------------
function applyTheme() {
  const TS = window.TamaShared;
  if (!st.spec) return;
  const vars = TS.theme.terminalVars(st.spec, st.variant);
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  const f = TS.theme.flavor(st.spec);
  st.flavor = f;
  VERBS = f.verbs; GLYPHS = f.glyphs;
  document.documentElement.style.setProperty('--tama-caret', JSON.stringify(f.caret));
  $('#caret').textContent = f.caret;
  $('#title').textContent = f.title;
  document.title = f.title;
  $('#avatar').title = `${f.name} (click: bring them on screen)`;
  TS.renderRig($('#avatar'), $('#avatar svg'), st.spec, 'term-');
  avatarMood(st.busy ? 'focus' : 'normal');
  document.querySelectorAll('.welcome').forEach((w) => w.replaceWith(welcomeEl()));
}
let moodTimer = null;
/** The title-bar avatar reacts to what Claude is doing. @param {string} mood @param {number} [ms] */
function avatarMood(mood, ms) {
  const el = $('#avatar');
  el.className = el.className.replace(/\bmood-\w+/g, '').trim() + ' mood-' + mood;
  el.classList.toggle('working', st.busy && mood === 'focus');
  clearTimeout(moodTimer);
  moodTimer = null;
  if (ms) moodTimer = setTimeout(() => { moodTimer = null; avatarMood(st.busy ? 'focus' : 'normal'); }, ms);
}
let spinTimer = null;
let spinI = 0;
function setBusy(b) {
  st.busy = b;
  $('#spinner').classList.toggle('hidden', !b);
  clearInterval(spinTimer);
  if (b) avatarMood('focus'); else if (!moodTimer) avatarMood('normal');
  if (b) {
    st.turnStart = st.turnStart || Date.now();
    $('#spinVerb').textContent = VERBS[Math.floor(Math.random() * VERBS.length)] + '…';
    spinTimer = setInterval(() => {
      $('#spinGlyph').textContent = GLYPHS[spinI++ % GLYPHS.length];
      const p = st.progress;
      const size = p && p.chars ? ` · ${p.chars >= 1000 ? (p.chars / 1000).toFixed(1) + 'k' : p.chars} chars` : '';
      const model = st.model ? ` · ${shortModel(st.model)}` : '';
      $('#spinMeta').textContent = `(${fmtDur(Date.now() - st.turnStart)}${size}${model} · esc to interrupt)`;
      if (p) $('#spinVerb').textContent = p.verb;
      else if (spinI % 40 === 0) $('#spinVerb').textContent = VERBS[Math.floor(Math.random() * VERBS.length)] + '…';
    }, 120);
    scroll();
  } else { st.turnStart = 0; st.progress = null; }
}
const shortModel = (m) => String(m).replace(/^claude-/, '').replace(/-\d{8}$/, '');
/** Verb for a tool whose input is still being written by the model. */
function progressVerb(name, file) {
  const f = file ? rel(file).split('/').pop() : '';
  if (name === 'Write') return `Writing ${f || 'a file'}…`;
  if (name === 'Edit' || name === 'MultiEdit') return `Preparing an edit${f ? ' to ' + f : ''}…`;
  if (name === 'Bash') return 'Preparing a command…';
  return `Preparing ${name}…`;
}

// ---------------- status / mode ----------------
const MODES = ['default', 'acceptEdits', 'plan'];
const MODE_TEXT = {
  default: '? for shortcuts',
  acceptEdits: '⏵⏵ accept edits on (shift+tab to cycle)',
  plan: '⏸ plan mode on (shift+tab to cycle)',
};
function renderStatus() {
  $('#modeHint').textContent = MODE_TEXT[st.mode] || st.mode;
  $('#modeHint').className = st.mode;
  const cwd = st.cwd ? st.cwd.replace(/\\/g, '/').split('/').slice(-2).join('/') : 'no folder — /cd';
  $('#statusLine').textContent = `${st.model || 'default model'}${st.effort ? ` · effort ${st.effort}` : ''} · ${cwd} · $${st.totalCost.toFixed(2)}`;
  $('#titleCwd').textContent = st.cwd || '';
}

// ---------------- slash commands ----------------
const TAMA = window.makeTamaCommands(K, { info: (t) => info(t), error: (t) => error(t), getCwd: () => st.cwd });
const { commands: LOCAL, setMode, tour } = window.makeLocalCommands(K, {
  info, error, st, modes: MODES, tamaName, welcome: () => welcome(), clearScreen: () => { tx.innerHTML = ''; }, tama: TAMA,
});
// Reminders and finished focus sessions also show up here.
K.prod.onReminder((r) => info(`⏰ Reminder: ${r.text}`));
K.prod.onFocus((f) => {
  if (f.completed) info(`⏱️ Focus session done!${f.gained ? ` (+${f.gained} bond 💗)` : ''} Take a break~`);
  else if (f.breakOver) info('⏱️ Break over. Ready for another /focus?');
});

function slashMatches(prefix) {
  const local = Object.entries(LOCAL).map(([c, [d]]) => ({ c, d }));
  const remote = st.commands.filter((c) => !LOCAL[c]).map((c) => ({ c, d: 'Claude Code command' }));
  return [...local, ...remote].filter((x) => x.c.startsWith(prefix)).slice(0, 30);
}
let slashSel = 0;
let slashItems = [];
function updateSlash() {
  const v = input.value;
  const m = v.match(/^\/(\S*)$/);
  const box = $('#slash');
  if (!m) { box.classList.add('hidden'); slashItems = []; return; }
  slashItems = slashMatches(m[1]);
  if (!slashItems.length) { box.classList.add('hidden'); return; }
  slashSel = Math.min(slashSel, slashItems.length - 1);
  box.innerHTML = slashItems.map((x, n) => `<div class="${n === slashSel ? 'sel' : ''}" data-n="${n}"><span class="c">/${esc(x.c)}</span><span class="d">${esc(x.d)}</span></div>`).join('');
  box.querySelectorAll('div').forEach((d) => d.addEventListener('mousedown', (e) => { e.preventDefault(); slashSel = +d.dataset.n; completeSlash(); }));
  box.classList.remove('hidden');
  const sel = box.querySelector('.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
}
function completeSlash() {
  const x = slashItems[slashSel];
  if (!x) return;
  input.value = '/' + x.c + ' ';
  updateSlash(); autosize();
}

// ---------------- input ----------------
function autosize() { input.style.height = 'auto'; input.style.height = Math.min(180, input.scrollHeight) + 'px'; }

function submit() {
  const text = input.value.trim();
  if (!text) return;
  input.value = ''; autosize(); updateSlash();
  st.history.push(text); st.histIdx = -1;
  const m = text.match(/^\/(\S+)\s*([\s\S]*)$/);
  if (m && LOCAL[m[1]]) {
    add(esc(text), 'user');
    LOCAL[m[1]][1](m[2].trim());
    return;
  }
  // The brain asks for /cd if no project folder is set yet.
  add(esc(text) + (st.busy ? ' <span class="q">(queued)</span>' : ''), 'user');
  scroll(true);
  K.send(text);
  setBusy(true);
}

input.addEventListener('input', () => { autosize(); slashSel = 0; updateSlash(); });

document.addEventListener('keydown', (e) => {
  // permission prompt has priority
  if (curPerm && !$('#perm').classList.contains('hidden') && document.activeElement !== $('#perm .fb')) {
    const n = permOptions(curPerm).length;
    if (e.key === 'ArrowDown') { permSel = (permSel + 1) % n; renderPermSel(); e.preventDefault(); return; }
    if (e.key === 'ArrowUp') { permSel = (permSel + n - 1) % n; renderPermSel(); e.preventDefault(); return; }
    if (e.key === 'Enter') { choosePerm(); e.preventDefault(); return; }
    if (/^[1-3]$/.test(e.key)) { permSel = +e.key - 1; renderPermSel(); choosePerm(); e.preventDefault(); return; }
    if (e.key === 'Escape') { answer('no', ''); e.preventDefault(); return; }
    return;
  }
  if (e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
    const next = MODES[(MODES.indexOf(st.mode) + 1) % MODES.length];
    // Pressing Shift+Tab again right after the warning confirms accept-edits outside git (SAFE-4).
    setMode(next, Date.now() < st.modeConfirmUntil);
    return;
  }
  if (e.key === 'Escape') {
    if (!$('#slash').classList.contains('hidden')) { input.value = ''; updateSlash(); return; }
    if (st.busy) { K.interrupt(); }
    return;
  }
  if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); tx.innerHTML = ''; return; }
  if (document.activeElement !== input) {
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) input.focus();
    return;
  }
  const slashOpen = !$('#slash').classList.contains('hidden');
  if (slashOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    slashSel = (slashSel + (e.key === 'ArrowDown' ? 1 : slashItems.length - 1)) % slashItems.length;
    updateSlash(); return;
  }
  if (slashOpen && e.key === 'Tab') { e.preventDefault(); completeSlash(); return; }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (slashOpen && slashItems[slashSel] && input.value.trim() !== '/' + slashItems[slashSel].c) {
      const c = slashItems[slashSel].c;
      // local commands that need no argument run immediately; others complete first
      input.value = '/' + c;
    }
    submit();
    return;
  }
  if (e.key === 'ArrowUp' && input.selectionStart === 0 && st.history.length) {
    e.preventDefault();
    st.histIdx = st.histIdx < 0 ? st.history.length - 1 : Math.max(0, st.histIdx - 1);
    input.value = st.history[st.histIdx]; autosize();
  } else if (e.key === 'ArrowDown' && st.histIdx >= 0 && input.selectionStart === input.value.length) {
    e.preventDefault();
    st.histIdx++;
    if (st.histIdx >= st.history.length) { st.histIdx = -1; input.value = ''; } else input.value = st.history[st.histIdx];
    autosize();
  }
});

$('#wMin').addEventListener('click', K.win.minimize);
$('#wMax').addEventListener('click', K.win.maximize);
$('#wClose').addEventListener('click', K.win.close);
K.onFocus(() => input.focus());
screenEl.addEventListener('mouseup', () => { if (!String(window.getSelection())) input.focus(); });

// ---------------- boot ----------------
function welcomeEl() {
  const d = document.createElement('div');
  d.className = 'welcome';
  const f = st.flavor || { title: 'Tama Code', subtitle: 'Claude Code, with your Tama. /help for commands.' };
  d.innerHTML = `<div class="face tama-rig mood-happy"><svg class="rig-svg" viewBox="0 0 200 240"></svg></div>
    <div><div class="big">✻ Welcome to ${esc(f.title)}!</div>
    <div class="dim">${esc(f.subtitle)}</div>
    <div class="dim cwdline">cwd: ${esc(st.cwd || '(none yet — type /cd to pick a project)')}</div></div>`;
  if (st.spec) window.TamaShared.renderRig(d.querySelector('.face'), d.querySelector('svg'), st.spec, 'welcome-');
  return d;
}
function welcome() {
  const stick = nearBottom();
  tx.appendChild(welcomeEl());
  if (stick) scroll(true);
}

K.onCharacter((ch) => { if (ch.stage !== 'egg') { st.spec = ch.spec; applyTheme(); } });
K.ui.onPrefs((p) => { if (p.termTheme !== st.variant) { st.variant = p.termTheme; applyTheme(); } });
$('#avatar').addEventListener('click', () => { K.summon(); avatarMood('happy', 1500); });

(async function boot() {
  const [s, ch, prefs] = await Promise.all([K.termInit(), K.getCharacter(), K.ui.prefs()]);
  if (ch && ch.stage !== 'egg') st.spec = ch.spec;
  st.variant = prefs.termTheme;
  applyTheme();
  Object.assign(st, { cwd: s.cwd, isGit: !!s.isGit, mode: s.mode, model: s.model, effort: s.effort || null, totalCost: s.totalCost || 0, lastSessionId: s.lastSessionId, commands: s.commands || [] });
  welcome();
  if (!prefs.tourDone) { tour(); K.ui.setPrefs({ tourDone: true }); } else if (s.lastSessionId && s.cwd) info('⎿  Tip: /resume continues your last conversation');
  if (s.busy) setBusy(true);
  renderStatus();
  input.focus();
})();
