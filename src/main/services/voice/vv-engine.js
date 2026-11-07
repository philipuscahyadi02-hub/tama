// @ts-check
// AivisSpeech / VOICEVOX local engines (VOICE-1, D-022, D-042). Both speak the same HTTP API on localhost:
// GET /version, GET /speakers, POST /audio_query?text&speaker, POST /synthesis?speaker → WAV. No internet involved.

const ENGINES = [
  { id: 'aivis', name: 'AivisSpeech', base: 'http://127.0.0.1:10101' },
  { id: 'voicevox', name: 'VOICEVOX', base: 'http://127.0.0.1:50021' },
];

/**
 * @typedef {{ id: string, name: string, base: string, version: string, speakers: Array<{ name: string, uuid: string, styles: Array<{ name: string, id: number }> }> }} Engine
 */

/** @param {{ fetch?: typeof fetch, timeoutMs?: number }} [deps] */
function createVvEngines({ fetch: f = fetch, timeoutMs = 2500 } = {}) {
  /** @param {string} url @param {RequestInit} [init] @param {number} [ms] */
  async function req(url, init = {}, ms = timeoutMs) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try { return await f(url, { ...init, signal: ac.signal }); } finally { clearTimeout(t); }
  }

  /** Which engines are running right now (quietly empty when none). @returns {Promise<Engine[]>} */
  async function detect() {
    const found = await Promise.all(ENGINES.map(async (e) => {
      try {
        const v = await req(`${e.base}/version`);
        if (!v.ok) return null;
        const sp = await req(`${e.base}/speakers`);
        const speakers = sp.ok ? /** @type {any[]} */ (await sp.json()).map((s) => ({
          name: s.name, uuid: s.speaker_uuid, styles: (s.styles || []).filter((/** @type {any} */ st) => !st.type || /talk/.test(st.type)) /* talk, streaming_talk; not singing */.map((/** @type {any} */ st) => ({ name: st.name, id: st.id })),
        })) : [];
        return { ...e, version: String(await v.text()).replace(/"/g, ''), speakers };
      } catch { return null; }
    }));
    return /** @type {Engine[]} */ (found.filter(Boolean));
  }

  /**
   * @param {Engine} engine @param {string} text @param {number} speaker  style id
   * @param {{ speedScale?: number, pitchScale?: number, intonationScale?: number, volumeScale?: number }} [o]
   *   VOICEVOX units: speed/intonation/volume 1 = normal; pitch is an offset around 0 (about ±0.15)
   * @returns {Promise<Buffer>} WAV
   */
  async function synthesize(engine, text, speaker, o = {}) {
    const q = await req(`${engine.base}/audio_query?${new URLSearchParams({ text, speaker: String(speaker) })}`, { method: 'POST' }, 20000);
    if (!q.ok) throw new Error(`${engine.name}: audio_query ${q.status}`);
    const query = /** @type {any} */ (await q.json());
    const clamp = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => Math.max(lo, Math.min(hi, v));
    if (typeof o.speedScale === 'number') query.speedScale = clamp(o.speedScale, 0.5, 2);
    if (typeof o.pitchScale === 'number') query.pitchScale = clamp(o.pitchScale, -0.15, 0.15);
    if (typeof o.intonationScale === 'number') query.intonationScale = clamp(o.intonationScale, 0, 2);
    if (typeof o.volumeScale === 'number') query.volumeScale = clamp(o.volumeScale, 0, 2);
    const s = await req(`${engine.base}/synthesis?speaker=${speaker}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(query) }, 60000);
    if (!s.ok) throw new Error(`${engine.name}: synthesis ${s.status}`);
    return Buffer.from(await s.arrayBuffer());
  }

  /**
   * A character's portrait and terms of use (both engines serve /speaker_info). @param {Engine} engine @param {string} uuid
   * @returns {Promise<{ policy: string, portrait: string | null } | null>} portrait = data URL
   */
  async function speakerInfo(engine, uuid) {
    const r = await req(`${engine.base}/speaker_info?${new URLSearchParams({ speaker_uuid: uuid })}`, {}, 15000).catch(() => null);
    if (!r || !r.ok) return null;
    const j = /** @type {any} */ (await r.json());
    const img = String(j.portrait || '');
    const portrait = !img ? null : img.startsWith('data:') ? img : /^[A-Za-z0-9+/=]+$/.test(img.slice(0, 64)) ? `data:image/png;base64,${img}` : null;
    return { policy: String(j.policy || '').slice(0, 6000), portrait };
  }

  return { detect, synthesize, speakerInfo, ENGINES };
}

module.exports = { createVvEngines, ENGINES };
