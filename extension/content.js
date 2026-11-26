// Tama Companion, content script (MUS-10, D-066): reads the YouTube Music player and page, sends a compact state to
// the extension's background (which forwards it to Tama), and runs Tama's commands on this tab.
// Reads only what the player shows (song, queue, lyrics); never cookies, sign-in or other pages.
(function () {
  const SEL = globalThis.TAMA_SEL;
  const Y = globalThis.TamaYtm;
  const TAG = 'tama-companion';

  const q = (key, root = document) => { for (const s of SEL[key]) { const el = root.querySelector(s); if (el) return el; } return null; };
  const qa = (key, root = document) => { for (const s of SEL[key]) { const els = root.querySelectorAll(s); if (els.length) return [...els]; } return []; };
  const text = (el) => (el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '');

  // ---- page-world bridge (page.js) ----
  let seq = 0;
  const pending = new Map();
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.tag !== TAG || e.data.dir !== 'to-content') return;
    const f = pending.get(e.data.id);
    if (f) { pending.delete(e.data.id); f(e.data.reply); }
  });
  function page(op, action, value) {
    return new Promise((resolve) => {
      const id = `${Date.now()}-${++seq}`;
      const timer = setTimeout(() => { pending.delete(id); resolve(null); }, 1000);
      pending.set(id, (r) => { clearTimeout(timer); resolve(r); });
      window.postMessage({ tag: TAG, dir: 'to-page', id, op, action, value }, location.origin);
    });
  }

  // ---- reading ----
  function readQueue() {
    return qa('queueItems')
      .filter((el) => !el.closest('#counterpart-renderer'))
      .slice(0, 50)
      .map((el, i) => {
        const by = Y.parseByline(text(q('queueByline', el)));
        return {
          index: i,
          title: text(q('queueTitle', el)).slice(0, 200),
          artist: by.artist.slice(0, 200),
          duration: Y.parseDuration(text(q('queueDuration', el))),
          art: Y.bigArt((q('queueArt', el) || {}).src),
          current: el.hasAttribute('selected') || el.getAttribute('play-button-state') === 'playing' || el.getAttribute('play-button-state') === 'paused',
        };
      });
  }

  function readLyrics() {
    const el = q('lyrics');
    const t = el ? String(el.innerText || el.textContent || '').trim() : '';
    if (!t) return null;
    const src = text(q('lyricsSource'));
    return (src ? `${t}\n\n${src}` : t).slice(0, 20000);
  }

  async function read() {
    const bar = q('playerBar');
    const title = text(q('title'));
    const pw = await page('read');
    const video = q('video');
    if (!bar || (!title && !pw)) return null;
    const by = Y.parseByline(text(q('byline')));
    const repeatBtn = q('repeat');
    const likeR = q('likeRenderer');
    const queue = readQueue();
    const playing = pw ? pw.state === 1 || pw.state === 3 : !!(video && !video.paused);
    const position = Math.round(1000 * (pw ? pw.time : (video && video.currentTime) || 0));
    const duration = Math.round(1000 * (pw ? pw.duration : (video && video.duration) || 0)) || 0;
    const videoId = (pw && pw.videoId) || new URLSearchParams(location.search).get('v') || '';
    const missing = [];
    if (!title) missing.push('title');
    if (!q('next')) missing.push('next');
    if (!pw) missing.push('player');
    const lyrics = readLyrics();
    return {
      videoId,
      url: videoId ? `https://music.youtube.com/watch?v=${encodeURIComponent(videoId)}` : '',
      title: title.slice(0, 300), artist: by.artist.slice(0, 300), album: by.album.slice(0, 300),
      art: Y.bigArt((q('art') || {}).src),
      playing, position, duration: Number.isFinite(duration) ? duration : 0, at: Date.now(),
      volume: pw && Number.isFinite(pw.volume) ? pw.volume : null,
      muted: pw ? pw.muted : null,
      repeat: repeatBtn ? Y.parseRepeat(repeatBtn.getAttribute('title') || repeatBtn.getAttribute('aria-label')) : null,
      like: likeR ? Y.parseLike(likeR.getAttribute('like-status')) : null,
      queue,
      queueKey: queue.map((x) => `${x.title}|${x.current ? 1 : 0}`).join('~'),
      lyrics,
      health: { ok: missing.length === 0, missing },
      healthKey: missing.join(','),
    };
  }

  // ---- commands ----
  const click = (el) => { if (!el) return false; el.click(); return true; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run(action, value) {
    switch (action) {
      case 'play': case 'pause': case 'toggle': case 'seek': case 'volume': {
        if (await page('run', action, value)) return { ok: true };
        const v = q('video');
        if (!v) return { ok: false, error: 'no player' };
        if (action === 'play') await v.play(); else if (action === 'pause') v.pause();
        else if (action === 'toggle') (v.paused ? await v.play() : v.pause());
        else if (action === 'seek') v.currentTime = Math.max(0, Number(value) || 0) / 1000;
        else v.volume = Math.max(0, Math.min(100, Number(value) || 0)) / 100;
        return { ok: true };
      }
      case 'next': return { ok: click(q('next')) };
      case 'prev': return { ok: click(q('prev')) };
      case 'shuffle': return { ok: click(q('shuffle')) };
      case 'repeat': return { ok: click(q('repeat')) };
      case 'like': return { ok: click(q('likeButton', q('likeRenderer') || document)) };
      case 'dislike': return { ok: click(q('dislikeButton', q('likeRenderer') || document)) };
      case 'jump': {
        const items = qa('queueItems').filter((el) => !el.closest('#counterpart-renderer'));
        const el = items[Math.round(Number(value))];
        return { ok: !!el && click(q('queuePlay', el) || el) };
      }
      case 'open': {
        const u = String(value || '');
        if (!/^https:\/\/music\.youtube\.com\//.test(u)) return { ok: false, error: 'not a YouTube Music link' };
        location.href = u;
        return { ok: true };
      }
      case 'lyrics': {
        let l = readLyrics();
        if (l) return { ok: true, lyrics: l };
        const tab = qa('pageTabs').find((t) => /lyric/i.test(text(t)));
        if (!tab) return { ok: false, error: 'no lyrics tab' };
        if (tab.hasAttribute('disabled') || tab.getAttribute('aria-disabled') === 'true') return { ok: true, lyrics: null };
        tab.click();
        for (let i = 0; i < 15 && !(l = readLyrics()); i++) await sleep(200);
        return { ok: true, lyrics: l };
      }
      default: return { ok: false, error: 'unknown action' };
    }
  }

  // ---- connection to the background ----
  let port = null;
  let last = null;
  let lastSent = 0;

  function connect() {
    try { port = chrome.runtime.connect({ name: 'ytm' }); } catch (e) { return; } // extension reloaded: this script is orphaned
    last = null;
    port.onMessage.addListener(async (m) => {
      if (m && m.t === 'cmd') {
        let r;
        try { r = await run(String(m.action), m.value); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
        try { port.postMessage({ t: 'result', id: m.id, ...r }); } catch (e) { /* disconnected */ }
        setTimeout(tick, 400);
      } else if (m && m.t === 'resend') { last = null; tick(); }
    });
    port.onDisconnect.addListener(() => { port = null; setTimeout(connect, 1500); });
    tick();
  }

  async function tick() {
    if (!port) return;
    const s = await read();
    const now = Date.now();
    // Re-send at least every 30 s so a restarted background (or Tama) catches up.
    if (!Y.significant(last, s, now) && now - lastSent < 30000) return;
    last = s; lastSent = now;
    try { port.postMessage({ t: 'state', state: s }); } catch (e) { /* disconnected */ }
  }

  let debounce = 0;
  const obs = new MutationObserver(() => { clearTimeout(debounce); debounce = setTimeout(tick, 300); });
  function observe() {
    const bar = q('playerBar');
    if (!bar) { setTimeout(observe, 2000); return; }
    obs.observe(bar, { subtree: true, childList: true, attributes: true, characterData: true });
    const queue = document.querySelector('ytmusic-player-queue');
    if (queue) obs.observe(queue, { subtree: true, childList: true, attributes: true, attributeFilter: ['selected', 'play-button-state'] });
  }
  setInterval(tick, 2000); // position, volume and player state (not all of it shows up as DOM changes)
  observe();
  connect();
})();
