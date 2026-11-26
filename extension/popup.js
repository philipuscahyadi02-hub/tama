// Tama Companion popup: shows the connection and pairs with the code Tama shows.
const $ = (id) => document.getElementById(id);
const TEXT = {
  connected: '✅ Connected to Tama.',
  searching: '🔍 Looking for Tama… Is the Tama app running?',
  'needs-code': '🔗 Tama found. Pair once with a code:',
  denied: '🔗 That code did not work. Get a new one from Tama:',
};

async function refresh() {
  const s = await chrome.runtime.sendMessage({ t: 'status' });
  const extra = s.status === 'connected' ? (s.tabs ? (s.playing ? ' Showing your YouTube Music tab.' : ' YouTube Music is open.') : ' Open music.youtube.com to start.') : '';
  $('status').textContent = (TEXT[s.status] || s.status) + extra;
  $('pair').hidden = s.status === 'connected';
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
$('unpair').addEventListener('click', async () => { await chrome.runtime.sendMessage({ t: 'unpair' }); refresh(); });

refresh();
setInterval(refresh, 1500);
