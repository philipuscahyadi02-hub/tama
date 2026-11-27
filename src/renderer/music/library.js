/* Playlists tab (MUS-6): the user's YouTube playlists, their songs and song search. A dumb view over
   tama.music.library / tama.music.play; every title comes from YouTube, so it goes in with textContent only. */
(function () {
  const K = window.tama;
  const $ = (id) => document.getElementById(id);
  /** view: 'playlists' | 'items' | 'search' */
  const st = { view: 'playlists', playlists: null, playlist: null, songs: null, query: '', loading: false, error: null, note: '', loaded: false };
  let ticket = 0;

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const icon = (name) => { const s = el('span', 'ph'); s.innerHTML = window.TamaIcon(name); return s; };

  function row({ art, title, sub, iconName, onClick, tip }) {
    const li = el('li');
    if (art) { const img = el('img'); img.src = art; img.alt = ''; li.append(img); } else li.append(icon(iconName || 'note'));
    const t = el('div', 't');
    t.append(el('div', '', title), el('div', 'a', sub || ''));
    li.append(t);
    li.title = tip || title;
    li.addEventListener('click', onClick);
    return li;
  }

  /** The "why it's empty" box, with one button that fixes it when there is one. */
  function problem(e) {
    const box = el('div', 'empty', e.error || 'Something went wrong.');
    const fixes = {
      connect: ['Connect YouTube', async () => { st.note = 'Finish the sign-in in your browser…'; st.error = null; render(); const r = await K.music.library({ op: 'connect' }); if (r && r.error) { st.error = r; render(); } else load('playlists', true); }],
      google: ['Set up Google', () => K.google.open()],
      'enable-api': ['Turn it on in Google Cloud', () => K.openLink('https://console.cloud.google.com/apis/library/youtube.googleapis.com')],
    };
    const f = fixes[e.fix];
    if (f) { const b = el('button', 'pill', f[0]); b.addEventListener('click', f[1]); box.append(el('br'), b); }
    if (e.fix === 'enable-api') { const b = el('button', 'pill', 'Try again'); b.addEventListener('click', () => load(st.view === 'items' ? 'items' : 'playlists', true)); box.append(' ', b); }
    return box;
  }

  async function load(view, fresh = false) {
    const my = ++ticket;
    st.view = view; st.loading = true; st.error = null;
    render();
    const r = view === 'playlists' ? await K.music.library({ op: 'playlists', fresh })
      : view === 'items' ? await K.music.library({ op: 'items', id: st.playlist.id })
        : await K.music.library({ op: 'search', q: st.query });
    if (my !== ticket) return; // a newer request replaced this one
    st.loading = false; st.loaded = true;
    if (!r || r.error) st.error = r || { error: 'No answer from Tama.' };
    else if (view === 'playlists') st.playlists = r.playlists || [];
    else st.songs = r.songs || [];
    render();
  }

  async function play(p, label) {
    st.note = `Opening ${label} in YouTube Music…`;
    render();
    const r = await K.music.play(p);
    st.note = r && r.ok ? (r.opened === 'browser' ? `Opened ${label} in your browser.` : `Playing ${label}~`) : `⚠ ${(r && r.error) || 'Could not play that.'}`;
    render();
    setTimeout(() => { st.note = ''; render(); }, 4000);
  }

  function render() {
    const list = $('libList');
    const inList = st.view !== 'playlists';
    $('libHead').hidden = !inList;
    $('libClear').hidden = st.view !== 'search';
    $('libPlayAll').hidden = st.view !== 'items' || !st.songs || !st.songs.length;
    $('libTitle').textContent = st.view === 'items' ? st.playlist.title : st.view === 'search' ? `Songs for "${st.query}"` : '';
    list.replaceChildren();
    if (st.note) list.append(el('li', 'note', st.note));
    if (st.loading) { list.append(el('div', 'empty', st.view === 'search' ? 'Searching…' : 'Loading…')); return; }
    if (st.error) { list.append(problem(st.error)); return; }
    if (st.view === 'playlists') {
      const rows = st.playlists || [];
      if (!rows.length) { list.append(el('div', 'empty', 'No playlists yet. Make one in YouTube Music~')); return; }
      for (const p of rows) {
        list.append(row({
          art: p.art, title: p.title, iconName: p.liked ? 'heart' : 'library',
          sub: p.liked ? 'Songs you liked' : `${p.count} song${p.count === 1 ? '' : 's'}`,
          tip: `Open ${p.title}`, onClick: () => { st.playlist = p; st.songs = null; load('items'); },
        }));
      }
      return;
    }
    const songs = st.songs || [];
    if (!songs.length) { list.append(el('div', 'empty', st.view === 'search' ? 'Nothing found. Try other words?' : 'This playlist is empty.')); return; }
    const inPlaylist = st.view === 'items' && !st.playlist.liked ? st.playlist.id : '';
    for (const s of songs) {
      list.append(row({ art: s.art, title: s.title, sub: s.artist, tip: `Play ${s.title}`, onClick: () => play({ videoId: s.videoId, playlistId: inPlaylist || undefined }, `"${s.title}"`) }));
    }
  }

  $('libSearch').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('libQ').value.trim();
    if (!q) return;
    st.query = q; st.songs = null;
    load('search');
  });
  $('libClear').addEventListener('click', () => { $('libQ').value = ''; st.view = 'playlists'; st.error = null; if (st.playlists) render(); else load('playlists'); });
  $('libBack').addEventListener('click', () => { if (st.view === 'search') $('libQ').value = ''; st.view = 'playlists'; st.error = null; if (st.playlists) render(); else load('playlists'); });
  $('libPlayAll').addEventListener('click', () => play({ playlistId: st.playlist.id }, `"${st.playlist.title}"`));

  window.TamaLibrary = {
    /** Called whenever the tab is shown; loads once, then keeps what it has. */
    show() { if (!st.loaded && !st.loading) load('playlists'); },
  };
})();
