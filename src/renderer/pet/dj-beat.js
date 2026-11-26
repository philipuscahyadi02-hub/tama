/* DJ Tama's ears (MUS-4, D-069): listens to the PC's audio output (loopback) while DJ mode is on and finds the beat
   with the shared tracker (src/shared/beat.js). The audio stays in this window's memory: it is only measured (bass
   energy, about 50 times a second), never recorded, saved or sent. Without loopback it falls back to a steady groove.
   Exposes window.TamaDjBeat = { start(onBeat), stop(), mode() }. */
(function () {
  const FALLBACK_BPM = 112;
  let stream = null; let ctx = null; let timer = null; let tracker = null; let mode = 'off'; // off | live | groove
  let onBeat = () => {};

  function groove() {
    mode = 'groove';
    let n = 0;
    timer = setInterval(() => onBeat(++n, FALLBACK_BPM), (60 / FALLBACK_BPM) * 1000);
  }

  async function start(cb) {
    stop();
    onBeat = cb;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
      for (const v of stream.getVideoTracks()) v.stop(); // Chromium needs a video track to grant loopback; we don't use it
      if (!stream.getAudioTracks().length) throw new Error('no loopback audio');
      ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 1024; an.smoothingTimeConstant = 0;
      src.connect(an); // analysis only: not connected to the speakers
      const bins = new Uint8Array(an.frequencyBinCount);
      const hz = ctx.sampleRate / an.fftSize;
      const lo = Math.max(1, Math.floor(40 / hz)); const hi = Math.max(lo + 1, Math.ceil(150 / hz)); // kick and bass
      tracker = window.TamaShared.beat.createBeatTracker();
      const t0 = performance.now();
      mode = 'live';
      console.log('[dj] listening to the PC sound for the beat');
      let beats = 0;
      timer = setInterval(() => {
        an.getByteFrequencyData(bins);
        let sum = 0;
        for (let i = lo; i <= hi; i++) sum += bins[i];
        const r = tracker.feed(sum / ((hi - lo + 1) * 255), (performance.now() - t0) / 1000);
        if (r.beat) { onBeat(0, r.bpm); if (++beats % 16 === 0) console.log(`[dj] beat ${beats}, ${r.bpm} BPM`); }
      }, 20);
    } catch (e) {
      console.log(`[dj] no PC sound (${(e && e.message) || e}): steady groove`);
      stop();
      onBeat = cb;
      groove(); // no loopback (refused, unsupported): a steady groove instead
    }
  }

  function stop() {
    clearInterval(timer); timer = null;
    if (stream) for (const t of stream.getTracks()) t.stop();
    stream = null;
    if (ctx) ctx.close().catch(() => {});
    ctx = null; tracker = null; mode = 'off';
  }

  window.TamaDjBeat = { start, stop, mode: () => mode };
})();
