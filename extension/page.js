// Tama Companion, page world (MUS-10): YouTube Music's own player object (#movie_player) is only reachable from the
// page's JavaScript, so this small script reads it and runs player commands for the content script.
// It only answers messages tagged for Tama Companion and only exposes player state, never page data or cookies.
(function () {
  const TAG = 'tama-companion';
  const player = () => document.getElementById('movie_player');

  function read() {
    const p = player();
    if (!p || typeof p.getPlayerState !== 'function') return null;
    try {
      const d = typeof p.getVideoData === 'function' ? p.getVideoData() : {};
      return {
        videoId: String((d && d.video_id) || ''),
        state: p.getPlayerState(), // 1 playing, 2 paused, 3 buffering, 0 ended, -1 unstarted
        time: Number(p.getCurrentTime()) || 0,
        duration: Number(p.getDuration()) || 0,
        volume: typeof p.getVolume === 'function' ? Number(p.getVolume()) : null,
        muted: typeof p.isMuted === 'function' ? !!p.isMuted() : null,
      };
    } catch (e) { return null; }
  }

  function run(action, value) {
    const p = player();
    if (!p) return false;
    try {
      if (action === 'play') p.playVideo();
      else if (action === 'pause') p.pauseVideo();
      else if (action === 'toggle') (p.getPlayerState() === 1 ? p.pauseVideo() : p.playVideo());
      else if (action === 'seek') p.seekTo(Math.max(0, Number(value) || 0) / 1000, true);
      else if (action === 'volume') {
        const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
        p.setVolume(v);
        if (v > 0 && typeof p.unMute === 'function' && p.isMuted && p.isMuted()) p.unMute();
      } else return false;
      return true;
    } catch (e) { return false; }
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.tag !== TAG || e.data.dir !== 'to-page') return;
    const { id, op, action, value } = e.data;
    const reply = op === 'read' ? read() : op === 'run' ? run(action, value) : null;
    window.postMessage({ tag: TAG, dir: 'to-content', id, reply }, location.origin);
  });
})();
