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
$('useCode').addEventListener('click', () => { codeMode = true; refresh(); });
$('unpair').addEventListener('click', async () => { await chrome.runtime.sendMessage({ t: 'unpair' }); refresh(); });

refresh();
setInterval(refresh, 1500);
