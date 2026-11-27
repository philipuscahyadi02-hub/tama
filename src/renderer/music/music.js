/* Music widget (MUS-2, D-066): a dumb view. It renders the music state it receives, moves the progress bar between
   updates, and sends intents (controls, expand, close). All text goes in with textContent, never as HTML: song titles
   and lyrics come from a web page. */
const K = window.tama;
const $ = (id) => document.getElementById(id);
let view = { state: null, expanded: false, manual: false, look: { look: 'solid', opacity: 100 } };
let tab = 'queue';
let receivedAt = 0;
let seeking = false;
let lastSong = '';
/** songKey → lyrics text | null (none) */
const lyricsCache = new Map();

const clock = (ms) => { const s = Math.max(0, Math.round((ms || 0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const songKey = (s) => (s ? String(s.videoId || `${s.title}|${s.artist}`) : '');
/** Put a named icon into an element (static icon names only). */
const setIcon = (el, name) => { if (el.dataset.i !== name || !el.firstChild) { el.dataset.i = name; el.innerHTML = window.TamaIcon(name); } };
for (const el of document.querySelectorAll('.ico[data-i]')) el.insertAdjacentHTML('afterbegin', window.TamaIcon(el.dataset.i));

/** Colors come from shared/look.js (D-078). */
const theme = () => window.TamaLook.start();

function position() {
  const s = view.state;
  if (!s) return 0;
  const p = s.playing ? s.position + (Date.now() - receivedAt) : s.position;
  return s.duration ? Math.min(s.duration, p) : p;
}

function drawBar() {
  const s = view.state;
  const pos = position();
  const pct = s && s.duration ? Math.min(100, (pos / s.duration) * 100) : 0;
  $('fill').style.width = `${pct}%`;
  $('knob').style.left = `${pct}%`;
  $('pos').textContent = clock(pos);
  $('dur').textContent = s && s.duration ? clock(s.duration) : '0:00';
}

function render() {
  const s = view.state;
  const c = (s && s.controls) || {};
  $('card').className = `${view.expanded ? 'expanded' : 'compact'}${s && s.playing ? ' playing' : ''}`;
  // Up next / Lyrics live in the same box and slide open with #card.expanded (D-080).
  setIcon($('expand'), view.expanded ? 'up' : 'down');
  $('kickerText').textContent = !s ? 'Music' : s.playing ? 'Now playing' : 'Paused';
  const lk = view.look || { look: 'solid', opacity: 100 };
  document.body.classList.toggle('glass', lk.look === 'glass');
  for (const b of document.querySelectorAll('.seg button[data-look]')) b.classList.toggle('on', b.dataset.look === lk.look);
  for (const b of document.querySelectorAll('#pinSeg button')) b.classList.toggle('on', (b.dataset.pin === 'on') === !!view.pinned);
  if (document.activeElement !== $('opacity')) $('opacity').value = String(lk.opacity);
  $('opacity').style.setProperty('--v', `${((Number($('opacity').value) - 40) / 60) * 100}%`);
  $('opacityVal').textContent = `${$('opacity').value}%`;
  $('title').textContent = s ? s.title : 'Nothing playing';
  $('title').title = s ? s.title : '';
  $('sub').textContent = s ? [s.artist, s.album].filter(Boolean).join(' · ') : 'Play something on YouTube Music~';
  if (s && s.art) { $('art').src = s.art; $('art').hidden = false; $('noart').hidden = true; } else { $('art').hidden = true; $('noart').hidden = false; }
  setIcon($('toggle'), s && s.playing ? 'pause' : 'play');
  $('toggle').disabled = !s;
  $('prev').disabled = !s || !c.prev;
  $('next').disabled = !s || !c.next;
  $('bar').classList.toggle('off', !s || !c.seek);
  for (const id of ['like', 'dislike', 'repeat', 'shuffle']) $(id).hidden = !c[id === 'dislike' ? 'like' : id];
  $('like').classList.toggle('active', !!s && s.like === 'like');
  $('dislike').classList.toggle('active', !!s && s.like === 'dislike');
  $('repeat').classList.toggle('active', !!s && !!s.repeat && s.repeat !== 'off');
  setIcon($('repeat'), s && s.repeat === 'one' ? 'repeatOne' : 'repeat');
  $('repeat').title = `Repeat: ${(s && s.repeat) || 'off'}`;
  $('vol').hidden = !c.volume;
  if (s && s.volume != null && document.activeElement !== $('volume')) $('volume').value = String(s.volume);
  $('volume').style.setProperty('--v', `${$('volume').value}%`);
  setIcon($('volIcon'), s && (s.muted || s.volume === 0) ? 'mute' : 'volume');
  $('volume').title = s && s.volume != null ? `Volume ${s.volume}%` : 'Volume';
  drawBar();
  renderSource();
  if (view.expanded) renderTab();
}

function renderSource() {
  const s = view.state;
  const el = $('source');
  el.className = '';
  if (!s) { el.textContent = ''; return; }
  if (s.source === 'media') { el.textContent = `From Windows media controls (${s.app}). Install Tama Companion for Up next and lyrics: /music install`; return; }
  if (s.health && !s.health.ok) { el.className = 'warn'; el.textContent = `⚠ YouTube Music changed its page (not found: ${s.health.missing.join(', ')}). Some controls may not work.`; return; }
  el.textContent = 'Via Tama Companion · YouTube Music';
}

function empty(text) {
  const d = document.createElement('div'); d.className = 'empty';
  const badge = document.createElement('span'); badge.className = 'badge-ico'; badge.innerHTML = window.TamaIcon('note'); // D-078
  const t = document.createElement('div'); t.textContent = text;
  d.append(badge, t);
  return d;
}

function renderTab() {
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  $('queue').hidden = tab !== 'queue';
  $('lyrics').hidden = tab !== 'lyrics';
  $('library').hidden = tab !== 'library';
  if (tab === 'queue') renderQueue(); else if (tab === 'lyrics') renderLyrics(); else if (window.TamaLibrary) window.TamaLibrary.show();
}

function renderQueue() {
  const s = view.state;
  const ol = $('queue');
  ol.replaceChildren();
  if (!s || !s.controls.queue) { ol.append(empty(s ? 'Up next needs the Tama Companion extension (/music install).' : 'Nothing playing.')); return; }
  if (!s.queue.length) { ol.append(empty('The queue is empty. Open the player in YouTube Music once to load it.')); return; }
  let cur = null;
  for (const q of s.queue) {
    const li = document.createElement('li');
    if (q.current) { li.className = 'current'; cur = li; }
    if (q.art) { const img = document.createElement('img'); img.src = q.art; img.alt = ''; li.append(img); } else { const ph = document.createElement('span'); ph.className = 'ph'; ph.innerHTML = window.TamaIcon('note'); li.append(ph); }
    const t = document.createElement('div'); t.className = 't';
    const a = document.createElement('div'); a.textContent = q.title;
    const b = document.createElement('div'); b.className = 'a'; b.textContent = q.artist;
    t.append(a, b);
    const d = document.createElement('span'); d.className = 'd'; d.textContent = q.duration ? clock(q.duration) : '';
    li.append(t, d);
    li.title = q.current ? 'Playing now' : `Play ${q.title}`;
    li.addEventListener('click', () => { if (!q.current) K.music.control('jump', q.index); });
    ol.append(li);
  }
  if (cur && songKey(s) !== ol.dataset.scrolledFor) { ol.dataset.scrolledFor = songKey(s); cur.scrollIntoView({ block: 'nearest' }); }
}

async function renderLyrics() {
  const s = view.state;
  const box = $('lyrics');
  if (!s) { box.replaceChildren(empty('Nothing playing.')); return; }
  if (!s.controls.lyrics) { box.replaceChildren(empty('Lyrics need the Tama Companion extension (/music install).')); return; }
  const key = songKey(s);
  if (s.lyrics) lyricsCache.set(key, s.lyrics);
  if (lyricsCache.has(key)) {
    const l = lyricsCache.get(key);
    if (box.dataset.for !== key) { box.dataset.for = key; box.scrollTop = 0; }
    if (l) box.textContent = l; else box.replaceChildren(empty('No lyrics for this song on YouTube Music.'));
    return;
  }
  if (box.dataset.loading === key) return;
  box.dataset.loading = key;
  box.replaceChildren(empty('Looking for the lyrics…'));
  const r = await K.music.control('lyrics');
  box.dataset.loading = '';
  if (songKey(view.state) !== key) return; // the song changed meanwhile
  if (r.ok) lyricsCache.set(key, r.lyrics || null);
  else { box.replaceChildren(empty(r.error || 'Could not load the lyrics.')); return; }
  renderLyrics();
}

// ---- intents ----
const act = async (action, value) => { const r = await K.music.control(action, value); if (!r.ok && r.error) $('sub').textContent = `⚠ ${r.error}`; };
$('toggle').addEventListener('click', () => {
  if (view.state) { view.state.position = position(); receivedAt = Date.now(); view.state.playing = !view.state.playing; render(); } // feels instant
  act('toggle');
});
$('prev').addEventListener('click', () => act('prev'));
$('next').addEventListener('click', () => act('next'));
$('like').addEventListener('click', () => act('like'));
$('dislike').addEventListener('click', () => act('dislike'));
$('repeat').addEventListener('click', () => act('repeat'));
$('shuffle').addEventListener('click', () => act('shuffle'));
let volTimer = 0;
$('volume').addEventListener('input', () => { $('volume').style.setProperty('--v', `${$('volume').value}%`); clearTimeout(volTimer); volTimer = setTimeout(() => act('volume', Number($('volume').value)), 150); });
$('expand').addEventListener('click', () => K.music.widget(view.expanded ? 'collapse' : 'expand'));
// Look panel (D-068): solid or glass, opacity, back next to her.
$('lookBtn').addEventListener('click', (e) => { e.stopPropagation(); $('lookPanel').hidden = !$('lookPanel').hidden; });
document.addEventListener('click', (e) => { if (!$('lookPanel').hidden && !$('lookPanel').contains(e.target)) $('lookPanel').hidden = true; });
for (const b of document.querySelectorAll('.seg button[data-look]')) b.addEventListener('click', () => K.ui.setPrefs({ musicLook: b.dataset.look }));
for (const b of document.querySelectorAll('#pinSeg button')) b.addEventListener('click', () => K.music.widget(b.dataset.pin === 'on' ? 'pin' : 'unpin'));
let opTimer = 0;
$('opacity').addEventListener('input', () => {
  $('opacity').style.setProperty('--v', `${((Number($('opacity').value) - 40) / 60) * 100}%`);
  $('opacityVal').textContent = `${$('opacity').value}%`;
  clearTimeout(opTimer); opTimer = setTimeout(() => K.ui.setPrefs({ musicOpacity: Number($('opacity').value) }), 120);
});
$('beside').addEventListener('click', () => { $('lookPanel').hidden = true; K.music.widget('beside'); });
// Fully visible while the mouse is over the card; see-through again when it leaves.
{
  document.documentElement.addEventListener('mouseenter', () => K.music.widget('hover'));
  document.documentElement.addEventListener('mouseleave', () => K.music.widget('unhover'));
}
$('close').addEventListener('click', () => K.music.widget('dismiss'));
for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => { tab = b.dataset.tab; renderTab(); });

function seekTo(ev) {
  const s = view.state;
  if (!s || !s.controls.seek || !s.duration) return;
  const r = $('bar').getBoundingClientRect();
  const ms = Math.round(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * s.duration);
  s.position = ms; receivedAt = Date.now();
  drawBar();
  return ms;
}
$('bar').addEventListener('pointerdown', (ev) => { if (seekTo(ev) == null) return; seeking = true; $('bar').setPointerCapture(ev.pointerId); });
$('bar').addEventListener('pointermove', (ev) => { if (seeking) seekTo(ev); });
$('bar').addEventListener('pointerup', (ev) => { if (!seeking) return; seeking = false; const ms = seekTo(ev); if (ms != null) act('seek', ms); });

// ---- state from the core ----
K.music.onWidget((v) => {
  if (seeking) return;
  view = v;
  receivedAt = Date.now();
  const key = songKey(v.state);
  if (key !== lastSong) { lastSong = key; if (tab === 'lyrics') $('lyrics').dataset.for = ''; }
  render();
});
setInterval(() => { if (view.state && view.state.playing && !seeking) drawBar(); }, 500);
// (TamaLook follows character changes itself)
theme();
// Reduced motion (PET-8): the vinyl and the equalizer stand still.
const motion = (p) => document.body.classList.toggle('reduced', !!p && p.motion === 'reduced');
K.ui.prefs().then(motion).catch(() => null);
K.ui.onPrefs(motion);
K.music.get().then((st) => { if (!view.state && st && st.state) { view = { ...view, state: st.state }; receivedAt = Date.now(); render(); } });
render();
