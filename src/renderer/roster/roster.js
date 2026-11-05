/* My Tamas (PORT-3..5, ONB-9): switch, hatch another, graduate, restore, delete, export, import.
   UI only; every operation is a roster.* request handled in the main process. */
const T = window.tama;
const S = window.TamaShared;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let n = 0;

function msg(text, ok = false) {
  const m = $('#msg');
  m.textContent = text;
  m.style.background = ok ? '#e7f8df' : '';
  m.classList.toggle('hidden', !text);
}

function portrait(t) {
  const wrap = document.createElement('div');
  wrap.className = 'tama-rig mood-normal';
  wrap.innerHTML = '<svg class="rig-svg" viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg"></svg>';
  if (t.stage === 'egg') S.renderEgg(wrap, wrap.firstChild);
  else S.renderRig(wrap, wrap.firstChild, t.spec, `r${n++}-`);
  return wrap;
}

function card(t) {
  const c = document.createElement('div');
  c.className = `tcard ${t.status}`;
  c.appendChild(portrait(t));
  const lvl = t.stage === 'egg' ? 'not hatched yet' : `${t.level.title} ${t.level.emoji}`;
  c.insertAdjacentHTML('beforeend', `<b>${esc(t.name)}</b>
    <div class="meta"><span class="badge ${t.status}">${t.status === 'active' ? 'on the desktop' : t.status === 'home' ? 'at home (paused)' : 'graduated'}</span><br>${esc(lvl)}</div>
    <div class="actions"></div>`);
  const a = c.querySelector('.actions');
  const btn = (label, fn, cls = '') => { const b = document.createElement('button'); b.className = `ghost ${cls}`; b.textContent = label; b.addEventListener('click', fn); a.appendChild(b); };
  if (t.status !== 'active') btn('▶ Switch to', () => doSwitch(t));
  if (t.status === 'graduated') btn('↩ Restore', async () => { await T.roster.restore(t.id); load(); });
  else btn('🎓 Graduate', () => confirmGraduate(t));
  btn('📦 Export', () => exportDialog(t));
  if (t.status !== 'active') btn('🗑 Delete', () => deleteDialog(t), 'danger');
  return c;
}

async function load() {
  const r = await T.roster.list();
  const home = r.tamas.filter((t) => t.status !== 'graduated');
  const album = r.tamas.filter((t) => t.status === 'graduated');
  $('#home').replaceChildren(...home.map(card));
  $('#album').replaceChildren(...album.map(card));
  if (!album.length) $('#album').innerHTML = '<p class="empty">Nobody here yet.</p>';
}

// ---------------- modal ----------------
function modal(html, bind) {
  $('#modalBox').innerHTML = html;
  $('#modal').classList.remove('hidden');
  bind($('#modalBox'));
  const first = $('#modalBox input');
  if (first) first.focus();
}
const closeModal = () => $('#modal').classList.add('hidden');

async function doSwitch(t) {
  modal(`<h3>Switch to ${esc(t.name)}?</h3><p class="sub">Tama restarts with ${esc(t.name)} on the desktop. The current one goes home (stats paused).</p>
    <div class="row"><button class="ghost" id="no">Cancel</button><button class="primary" id="yes">Switch ✨</button></div>`, (b) => {
    b.querySelector('#no').onclick = closeModal;
    b.querySelector('#yes').onclick = () => T.roster.switchTo(t.id);
  });
}

function confirmGraduate(t) {
  const active = t.status === 'active';
  modal(`<h3>Graduate ${esc(t.name)}? 🎓</h3><p class="sub">${esc(t.name)} moves to the album with all memories and stats. You can restore them anytime.
    ${active ? '<br><b>A new egg will hatch on the desktop.</b>' : ''}</p>
    <div class="row"><button class="ghost" id="no">Cancel</button><button class="primary" id="yes">Graduate</button></div>`, (b) => {
    b.querySelector('#no').onclick = closeModal;
    b.querySelector('#yes').onclick = async () => { await T.roster.graduate(t.id); closeModal(); load(); };
  });
}

function deleteDialog(t) {
  modal(`<h3 class="danger">Delete ${esc(t.name)} forever?</h3><p class="sub">This cannot be undone. Graduating keeps them in the album instead. Export a backup first if unsure.</p>
    <label class="label">Type <b>${esc(t.name)}</b> to confirm</label><input id="nm" type="text" />
    <div class="row"><button class="ghost" id="no">Cancel</button><button class="primary" id="yes" style="background:#c0392b">Delete</button></div>`, (b) => {
    b.querySelector('#no').onclick = closeModal;
    b.querySelector('#yes').onclick = async () => {
      const r = await T.roster.remove(t.id, b.querySelector('#nm').value);
      if (r.error) return msg(r.error);
      closeModal(); msg(`${t.name} was deleted.`, true); load();
    };
  });
}

function exportDialog(t) {
  modal(`<h3>Export ${esc(t.name)} 📦</h3><p class="sub">Makes one <b>.tama</b> file you can keep as a backup or open on another PC.
    A password is recommended: the file holds your Tama's memories of you.</p>
    <input id="pw" type="password" placeholder="password (recommended)" /><input id="pw2" type="password" placeholder="repeat password" />
    <label class="check"><input id="usr" type="checkbox" checked /> Include my todos, notes and reminders</label>
    <label class="check"><input id="con" type="checkbox" /> Include connections (Telegram); needs a password</label>
    <div class="row"><button class="ghost" id="no">Cancel</button><button class="primary" id="yes">Export…</button></div>`, (b) => {
    b.querySelector('#no').onclick = closeModal;
    b.querySelector('#yes').onclick = async () => {
      const pw = b.querySelector('#pw').value;
      if (pw !== b.querySelector('#pw2').value) return msg('The passwords do not match.');
      const r = await T.roster.exportTama({ id: t.id, password: pw, includeUser: b.querySelector('#usr').checked, includeConnections: b.querySelector('#con').checked });
      if (!r) return; // dialog cancelled
      if (r.error) return msg(r.error);
      closeModal(); msg(`Saved ${r.filePath}${r.encrypted ? ' (password-protected 🔒)' : ' (no password)'}`, true);
    };
  });
}

function importFlow() {
  modal(`<h3>Bring a Tama in 📦</h3><p class="sub">Pick a <b>.tama</b> file. It's added at home, so nothing here is overwritten.</p>
    <label class="check"><input id="usr" type="checkbox" /> Also bring the todos, notes and reminders (replaces this PC's)</label>
    <div class="row"><button class="ghost" id="no">Cancel</button><button class="primary" id="yes">Choose file…</button></div>`, (b) => {
    b.querySelector('#no').onclick = closeModal;
    b.querySelector('#yes').onclick = async () => {
      const includeUser = b.querySelector('#usr').checked;
      const r = await T.roster.importPick(includeUser);
      if (!r) return;
      if (r.code === 'NEED_PASSWORD') return passwordStep(includeUser);
      afterImport(r);
    };
  });
}

function passwordStep(includeUser) {
  modal(`<h3>Password 🔒</h3><p class="sub">This Tama was exported with a password.</p><input id="pw" type="password" />
    <div class="row"><button class="ghost" id="no">Cancel</button><button class="primary" id="yes">Unlock</button></div>`, (b) => {
    b.querySelector('#no').onclick = closeModal;
    const go = async () => {
      const r = await T.roster.importPassword(b.querySelector('#pw').value, includeUser);
      if (r.code === 'BAD_PASSWORD') return msg('Wrong password, try again.');
      afterImport(r);
    };
    b.querySelector('#yes').onclick = go;
    b.querySelector('#pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}

async function afterImport(r) {
  if (r.error) { closeModal(); return msg(r.error); }
  await load();
  modal(`<h3>${esc(r.name)} is home! 🏡</h3><p class="sub">Put ${esc(r.name)} on the desktop now?</p>
    <div class="row"><button class="ghost" id="no">Later</button><button class="primary" id="yes">Switch now ✨</button></div>`, (b) => {
    b.querySelector('#no').onclick = closeModal;
    b.querySelector('#yes').onclick = () => T.roster.switchTo(r.id);
  });
}

$('#hatch').addEventListener('click', () => modal(`<h3>Hatch another? 🥚</h3><p class="sub">A new egg appears on the desktop (Tama restarts). Your current Tama goes home, paused.</p>
  <div class="row"><button class="ghost" id="no">Cancel</button><button class="primary" id="yes">Hatch</button></div>`, (b) => {
  b.querySelector('#no').onclick = closeModal;
  b.querySelector('#yes').onclick = () => T.roster.hatchNew();
}));
$('#import').addEventListener('click', importFlow);
$('#close').addEventListener('click', () => T.closeSelf());
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
if (new URLSearchParams(location.search).get('import')) importFlow();
load();
