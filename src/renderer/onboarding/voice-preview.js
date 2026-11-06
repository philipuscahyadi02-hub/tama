/* Voice preview for onboarding (VOICE-1, D-042). Chromium's speechSynthesis has no voices inside Electron, so the main
   process renders the line (AivisSpeech / VOICEVOX or the Windows voice, with the VoiceSpec pitch + rate) and this
   plays the WAV with Web Audio. */
(function () {
  let ctx = null;
  let current = null;

  /** Speak `text` with a VoiceSpec. Resolves true when done, false if speech is unavailable. */
  async function speak(text, voice) {
    try {
      const r = await window.tama.voice.preview(text, voice);
      if (!r || !r.wav) return false;
      ctx = ctx || new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const bytes = Uint8Array.from(atob(r.wav), (c) => c.charCodeAt(0));
      const buf = await ctx.decodeAudioData(bytes.buffer);
      if (current) { try { current.stop(); } catch { /* ended */ } }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      current = src;
      return await new Promise((resolve) => { src.onended = () => resolve(true); src.start(); });
    } catch (e) {
      console.warn('[voice] preview failed', e);
      return false;
    }
  }

  window.TamaVoice = { speak };
}());
