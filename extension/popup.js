// Tama Companion popup: shows the connection and pairs with the code Tama shows.
const $ = (id) => document.getElementById(id);
let codeMode = false;
const TEXT = {
  connected: '✅ Connected to Tama.',
  searching: '🔍 Looking for Tama… Is the Tama app running?',
  'needs-code': '🔗 Tama found. Connect once:',
  waiting: '👀 Look at your Tama and click Allow on her bubble…',
  denied: '🔗 That code did not work. Get a new one from Tama:',
};

async function refresh() {
  const s = await chrome.runtime.sendMessage({ t: 'status' });
  const extra = s.status === 'connected' ? (s.tabs ? (s.playing ? ' Showing your YouTube Music tab.' : ' YouTube Music is open.') : ' Open music.youtube.com to start.') : '';
  $('status').textContent = (TEXT[s.status] || s.status) + extra;
  const needs = s.status !== 'connected' && s.status !== 'waiting';
  $('connectBox').hidden = !needs || codeMode;
  $('pair').hidden = !needs || !codeMode;
  $('unpair').hidden = s.status !== 'connected';
  $('askBox').hidden = s.status !== 'connected';
}

$('pair').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('err').textContent = '';
  const btn = $('pair').querySelector('button');
  btn.disabled = true;
  const r = await chrome.runtime.sendMessage({ t: 'pair', code: $('code').value });
  btn.disabled = false;
  if (!r.ok) $('err').textContent = r.error || 'Pairing failed.';
  refresh();
});
$('connect').addEventListener('click', async () => {
  $('connect').disabled = true;
  $('err').textContent = '';
  refresh();
  const r = await chrome.runtime.sendMessage({ t: 'connect' });
  $('connect').disabled = false;
  if (!r.ok) { $('status').textContent = `⚠ ${r.error || 'Not connected.'}`; return; }
  refresh();
});
// Ask about this page / save it (D-083): the page is read only now, because you opened the popup on it.
async function askTama(msg, done) {
  $('askMsg').textContent = 'Sending…';
  const r = await chrome.runtime.sendMessage(msg);
  $('askMsg').textContent = r && r.ok ? done : `⚠ ${(r && r.error) || 'Not sent.'}`;
  if (r && r.ok) setTimeout(() => window.close(), 900);
}
$('askBtn').addEventListener('click', () => {
  const question = $('q').value.trim();
  if (!question) { $('askMsg').textContent = 'Type a question first~'; $('q').focus(); return; }
  askTama({ t: 'popup-ask', question, withPage: $('withPage').checked }, '✓ Sent. Her answer is in the chat.');
});
$('q').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('askBtn').click(); });
for (const b of document.querySelectorAll('[data-cap]')) {
  b.addEventListener('click', () => askTama({ t: 'popup-capture', kind: b.dataset.cap, when: $('remWhen').value }, b.dataset.cap === 'remind' ? '✓ Reminder set.' : '✓ Saved.'));
}
$('useCode').addEventListener('click', () => { codeMode = true; refresh(); });
$('unpair').addEventListener('click', async () => { await chrome.runtime.sendMessage({ t: 'unpair' }); refresh(); });

refresh();
setInterval(refresh, 1500);
