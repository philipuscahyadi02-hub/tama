// @ts-check
// Emotion for the voice (D-045): which mood a line has, which style of the chosen voice fits it, and small prosody
// changes per mood. All pure, table-tested. The Japanese dub gets its mood from the translator (it reads the line in
// context); this keyword guess is the fallback and is used for English lines.

const MOODS = ['normal', 'happy', 'excited', 'sweet', 'tease', 'sad', 'sleepy', 'calm', 'angry'];

/** @type {Array<[string, RegExp]>} first match wins; checked on the original text (emoji and kaomoji included). */
const CUES = [
  ['sleepy', /\b(zzz+|sleepy|tired|yawn|nap|bedtime|good ?night|oyasumi|ngantuk)\b|💤|😴|🥱|ねむ|おやすみ/i],
  ['sad', /\b(sorry|gomen|sad|miss(ed)? you|lonely|cry|crying|sniff|unfortunately|sedih|maaf)\b|🥺|😢|😭|💔|ごめん|さみし|かなし/i],
  ['angry', /\b(angry|mad|grr+|hmph|baka|unfair|stop it)\b|💢|😠|😤|むっ|怒/i],
  ['tease', /\b(hehe+|fufu+|teehee|told you|silly|dummy|gotcha|ehehe+)\b|😏|😜|😝|からかい|ふふ/i],
  ['excited', /\b(yay+|wow+|amazing|awesome|woo+|let'?s go|sugoi|so cool)\b|!{2,}|🎉|🤩|✨✨|すごい|やった/i],
  ['sweet', /\b(love|cute|thank you|thanks|proud of you|hug|daisuki|arigato[u]?|you did it)\b|♡|❤|💕|💖|🥰|ありがと|大好き/i],
  ['happy', /\b(happy|glad|fun|nice|great|good morning|ohayo[u]?|hi+|hello)\b|[!！]|😊|😄|😆|♪|🎵|うれし|たのし/i],
  ['calm', /\b(okay|alright|let me|here'?s|step|first|remember)\b/i],
];

/** Keyword guess of a line's mood. @param {string} text @returns {string} */
function detectMood(text) {
  const t = String(text || '');
  for (const [mood, re] of CUES) if (re.test(t)) return mood;
  return 'normal';
}

/** Style-name fragments per mood, best first (AivisSpeech and VOICEVOX style names are Japanese). */
const STYLE_HINTS = {
  normal: ['ノーマル', 'ふつう', 'ふつー', 'normal'],
  happy: ['喜び', 'うれし', '楽しい', 'たのしい', '上機嫌', 'あまあま', 'ノーマル'],
  excited: ['ハイテンション', 'ハイ', '喜び', '元気', 'ノーマル'],
  sweet: ['あまあま', '甘々', '甘え', 'ささやき', 'セクシー'],
  tease: ['からかい', 'ツンツン', 'ツンデレ', 'いたずら', 'ドヤ', 'セクシー'],
  sad: ['せつなめ', '悲しみ', 'かなしみ', 'なみだめ', '泣き', '落ち込み', 'しょんぼり', 'ヘロヘロ'],
  sleepy: ['ねむたい', '眠', 'ねむ', 'ヘロヘロ', 'ささやき', 'ヒソヒソ', 'おちつき'],
  calm: ['おちつき', '落ち着き', 'クール', 'ふつー', 'ノーマル'],
  angry: ['怒り', 'おこ', 'ツンツン', 'からかい'],
};

/**
 * The style of `speaker` that fits `mood`, or the base style. Pure.
 * @param {Array<{ name: string, id: number }>} styles  the chosen character's styles
 * @param {number} baseId  the style the user picked
 * @param {string} mood
 * @returns {number}
 */
function styleFor(styles, baseId, mood) {
  if (!mood || mood === 'normal') return baseId;
  for (const hint of STYLE_HINTS[mood] || []) {
    const s = styles.find((x) => x.name.toLowerCase().includes(hint.toLowerCase()));
    if (s) return s.id;
  }
  return baseId;
}

/** Small prosody changes per mood (multipliers; pitch is an offset in VOICEVOX units, about ±0.15). */
const PROSODY = {
  normal: { speed: 1, pitch: 0, intonation: 1 },
  happy: { speed: 1.04, pitch: 0.02, intonation: 1.15 },
  excited: { speed: 1.1, pitch: 0.035, intonation: 1.3 },
  sweet: { speed: 0.97, pitch: 0.015, intonation: 1.1 },
  tease: { speed: 1.02, pitch: 0.01, intonation: 1.2 },
  sad: { speed: 0.92, pitch: -0.02, intonation: 0.8 },
  sleepy: { speed: 0.86, pitch: -0.03, intonation: 0.7 },
  calm: { speed: 0.96, pitch: 0, intonation: 0.95 },
  angry: { speed: 1.06, pitch: 0.01, intonation: 1.3 },
};

/** @param {string} mood */
const prosodyFor = (mood) => PROSODY[/** @type {keyof typeof PROSODY} */ (mood)] || PROSODY.normal;

/** Parse the translator's "<mood> | <japanese>" answer. Pure. @param {string | null} s */
function parseDub(s) {
  const m = /^\s*\[?([a-z]+)\]?\s*[|｜:：]\s*([\s\S]+)$/i.exec(String(s || ''));
  if (m && MOODS.includes(m[1].toLowerCase())) return { mood: m[1].toLowerCase(), text: m[2].trim() };
  return { mood: null, text: String(s || '').trim() };
}

module.exports = { MOODS, detectMood, styleFor, prosodyFor, parseDub, STYLE_HINTS };
