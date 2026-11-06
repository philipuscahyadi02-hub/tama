/* Google setup page (GOOG-1, D-034). A dumb view over window.tama.google. */
const $ = (s) => document.querySelector(s);
const K = window.tama;
const G = K.google;

const say = (el, text, err) => { el.textContent = text || ''; el.classList.toggle('err', !!err); };
const ago = (t) => (t ? new Date(t).toLocaleString() : 'never');

function render(s) {
  const box = $('#statusBox');
  if (s.signedIn) {
    box.innerHTML = `<b>✅ Connected</b> as <b>${esc(s.email || 'your Google account')}</b>${s.inMeeting ? ` · 📅 in a meeting: ${esc(s.inMeeting)}` : ''}
      <div class="dim">Access: ${s.scopes.map((x) => `<span class="pill">${esc(x)}</span>`).join('')}</div>
      <div class="dim">Last backup: ${ago(s.lastBackup)}</div>`;
  } else if (s.configured) {
    box.innerHTML = '<b>🔑 Your Google app is saved.</b> <span class="dim">Press "Save &amp; sign in" (you can leave the fields empty to keep the saved ones).</span>';
  } else {
    box.innerHTML = '<b>Not connected yet.</b> <span class="dim">Follow the steps below once; after that, Tama stays signed in.</span>';
  }
  $('#setup').classList.toggle('hidden', s.signedIn);
  $('#connected').classList.toggle('hidden', !s.signedIn);
  $('#optBackup').checked = s.backup;
  $('#optReadonly').checked = s.readonly;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function signIn(msgEl) {
  say(msgEl, 'A browser window opened: choose your account and allow access~ (this window updates by itself)');
  const r = await G.login();
  if (r && r.error) say(msgEl, `✗ ${r.error}`, true);
  else { say(msgEl, ''); render(r); }
}

$('#save').addEventListener('click', async () => {
  const id = $('#clientId').value.trim();
  const secret = $('#clientSecret').value.trim();
  const s = await G.status();
  if (id || secret || !s.configured) {
    const r = await G.setClient({ clientId: id, clientSecret: secret });
    if (r.error) return say($('#msg'), `✗ ${r.error}`, true);
  }
  $('#save').disabled = true;
  try { await signIn($('#msg')); } finally { $('#save').disabled = false; }
});
$('#relogin').addEventListener('click', () => signIn($('#msg2')));
$('#logout').addEventListener('click', async () => { render(await G.logout()); say($('#msg'), 'Disconnected. Your Google app settings are kept; sign in again any time.'); });
$('#optBackup').addEventListener('change', async (e) => render(await G.set({ backup: e.target.checked })));
$('#optReadonly').addEventListener('change', async (e) => {
  const r = await G.set({ readonly: e.target.checked });
  render(r);
  if (r.needsLogin) say($('#msg2'), 'Reading all of Drive needs one more permission: press "Sign in again".');
});
$('#brief').addEventListener('click', async () => {
  const r = await G.brief();
  say($('#msg2'), r.error ? `✗ ${r.error}` : r.text, !!r.error);
});
$('#backupNow').addEventListener('click', async () => {
  say($('#msg2'), 'backing up…');
  const r = await G.backupNow();
  say($('#msg2'), r.error ? `✗ ${r.error}` : `✓ saved ${r.name} (${Math.round(r.size / 1024)} KB)`, !!r.error);
});
document.querySelectorAll('a[data-href]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); K.openLink(a.dataset.href); }));
G.onChange(render);

(async function boot() {
  const ch = await K.getCharacter().catch(() => null);
  if (ch && ch.stage !== 'egg') {
    for (const [k, v] of Object.entries(window.TamaShared.theme.chatVars(ch.spec))) document.documentElement.style.setProperty(k, v);
  }
  render(await G.status());
})();
