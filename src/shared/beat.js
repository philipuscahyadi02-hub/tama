// @ts-check
// Beat tracker for DJ Tama (MUS-4): pure, so it runs in the pet window and in Node tests.
// Feed it the low-frequency (kick/bass) energy of the PC's audio about every 20 ms; it finds onsets (sudden rises),
// estimates the tempo from the gaps between them (folded into 70–180 BPM), and runs a beat clock that onsets nudge
// back into phase. Nothing is stored beyond the last few seconds of numbers.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.TamaShared = root.TamaShared || {}).beat = factory();
}(globalThis, function () {
  const MIN_PERIOD = 60 / 180;
  const MAX_PERIOD = 60 / 70;

  /** Fold an interval (seconds) into the 70–180 BPM range by doubling or halving. @param {number} d */
  function fold(d) {
    if (!(d > 0)) return 0;
    while (d < MIN_PERIOD) d *= 2;
    while (d > MAX_PERIOD) d /= 2;
    return d;
  }

  /**
   * The most common beat period among onset gaps (seconds), or 0 with too few onsets. Pure.
   * @param {number[]} onsets  times in seconds, ascending
   */
  function estimatePeriod(onsets) {
    if (onsets.length < 4) return 0;
    /** @type {Map<number, number>} */ const hist = new Map();
    for (let i = 0; i < onsets.length; i++) {
      for (let j = i + 1; j < onsets.length && onsets[j] - onsets[i] < 2.2; j++) {
        const p = fold(onsets[j] - onsets[i]);
        if (!p) continue;
        const bin = Math.round(p * 100); // 10 ms bins
        for (let k = -2; k <= 2; k++) hist.set(bin + k, (hist.get(bin + k) || 0) + (k === 0 ? 1 : k * k === 1 ? 0.6 : 0.2) / (j - i));
      }
    }
    let best = 0; let score = 0;
    for (const [bin, s] of hist) if (s > score) { score = s; best = bin; }
    return best / 100;
  }

  /** @param {{ onBeat?: (n: number) => void }} [opts] */
  function createBeatTracker(opts = {}) {
    const flux = /** @type {number[]} */ ([]);
    const energies = /** @type {number[]} */ ([]);
    let onsets = /** @type {number[]} */ ([]);
    let prev = 0;
    let lastOnset = -1;
    let period = 0;
    let nextBeat = 0;
    let count = 0;

    /**
     * One sample. @param {number} energy 0..1 @param {number} t seconds
     * @returns {{ beat: boolean, onset: boolean, bpm: number, quiet: boolean }}
     */
    function feed(energy, t) {
      const e = Math.max(0, Math.min(1, Number(energy) || 0));
      const f = Math.max(0, e - prev);
      prev = e;
      flux.push(f); if (flux.length > 75) flux.shift();          // ~1.5 s of flux
      energies.push(e); if (energies.length > 100) energies.shift(); // ~2 s of energy
      const quiet = energies.length >= 50 && energies.reduce((a, b) => a + b, 0) / energies.length < 0.02;

      let onset = false;
      if (!quiet && flux.length >= 20) {
        const mean = flux.reduce((a, b) => a + b, 0) / flux.length;
        const sd = Math.sqrt(flux.reduce((a, b) => a + (b - mean) ** 2, 0) / flux.length);
        if (f > mean + 1.5 * sd && f > 0.03 && t - lastOnset > 0.28) {
          onset = true;
          lastOnset = t;
          onsets.push(t);
          onsets = onsets.filter((x) => t - x < 10);
          const p = estimatePeriod(onsets);
          if (p) period = period ? period * 0.7 + p * 0.3 : p;
          if (period) {
            if (!nextBeat) nextBeat = t + period;
            else {
              // Pull the beat clock towards this onset when it lands near a predicted beat.
              const sincePrev = (t - (nextBeat - period)) / period;
              const err = sincePrev < 0.5 ? t - (nextBeat - period) : t - nextBeat;
              if (Math.abs(err) < 0.2 * period) nextBeat += err * 0.35;
            }
          }
        }
      }

      let beat = false;
      if (period && nextBeat && !quiet) {
        if (t >= nextBeat) {
          beat = true;
          count += 1;
          nextBeat += period;
          if (t > nextBeat) nextBeat = t + period; // fell behind (a pause): start again from now
          if (opts.onBeat) opts.onBeat(count);
        }
      } else if (quiet) nextBeat = 0;
      return { beat, onset, bpm: period ? Math.round(60 / period) : 0, quiet };
    }

    return { feed, bpm: () => (period ? Math.round(60 / period) : 0) };
  }

  return { createBeatTracker, estimatePeriod, fold };
}));
