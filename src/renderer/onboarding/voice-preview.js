/* Voice preview with the built-in Web Speech / Windows voices (VOICE-1 groundwork, D-004).
   Picks a system voice matching voiceGender and applies pitch + rate from the VoiceSpec. */
(function () {
  const FEMALE = /zira|hazel|susan|aria|jenny|sonia|libby|nanami|haruka|female|woman|girl/i;
  const MALE = /david|mark|george|guy|ryan|keita|ichiro|male|man|boy/i;

  function voices() {
    return new Promise((resolve) => {
      const list = speechSynthesis.getVoices();
      if (list.length) return resolve(list);
      speechSynthesis.addEventListener('voiceschanged', () => resolve(speechSynthesis.getVoices()), { once: true });
      setTimeout(() => resolve(speechSynthesis.getVoices()), 1500);
    });
  }

  /** @param {{voiceGender: string}} voice */
  async function pickVoice(voice) {
    const list = await voices();
    const en = list.filter((v) => /^en/i.test(v.lang));
    const pool = en.length ? en : list;
    const re = voice.voiceGender === 'male' ? MALE : voice.voiceGender === 'female' ? FEMALE : null;
    return (re && pool.find((v) => re.test(v.name))) || pool[0] || null;
  }

  /** Speak `text` with a VoiceSpec. Resolves when done (or immediately if speech is unavailable). */
  async function speak(text, voice) {
    if (!('speechSynthesis' in window)) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = await pickVoice(voice);
    if (v) u.voice = v;
    u.pitch = voice.pitch;
    u.rate = voice.rate;
    return new Promise((resolve) => {
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      speechSynthesis.speak(u);
    });
  }

  window.TamaVoice = { speak, pickVoice };
}());
