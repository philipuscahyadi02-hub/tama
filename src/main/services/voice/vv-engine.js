// @ts-check
// AivisSpeech / VOICEVOX local engines (VOICE-1, D-022, D-042). Both speak the same HTTP API on localhost:
// GET /version, GET /speakers, POST /audio_query?text&speaker, POST /synthesis?speaker → WAV. No internet involved.

const ENGINES = [
  { id: 'aivis', name: 'AivisSpeech', base: 'http://127.0.0.1:10101' },
  { id: 'voicevox', name: 'VOICEVOX', base: 'http://127.0.0.1:50021' },
];

/**
 * @typedef {{ id: string, name: string, base: string, version: string, speakers: Array<{ name: string, styles: Array<{ name: string, id: number }> }> }} Engine
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
        const speakers = sp.ok ? /** @type {any[]} */ (await sp.json()).map((s) => ({ name: s.name, styles: (s.styles || []).map((/** @type {any} */ st) => ({ name: st.name, id: st.id })) })) : [];
        return { ...e, version: String(await v.text()).replace(/"/g, ''), speakers };
      } catch { return null; }
    }));
    return /** @type {Engine[]} */ (found.filter(Boolean));
  }

  /**
   * @param {Engine} engine @param {string} text @param {number} speaker
   * @param {{ speed?: number, pitch?: number, intonation?: number }} [o]  speed/intonation 1 = normal; pitch 1 = normal
   * @returns {Promise<Buffer>} WAV
   */
  async function synthesize(engine, text, speaker, o = {}) {
    const q = await req(`${engine.base}/audio_query?${new URLSearchParams({ text, speaker: String(speaker) })}`, { method: 'POST' }, 20000);
    if (!q.ok) throw new Error(`${engine.name}: audio_query ${q.status}`);
    const query = /** @type {any} */ (await q.json());
    if (o.speed) query.speedScale = Math.max(0.5, Math.min(2, o.speed));
    // VOICEVOX pitchScale is an offset around 0 (about ±0.15); map 0.5..2 to that range.
    if (o.pitch) query.pitchScale = Math.max(-0.15, Math.min(0.15, (o.pitch - 1) * 0.15));
    if (o.intonation) query.intonationScale = Math.max(0, Math.min(2, o.intonation));
    const s = await req(`${engine.base}/synthesis?speaker=${speaker}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(query) }, 60000);
    if (!s.ok) throw new Error(`${engine.name}: synthesis ${s.status}`);
    return Buffer.from(await s.arrayBuffer());
  }

  return { detect, synthesize, ENGINES };
}

module.exports = { createVvEngines, ENGINES };
