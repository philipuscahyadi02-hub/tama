// @ts-check
// Windows built-in speech (SAPI via System.Speech) → WAV bytes (VOICE-1 fallback, D-042). Offline, always available on
// Windows. Chromium's speechSynthesis has no voices inside Electron, so the app uses this instead.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

/** @param {string} s */
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** @param {string} script */
const encoded = (script) => Buffer.from(script, 'utf16le').toString('base64');

/** @param {string} script @returns {Promise<string>} */
function ps(script) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded(script)],
      { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 }, (err, out, errOut) => (err ? reject(new Error(String(errOut || err.message).slice(0, 300))) : resolve(String(out))));
  });
}

/** @returns {Promise<Array<{ name: string, culture: string, gender: string }>>} */
async function listVoices() {
  if (process.platform !== 'win32') return [];
  const out = await ps(`Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object { $_.VoiceInfo.Name + '|' + $_.VoiceInfo.Culture + '|' + $_.VoiceInfo.Gender }
$s.Dispose()`).catch(() => '');
  return out.split(/\r?\n/).filter(Boolean).map((l) => { const [name, culture, gender] = l.split('|'); return { name, culture, gender: String(gender).toLowerCase() }; });
}

/**
 * @param {string} text
 * @param {{ voiceName?: string | null, gender?: 'female'|'male'|'neutral', pitch?: number, rate?: number }} [o]  pitch/rate: 1 = normal
 * @returns {Promise<Buffer>} WAV
 */
async function synthesize(text, o = {}) {
  if (process.platform !== 'win32') throw new Error('Built-in speech is only available on Windows.');
  const file = path.join(os.tmpdir(), `tama-tts-${process.pid}-${Date.now().toString(36)}.wav`);
  const pct = (/** @type {number | undefined} */ v, lo, hi) => `${Math.round((Math.max(lo, Math.min(hi, v || 1)) - 1) * 100) >= 0 ? '+' : ''}${Math.round((Math.max(lo, Math.min(hi, v || 1)) - 1) * 100)}%`;
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><prosody pitch="${pct(o.pitch, 0.5, 2)}" rate="${pct(o.rate, 0.5, 2)}">${xml(text)}</prosody></speak>`;
  const gender = o.gender === 'male' ? 'Male' : o.gender === 'female' ? 'Female' : 'NotSet';
  const script = `Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$name = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(o.voiceName || '').toString('base64')}'))
try { if ($name) { $s.SelectVoice($name) } else { $s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::${gender}) } } catch {}
$s.SetOutputToWaveFile('${file.replace(/'/g, "''")}')
$s.SpeakSsml([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(ssml).toString('base64')}')))
$s.Dispose()`;
  try {
    await ps(script);
    return fs.readFileSync(file);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

module.exports = { synthesize, listVoices };
