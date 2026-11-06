/* Tama terminal — a Claude Code-style terminal UI. Ported from kero-pet/renderer/terminal.js;
   the Kero-flavored text stays until M4 themes it from the CharacterSpec (TERM-2). */
const $ = (s) => document.querySelector(s);
const K = window.tama;
const screenEl = $('#screen');
const tx = $('#transcript');
const input = $('#input');

const st = {
  cwd: null, mode: 'default', model: null, effort: null, busy: false, totalCost: 0,
  lastSessionId: null, commands: [], history: [], histIdx: -1,
  tools: new Map(), // tool_use id -> { el, name, input }
  textEl: null, textBuf: '',
  perms: [], // queue of pending permission requests
  turnStart: 0,
  progress: null, // { verb, chars } while a tool's input is still streaming (e.g. a big Write)
};

// ---------------- helpers ----------------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
function rel(p) {
  if (!p) return '';
  const s = String(p).replace(/\\/g, '/');
  const c = (st.cwd || '').replace(/\\/g, '/');
  return c && s.toLowerCase().startsWith(c.toLowerCase() + '/') ? s.slice(c.length + 1) : s;
}
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const fmtDur = (ms) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);

// tiny markdown
function fmtInline(t) {
  return t
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
}
function md(src) {
  const parts = src.split('```');
  return parts.map((p, i) => {
    if (i % 2 === 1) {
      const nl = p.indexOf('\n');
      const code = nl >= 0 ? p.slice(nl + 1) : p;
      return `<pre class="code">${esc(code.replace(/\n$/, ''))}</pre>`;
    }
    let prevBlank = false;
    return esc(p).split('\n').map((line) => {
      if (!line.trim()) { if (prevBlank) return ''; prevBlank = true; return '<div></div>'; }
      prevBlank = false;
      let m;
      if ((m = line.match(/^#{1,6}\s+(.*)/))) return `<div class="h">${fmtInline(m[1])}</div>`;
      if ((m = line.match(/^(\s*)[-*]\s+(.*)/))) return `<div style="padding-left:${m[1].length * 7 + 2}px">• ${fmtInline(m[2])}</div>`;
      if ((m = line.match(/^(\s*)(\d+)\.\s+(.*)/))) return `<div style="padding-left:${m[1].length * 7 + 2}px">${m[2]}. ${fmtInline(m[3])}</div>`;
      return `<div>${fmtInline(line)}</div>`;
    }).join('');
  }).join('');
}

function diffHtml(oldS, newS, max = 40) {
  const out = [];
  const o = oldS ? String(oldS).split('\n') : [];
  const n = newS ? String(newS).split('\n') : [];
  o.slice(0, max).forEach((l) => out.push(`<div class="del">- ${esc(l)}</div>`));
  if (o.length > max) out.push(`<div class="more">  … ${o.length - max} more removed</div>`);
  n.slice(0, max).forEach((l) => out.push(`<div class="add">+ ${esc(l)}</div>`));
  if (n.length > max) out.push(`<div class="more">  … ${n.length - max} more added</div>`);
  return `<div class="diff">${out.join('')}</div>`;
}

// ---------------- tool rendering ----------------
function toolLabel(name, i = {}) {
  switch (name) {
    case 'Read': case 'Edit': case 'MultiEdit': case 'Write': case 'NotebookEdit':
      return [name === 'MultiEdit' ? 'Update' : name === 'Edit' ? 'Update' : name, rel(i.file_path || i.notebook_path)];
    case 'Bash': return ['Bash', trunc(String(i.command || ''), 120)];
    case 'Grep': return ['Search', `pattern: "${i.pattern || ''}"${i.path ? `, path: "${rel(i.path)}"` : ''}`];
    case 'Glob': return ['Search', `pattern: "${i.pattern || ''}"`];
    case 'WebFetch': return ['Fetch', i.url || ''];
    case 'WebSearch': return ['Web Search', `"${i.query || ''}"`];
    case 'Task': case 'Agent': return ['Task', i.description || ''];
    case 'TodoWrite': return ['Update Todos', ''];
    default: {
      const first = Object.values(i).find((v) => typeof v === 'string');
      return [name.replace(/^mcp__/, '').replace(/__/g, ' · '), first ? trunc(first, 80) : ''];
    }
  }
}
function toolExtra(name, i = {}) {
  if (name === 'Edit') return diffHtml(i.old_string, i.new_string);
  if (name === 'MultiEdit' && Array.isArray(i.edits)) return i.edits.slice(0, 4).map((e) => diffHtml(e.old_string, e.new_string, 15)).join('');
  if (name === 'TodoWrite' && Array.isArray(i.todos)) {
    return `<div class="todos">${i.todos.map((t) => {
      const box = t.status === 'completed' ? '☒' : '☐';
      const cls = t.status === 'completed' ? 'ok' : t.status === 'in_progress' ? 'doing' : '';
      return `<div class="${cls}">⎿ ${box} ${esc(t.content || t.activeForm || '')}</div>`;
    }).join('')}</div>`;
  }
  return '';
}
function toolSummary(name, i, text, isErr) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').filter((l, idx, a) => !(idx === a.length - 1 && !l));
  if (isErr) return trunc(lines.slice(0, 3).join('\n') || 'Error', 400);
  switch (name) {
    case 'Read': return `Read ${lines.length} lines`;
    case 'Glob': return `Found ${lines.filter(Boolean).length} files`;
    case 'Grep': return lines.length <= 3 ? lines.join('\n') || 'No matches' : `Found ${lines.length} lines`;
    case 'Edit': case 'MultiEdit': return `Updated ${rel(i.file_path)}`;
    case 'Write': return `Wrote ${String(i.content || '').split('\n').length} lines to ${rel(i.file_path)}`;
    case 'TodoWrite': return null;
    case 'Bash': case 'WebFetch': case 'WebSearch': case 'Task': case 'Agent': default: {
      if (!lines.length) return '(No content)';
      const shown = lines.slice(0, 4).map((l) => trunc(l, 160)).join('\n');
      return lines.length > 4 ? `${shown}\n… +${lines.length - 4} lines` : shown;
    }
  }
}

// ---------------- spinner ----------------
const GLYPHS = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
const VERBS = ['Kero-ing', 'Ribbiting', 'Hopping', 'Ganbatte-ing', 'Pondering', 'Lily-padding', 'Sparkling', 'Doki-doki-ing', 'Henshin-ing', 'Nyaa-ing', 'Croaking', 'Mogu-mogu-ing'];
let spinTimer = null;
let spinI = 0;
function setBusy(b) {
  st.busy = b;
  $('#spinner').classList.toggle('hidden', !b);
  clearInterval(spinTimer);
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
  acceptEdits: '⏵⏵ accept edits on (shift+tab to cycle) · Henshin mode ✨',
  plan: '⏸ plan mode on (shift+tab to cycle)',
};
function renderStatus() {
  $('#modeHint').textContent = MODE_TEXT[st.mode] || st.mode;
  $('#modeHint').className = st.mode;
  const cwd = st.cwd ? st.cwd.replace(/\\/g, '/').split('/').slice(-2).join('/') : 'no folder — /cd';
  $('#statusLine').textContent = `${st.model || 'default model'}${st.effort ? ` · effort ${st.effort}` : ''} · ${cwd} · $${st.totalCost.toFixed(2)}`;
  $('#titleCwd').textContent = st.cwd || '';
}

// ---------------- agent events ----------------
function endText() {
  if (st.textEl) { st.textEl = null; st.textBuf = ''; }
}
let rafPending = false;
function flushText() {
  rafPending = false;
  if (st.textEl) { st.textEl.querySelector('.body').innerHTML = md(st.textBuf); scroll(); }
}

/** The terminal is Claude Code only (D-029); chat with the Tama lives in the chat window. */
const dotFor = () => '●';
K.onAgent((ev) => {
  switch (ev.t) {
    case 'status':
      if (ev.state === 'idle') setBusy(false);
      else if (!st.busy) setBusy(true);
      break;
    case 'thinking-progress':
      st.progress = { verb: 'Thinking…', chars: ev.chars || 0 };
      if (!st.busy) setBusy(true);
      break;
    case 'tool-progress':
      st.progress = { verb: progressVerb(ev.name, ev.file), chars: ev.chars || 0 };
      if (!st.busy) setBusy(true);
      $('#spinVerb').textContent = st.progress.verb;
      break;
    case 'text-start':
      endText();
      st.progress = null;
      st.textEl = add(`<span class="dot">${dotFor()}</span><div class="body md"></div>`, 'msg');
      st.textBuf = '';
      break;
    case 'text-delta':
      if (!st.textEl) st.textEl = add(`<span class="dot">${dotFor()}</span><div class="body md"></div>`, 'msg');
      st.textBuf += ev.text;
      if (!rafPending) { rafPending = true; requestAnimationFrame(flushText); }
      break;
    case 'text-end':
      flushText(); endText();
      break;
    case 'tool': {
      endText();
      st.progress = null;
      const [n, arg] = toolLabel(ev.name, ev.input);
      const el = add(
        `<span class="dot">●</span><div class="body"><span class="tname">${esc(n)}</span>${arg ? `<span class="targ">(${esc(arg)})</span>` : ''}${toolExtra(ev.name, ev.input)}</div>`,
        'msg tool running',
      );
      st.tools.set(ev.id, { el, name: ev.name, input: ev.input || {} });
      break;
    }
    case 'tool-result': {
      const t = st.tools.get(ev.id);
      if (!t) break;
      t.el.classList.remove('running');
      if (ev.isError) t.el.classList.add('err');
      const s = toolSummary(t.name, t.input, ev.text, ev.isError);
      if (s) {
        const r = document.createElement('div');
        r.className = 'res' + (ev.isError ? ' err' : '');
        r.textContent = s;
        t.el.querySelector('.body').appendChild(r);
        scroll();
      }
      break;
    }
    case 'permission':
      st.perms.push(ev);
      if (st.perms.length === 1) showPerm();
      break;
    case 'permission-done':
      st.perms = st.perms.filter((p) => p.id !== ev.id);
      if (curPerm && curPerm.id === ev.id) { curPerm = null; hidePerm(); if (st.perms.length) showPerm(); }
      break;
    case 'result': {
      endText();
      for (const t of st.tools.values()) t.el.classList.remove('running');
      st.totalCost = ev.totalCost || st.totalCost;
      if (ev.isError && ev.subtype !== 'success') {
        if (ev.subtype === 'error_during_execution') info('⎿  Interrupted by user');
        else error(`✗ ${ev.subtype}${ev.text ? ': ' + ev.text : ''}`);
      }
      const cost = typeof ev.cost === 'number' ? ` · $${ev.cost.toFixed(3)} (session $${(ev.totalCost || 0).toFixed(3)})` : '';
      add(`✻ ${ev.isError ? 'Stopped' : 'Done'} in ${fmtDur(ev.durationMs || 0)}${cost}`, 'done');
      setBusy(false);
      renderStatus();
      break;
    }
    case 'init':
      if (ev.commands) st.commands = ev.commands;
      if (ev.model) st.model = ev.model;
      renderStatus();
      break;
    case 'session': st.lastSessionId = ev.sessionId; break;
    case 'mode': st.mode = ev.mode; renderStatus(); break;
    case 'model': st.model = ev.model; renderStatus(); break;
    case 'effort': st.effort = ev.effort; renderStatus(); break;
    case 'cwd':
      st.cwd = ev.cwd; renderStatus();
      document.querySelectorAll('.cwdline').forEach((e) => { e.textContent = 'cwd: ' + ev.cwd; });
      break;
    case 'cleared': st.totalCost = 0; renderStatus(); break;
    case 'info': info(ev.text); break;
    case 'error': error('✗ ' + ev.message); setBusy(false); break;
  }
});

// ---------------- permission prompt ----------------
let curPerm = null;
let permSel = 0;
function permOptions(p) {
  const what = p.name === 'Bash' ? 'commands like this' : p.name.startsWith('mcp__') ? 'this tool' : `${p.name} in this session`;
  return [
    ['yes', 'Yes'],
    ['always', `Yes, and don't ask again for ${what}`],
    ['no', 'No, and tell Kero-chan what to do differently (esc)'],
  ];
}
function showPerm() {
  curPerm = st.perms[0];
  if (!curPerm) return;
  permSel = 0;
  const p = curPerm;
  const i = p.input || {};
  let title = p.name, preview = '', q = `Do you want to allow ${p.name}?`;
  if (p.name === 'Bash') { title = 'Bash command'; preview = `<div class="cmd">${esc(i.command || '')}</div>${i.description ? `<div class="dim">${esc(i.description)}</div>` : ''}`; q = 'Do you want to proceed?'; }
  else if (p.name === 'Edit' || p.name === 'MultiEdit') { title = 'Edit file'; preview = `<div class="dim">${esc(rel(i.file_path))}</div>${toolExtra(p.name, i)}`; q = `Do you want to make this edit to ${esc(rel(i.file_path).split('/').pop())}?`; }
  else if (p.name === 'Write') { title = 'Create file'; preview = `<div class="dim">${esc(rel(i.file_path))}</div>${diffHtml('', i.content, 30)}`; q = `Do you want to create ${esc(rel(i.file_path).split('/').pop())}?`; }
  else if (p.name === 'WebFetch') { title = 'Fetch'; preview = `<div class="cmd">${esc(i.url || '')}</div>`; }
  else if (p.name === 'ExitPlanMode') { title = 'Ready to code?'; preview = `<div class="md">${md(String(i.plan || ''))}</div>`; q = 'Would you like to proceed with this plan?'; }
  else preview = `<div class="cmd">${esc(JSON.stringify(i, null, 2).slice(0, 1500))}</div>`;
  const perm = $('#perm');
  perm.innerHTML = `
    <div class="ptitle">${esc(title)}</div>
    <div class="kero">(｡•́︿•̀｡) ano… Kero-chan wants to do this:</div>
    <div class="preview">${preview}</div>
    ${p.reason ? `<div class="dim">${esc(p.reason)}</div>` : ''}
    <div class="q">${q}</div>
    <div class="opts">${permOptions(p).map(([, label], n) => `<div class="opt" data-n="${n}">${n + 1}. ${esc(label)}</div>`).join('')}</div>
    <input class="fb hidden" placeholder="Tell Kero-chan what to do instead… (Enter to send, empty = just stop)" />
    <div class="phint">↑/↓ select · enter confirm · 1-3 quick pick · esc = no</div>`;
  perm.classList.remove('hidden');
  $('#inputBox').classList.add('hidden');
  perm.querySelectorAll('.opt').forEach((o) => o.addEventListener('click', () => { permSel = +o.dataset.n; renderPermSel(); choosePerm(); }));
  perm.querySelector('.fb').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); answer('no', e.target.value.trim()); }
    if (e.key === 'Escape') { e.preventDefault(); answer('no', ''); }
    e.stopPropagation();
  });
  renderPermSel();
  scroll(true);
  window.focus();
}
function renderPermSel() { document.querySelectorAll('#perm .opt').forEach((o, n) => o.classList.toggle('sel', n === permSel)); }
function hidePerm() { $('#perm').classList.add('hidden'); $('#inputBox').classList.remove('hidden'); input.focus(); }
function choosePerm() {
  const [choice] = permOptions(curPerm)[permSel];
  if (choice === 'no') {
    const fb = $('#perm .fb');
    fb.classList.remove('hidden'); fb.focus();
    return;
  }
  answer(choice);
}
function answer(choice, feedback) {
  if (!curPerm) return;
  const p = curPerm;
  const label = { yes: 'Allowed', always: 'Allowed (won\'t ask again)', no: 'Denied' }[choice];
  info(`⎿  ${label}: ${p.name}${feedback ? ` — "${feedback}"` : ''}`);
  K.answerPermission(p.id, choice, feedback);
}

// ---------------- slash commands ----------------
const TAMA = window.makeTamaCommands(K, { info: (t) => info(t), error: (t) => error(t), getCwd: () => st.cwd });
const LOCAL = {
  help: ['Show help', () => {
    info([
      'Kero Code — works like Claude Code, with a frog hood 🐸',
      '',
      '  Enter            send            Shift+Enter   new line',
      '  Esc              interrupt       Shift+Tab     cycle mode (default → accept edits → plan)',
      '  ↑ / ↓            history         Ctrl+L        clear screen',
      '  Ctrl+Alt+K       show/hide this window (global)',
      '',
      '  /cd [path]       pick the project folder (no path = folder picker)',
      '  /clear           start a fresh conversation',
      '  /resume          continue the last conversation',
      '  /model [name]    switch model (opus = smartest, sonnet = faster, haiku = fastest; empty = default)',
      '  /effort [level]  thinking effort: low (fast) · medium · high · xhigh · max (slow, deep) · default',
      '  /mode [m]        default | acceptEdits | plan',
      '  /cost            show session cost',
      '  /summon          bring your Tama back on screen (also Ctrl+Alt+P)',
      '  /exit            hide this window',
      ...TAMA.help,
      '',
      'Any other /command (e.g. /init, /compact, /review, your skills) is passed to Claude Code.',
    ].join('\n'));
  }],
  cd: ['Change project folder', async (arg) => {
    const r = arg ? await K.setCwd(arg) : await K.pickCwd();
    if (!r) return;
    if (r.error) return error('✗ ' + r.error);
    tx.innerHTML = ''; welcome();
    info(`⎿  Working in ${r.cwd}${r.isGit ? '' : ' (not a git repo — edits can\'t be undone with git!)'}`);
  }],
  clear: ['Start a new conversation', () => { K.clear(); tx.innerHTML = ''; st.tools.clear(); welcome(); }],
  resume: ['Resume the last conversation', async (arg) => {
    const r = await K.resume(arg || null);
    if (r.error) error('✗ ' + r.error);
  }],
  model: ['Switch model', (arg) => { K.setModel(arg || null); info(`⎿  Model set to ${arg || 'default'}`); }],
  effort: ['Thinking effort: low (fast) … max (deep)', (arg) => {
    const a = String(arg || '').toLowerCase();
    if (!['low', 'medium', 'high', 'xhigh', 'max', 'default'].includes(a)) return info(`⎿  Effort: low | medium | high | xhigh | max | default (now: ${st.effort || 'default'}). Lower = less thinking = faster.`);
    K.setEffort(a === 'default' ? null : a);
    info(`⎿  Effort set to ${a}`);
  }],
  mode: ['Set permission mode', (arg) => {
    if (!MODES.includes(arg)) return info(`⎿  Modes: ${MODES.join(', ')} (current: ${st.mode})`);
    K.setMode(arg);
  }],
  cost: ['Show session cost', () => info(`⎿  Session cost: $${st.totalCost.toFixed(4)}`)],
  summon: ['Bring your Tama back on screen', () => { K.summon(); info('⎿  Summoned! (Ctrl+Alt+P works anywhere)'); }],
  exit: ['Hide the terminal', () => K.win.close()],
  ...TAMA.commands,
};
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
    K.setMode(MODES[(MODES.indexOf(st.mode) + 1) % MODES.length]);
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
function welcome() {
  add(`<div class="face">  ∩ ∩\n (◕ᴗ◕)\n  /ノ🎀</div>
    <div><div class="big">✻ Welcome to Kero Code!</div>
    <div class="dim">Claude Code, but with a frog hood. /help for commands.</div>
    <div class="dim cwdline">cwd: ${esc(st.cwd || '(none yet — type /cd to pick a project)')}</div></div>`, 'welcome');
}

(async function boot() {
  const s = await K.termInit();
  Object.assign(st, { cwd: s.cwd, mode: s.mode, model: s.model, effort: s.effort || null, totalCost: s.totalCost || 0, lastSessionId: s.lastSessionId, commands: s.commands || [] });
  welcome();
  if (s.lastSessionId && s.cwd) info('⎿  Tip: /resume continues your last conversation');
  if (s.busy) setBusy(true);
  renderStatus();
  input.focus();
})();
