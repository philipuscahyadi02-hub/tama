// @ts-check
// Performance probe (QC-3, D-053): with TAMA_PERF=<seconds>, measure start-up, then idle CPU and memory of every
// Tama process (main, renderers, GPU) and the main event-loop lag, print one JSON line and quit. Dev only.
const { app } = require('electron');
const { monitorEventLoopDelay } = require('perf_hooks');

/**
 * @param {{ seconds: number, startedAt: number, quit: () => void, extra?: () => Record<string, unknown> }} o
 */
function runPerfProbe({ seconds, startedAt, quit, extra = () => ({}) }) {
  const readyMs = Date.now() - startedAt;
  const lag = monitorEventLoopDelay({ resolution: 20 });
  // Let start-up settle (icon render, engine detection, first ticks) before measuring idle.
  setTimeout(() => {
    lag.enable();
    app.getAppMetrics(); // prime: CPU % is measured since the previous call
    const samples = /** @type {Array<{ cpu: number, mem: number, byType: Record<string, number> }>} */ ([]);
    const tick = setInterval(() => {
      const ms = app.getAppMetrics();
      /** @type {Record<string, number>} */ const byType = {};
      for (const m of ms) byType[m.type] = (byType[m.type] || 0) + m.cpu.percentCPUUsage;
      samples.push({ cpu: ms.reduce((a, m) => a + m.cpu.percentCPUUsage, 0), mem: ms.reduce((a, m) => a + (m.memory.privateBytes || m.memory.workingSetSize), 0), byType });
    }, 1000);
    setTimeout(() => {
      clearInterval(tick);
      lag.disable();
      const avg = (/** @type {number[]} */ xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      const types = [...new Set(samples.flatMap((s) => Object.keys(s.byType)))];
      const out = {
        readyMs, idleSeconds: seconds,
        cpuAvg: +avg(samples.map((s) => s.cpu)).toFixed(2), cpuMax: +Math.max(...samples.map((s) => s.cpu)).toFixed(2),
        cpuByType: Object.fromEntries(types.map((t) => [t, +avg(samples.map((s) => s.byType[t] || 0)).toFixed(2)])),
        memMB: Math.round(avg(samples.map((s) => s.mem)) / 1024), // privateBytes is in KB
        loopLagMs: { mean: +(lag.mean / 1e6).toFixed(1), p99: +(lag.percentile(99) / 1e6).toFixed(1), max: +(lag.max / 1e6).toFixed(1) },
        processes: app.getAppMetrics().length,
        ...extra(),
      };
      console.log(`[perf] ${JSON.stringify(out)}`);
      quit();
    }, seconds * 1000);
  }, 15000);
}

/**
 * Dev (QC-3): report timer and interval callbacks that block the main process for more than `ms`, with where they
 * were scheduled. Call before services start. @param {number} [ms]
 */
function traceSlowCallbacks(ms = 40) {
  /** @type {Map<string, { n: number, max: number }>} */ const slow = new Map();
  const wrap = (/** @type {any} */ orig) => (/** @type {any} */ fn, /** @type {any[]} */ ...rest) => {
    if (typeof fn !== 'function') return orig(fn, ...rest);
    const where = String(new Error().stack).split('\n').slice(2, 4).map((l) => l.trim().replace(/^at /, '').replace(/\(.*[\\/]src[\\/]/, '(')).join(' < ');
    return orig(function (/** @type {any[]} */ ...a) {
      const t = performance.now();
      try { return fn(...a); } finally {
        const d = performance.now() - t;
        if (d > ms) { const s = slow.get(where) || { n: 0, max: 0 }; s.n++; s.max = Math.max(s.max, d); slow.set(where, s); }
      }
    }, ...rest);
  };
  global.setTimeout = /** @type {any} */ (wrap(setTimeout));
  global.setInterval = /** @type {any} */ (wrap(setInterval));
  return () => [...slow.entries()].sort((a, b) => b[1].max - a[1].max).slice(0, 10).map(([w, s]) => ({ where: w, count: s.n, maxMs: Math.round(s.max) }));
}

/** Dev (QC-3): per-channel IPC counts and time, fed by platform/ipc's probe. */
function ipcStats() {
  /** @type {Map<string, { n: number, total: number, max: number }>} */ const m = new Map();
  return {
    /** @param {string} channel @param {number} ms */
    add(channel, ms) { const s = m.get(channel) || { n: 0, total: 0, max: 0 }; s.n++; s.total += ms; s.max = Math.max(s.max, ms); m.set(channel, s); },
    top: () => [...m.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8)
      .map(([c, s]) => ({ channel: c, calls: s.n, totalMs: Math.round(s.total), maxMs: Math.round(s.max) })),
    reset: () => m.clear(),
  };
}

module.exports = { runPerfProbe, traceSlowCallbacks, ipcStats };
