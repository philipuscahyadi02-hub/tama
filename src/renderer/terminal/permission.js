/* The permission prompt: every tool Claude Code wants to use is shown here (or on the phone) and needs the user's
   answer (SAFE-1; QC-4: split out of terminal.js). Loaded after terminal.js and shares its globals. */
// ---------------- permission prompt ----------------
let curPerm = null;
let permSel = 0;
function permOptions(p) {
  const what = p.name === 'Bash' ? 'commands like this' : p.name.startsWith('mcp__') ? 'this tool' : `${p.name} in this session`;
  return [
    ['yes', 'Yes'],
    ['always', `Yes, and don't ask again for ${what}`],
    ['no', `No, and tell ${tamaName()} what to do differently (esc)`],
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
    <div class="who">(｡•́︿•̀｡) ano… ${esc(tamaName())} wants to do this:</div>
    <div class="preview">${preview}</div>
    ${p.reason ? `<div class="dim">${esc(p.reason)}</div>` : ''}
    <div class="q">${q}</div>
    <div class="opts">${permOptions(p).map(([, label], n) => `<div class="opt" data-n="${n}">${n + 1}. ${esc(label)}</div>`).join('')}</div>
    <input class="fb hidden" placeholder="Tell ${esc(tamaName())} what to do instead… (Enter to send, empty = just stop)" />
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
