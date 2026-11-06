/* Pet voice (M9, D-042): plays the Tama's lines with a talking mouth that follows the audio's loudness, and encodes WAV →
   M4A for Telegram voice notes (Chromium can record audio/mp4 but not OGG). A dumb view: the core decides what to say. */
(function () {
  const T = window.tama;
  const pet = document.querySelector('#pet');
  let ctx = null;
  let current = null; // { src, raf }
  const queue = [];

  const audioCtx = () => (ctx = ctx || new AudioContext());
  const b64ToBuf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  const bufToB64 = (buf) => {
    let s = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };

  function stopCurrent() {
    if (!current) return;
    try { current.src.stop(); } catch { /* ended */ }
    cancelAnimationFrame(current.raf);
    pet.classList.remove('talking', 'talk-open');
    current = null;
  }

  async function playNext() {
    if (current || !queue.length) return;
    const item = queue.shift();
    try {
      const ac = audioCtx();
      if (ac.state === 'suspended') await ac.resume();
      const buf = await ac.decodeAudioData(b64ToBuf(item.wav));
      const src = ac.createBufferSource();
      src.buffer = buf;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analyser.connect(ac.destination);
      const data = new Uint8Array(analyser.fftSize);
      current = { src, raf: 0 };
      pet.classList.add('talking');
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        pet.classList.toggle('talk-open', Math.sqrt(sum / data.length) > 0.06);
        if (current) current.raf = requestAnimationFrame(tick);
      };
      tick();
      src.onended = () => { stopCurrent(); playNext(); };
      src.start();
    } catch (e) {
      console.warn('[voice] play failed', e);
      stopCurrent();
      playNext();
    }
  }

  T.voice.onPlay((p) => {
    if (!p || !p.wav) return;
    if (queue.length > 2) queue.splice(0, queue.length - 2); // don't pile up old lines
    queue.push(p);
    playNext();
  });

  // WAV → M4A (AAC) via MediaRecorder, for Telegram voice notes. Recording is real-time but silent (not routed to speakers).
  T.voice.onEncode(async ({ id, wav }) => {
    try {
      const ac = audioCtx();
      if (ac.state === 'suspended') await ac.resume();
      const buf = await ac.decodeAudioData(b64ToBuf(wav));
      const dest = ac.createMediaStreamDestination();
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(dest);
      const mime = MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2') ? 'audio/mp4;codecs=mp4a.40.2' : 'audio/mp4';
      const rec = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: 64000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const done = new Promise((resolve) => { rec.onstop = resolve; });
      rec.start();
      src.onended = () => setTimeout(() => rec.stop(), 150);
      src.start();
      await done;
      const out = await new Blob(chunks, { type: 'audio/mp4' }).arrayBuffer();
      T.voice.encoded(id, { data: bufToB64(out), mime: 'audio/mp4' });
    } catch (e) {
      T.voice.encoded(id, { error: String(e && e.message || e) });
    }
  });

  window.TamaVoicePlayer = { stop: () => { queue.length = 0; stopCurrent(); } };
}());
