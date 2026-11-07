// @ts-check
// Crash guard (SET-6, D-050): routes main-process exceptions, renderer and helper-process crashes into the crash
// log, and reloads a window whose renderer crashed (at most 3 times a minute per window) so the pet doesn't vanish.
const { app, shell } = require('electron');

const RELOADS_PER_MIN = 3;

/**
 * @param {{ log: ReturnType<typeof import('./crash-log').createCrashLog>, onProblem?: (what: string) => void }} o
 */
function startCrashGuard({ log, onProblem = () => {} }) {
  /** @type {WeakMap<object, number[]>} */ const reloads = new WeakMap();

  const onException = (/** @type {any} */ e) => { log.write('crash', 'main', e); console.error('[tama] uncaught', e); onProblem('main'); };
  const onRejection = (/** @type {any} */ e) => { log.write('error', 'promise', e instanceof Error ? e : String(e)); console.error('[tama] unhandled rejection', e); };
  process.on('uncaughtException', onException);
  process.on('unhandledRejection', onRejection);

  app.on('render-process-gone', (_e, wc, d) => {
    if (d.reason === 'clean-exit') return;
    const url = String(wc.getURL()).replace(/^.*\/renderer\//, '');
    log.write('crash', 'renderer', `${url} gone: ${d.reason} (exit ${d.exitCode})`);
    onProblem('renderer');
    const now = Date.now();
    const recent = (reloads.get(wc) || []).filter((t) => now - t < 60000);
    if (recent.length >= RELOADS_PER_MIN || wc.isDestroyed()) return;
    reloads.set(wc, [...recent, now]);
    setTimeout(() => { if (!wc.isDestroyed()) wc.reload(); }, 1000);
  });
  app.on('child-process-gone', (_e, d) => {
    if (d.reason === 'clean-exit') return;
    log.write('error', 'child', `${d.type}${d.name ? ` ${d.name}` : ''} gone: ${d.reason} (exit ${d.exitCode})`);
  });

  return () => { process.off('uncaughtException', onException); process.off('unhandledRejection', onRejection); };
}

/** Open the logs folder in Explorer / Finder. @param {string} dir */
const openLogs = (dir) => shell.openPath(dir);

module.exports = { startCrashGuard, openLogs };
