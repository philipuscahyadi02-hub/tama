/* Setup wizard (SHIP-4, D-059): a dumb view over the setup service. Every button sends one intent (install, sign in,
   open a page, open an official link) and the list re-renders from fresh status. */
const $ = (s) => document.querySelector(s);
const K = window.tama;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let msgTimer = null;
const say = (t, err) => {
  $('#msg').textContent = t || ''; $('#msg').classList.toggle('err', !!err);
  clearTimeout(msgTimer); if (t && !err) msgTimer = setTimeout(() => say(''), 6000);
};
const ICONS = { claude: '💻', agy: '💬', voice: '🎙️', google: '🔗', telegram: '📱' };
const STATE = { ready: 'Ready', signin: 'Sign in', missing: 'Not installed', optional: 'Optional' };
const BRAIN = { claude: 'Claude Code', agy: 'Gemini' };

function render(st) {
  if (!st) return;
  const b = st.brains || {};
  const who = (cap, none) => (b[cap] ? `<b>${esc(BRAIN[b[cap]] || b[cap])}</b>` : `<b>nothing yet</b> (${esc(none)})`);
  $('#summary').innerHTML = [
    `💬 Chat: ${who('chat', 'install agy, or let Claude chat in Settings → Brains')}`,
    `💻 Terminal: ${who('code', 'install Claude Code')}`,
    `✨ Moments & diary: ${who('compose', 'she uses her built-in lines')}`,
    `🎨 New looks: ${who('json', 'designed from keywords')}`,
  ].join('<br>');
  $('#items').innerHTML = st.items.map((it) => `
    <div class="card item" data-id="${esc(it.id)}">
      <div class="icon">${ICONS[it.id] || '•'}</div>
      <div>
        <h3>${esc(it.name)} <span class="state ${esc(it.state)}">${esc(STATE[it.state] || it.state)}</span>${it.core || it.state === 'optional' ? '' : ' <span class="core-tag">optional</span>'}</h3>
        <p class="unlocks">${esc(it.unlocks)}</p>
        <p class="detail dim">${esc(it.detail)}</p>
      </div>
      <div class="acts">${it.actions.map((a) => `<button data-act="${esc(a.id)}"${a.primary ? ' class="primary"' : ''}>${esc(a.label)}</button>`).join('')}</div>
      ${it.actions.filter((a) => a.command).map((a) => `<div class="cmd" title="Runs in a visible PowerShell window">Runs: ${esc(a.command)}</div>`).join('')}
    </div>`).join('');
  document.querySelectorAll('#items [data-act]').forEach((btn) => btn.addEventListener('click', async () => {
    const id = btn.closest('.item').dataset.id;
    btn.disabled = true;
    const r = await K.setup.action(id, btn.dataset.act).catch((e) => ({ error: String(e.message || e) }));
    btn.disabled = false;
    if (r && r.error) say(r.error, true); else if (r && r.message) say(r.message);
  }));
}

async function load(recheck) {
  if (recheck) say('checking…');
  const st = await K.setup.status(!!recheck).catch((e) => { say(String(e.message || e), true); return null; });
  render(st);
  if (recheck && st) say(st.needsSetup ? 'checked: some parts are still missing' : 'checked ✓');
}

$('#recheck').addEventListener('click', () => load(true));
$('#brains').addEventListener('click', () => K.openSettings('brains'));
$('#done').addEventListener('click', async () => { await K.setup.seen().catch(() => null); window.close(); });
// Coming back from an installer window: check again by itself.
let away = false;
window.addEventListener('blur', () => { away = true; });
window.addEventListener('focus', () => { if (away) { away = false; load(true); } });
K.providers.onChange(() => load(false));

(async function init() {
  const ch = await K.getCharacter().catch(() => null);
  if (ch && ch.stage !== 'egg') for (const [k, v] of Object.entries(window.TamaShared.theme.chatVars(ch.spec))) document.documentElement.style.setProperty(k, v);
  await load(false);
})();
