// @ts-check
// English labels for voice characters and styles (D-046): from assets/voice/names.json, else a kana → romaji
// fallback so new voices are still readable. Pure.
const NAMES = require('../../../../assets/voice/names.json');

const KANA = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to', な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no', は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo', や: 'ya', ゆ: 'yu', よ: 'yo', ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo', だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo', ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po', ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
};
const YOON = { ゃ: 'ya', ゅ: 'yu', ょ: 'yo' };

/** Hiragana/katakana → romaji; other characters are kept. @param {string} s */
function romaji(s) {
  // Katakana → hiragana first (same table).
  const h = String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  let out = '';
  for (let i = 0; i < h.length; i++) {
    const c = h[i];
    const next = h[i + 1];
    if (c === 'ー') { out += out.slice(-1); continue; }
    if (c === 'っ' && next && KANA[next]) { out += KANA[next][0]; continue; }
    if (KANA[c] && next && YOON[next]) { out += KANA[c].replace(/i$/, '') + (/(shi|chi|ji)$/.test(KANA[c]) ? YOON[next].slice(1) : YOON[next]); i++; continue; }
    out += KANA[c] || c;
  }
  return out.replace(/(^|\s)([a-z])/g, (m, a, b) => a + b.toUpperCase());
}

/** @param {string} name */
const characterEn = (name) => NAMES.characters[name] || (/[぀-ヿ]/.test(name) && !/[一-鿿]/.test(name) ? romaji(name) : '');
/** @param {string} name */
const styleEn = (name) => NAMES.styles[name] || (/[぀-ヿ]/.test(name) && !/[一-鿿]/.test(name) ? romaji(name) : '');

module.exports = { characterEn, styleEn, romaji };
