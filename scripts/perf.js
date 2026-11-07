// @ts-check
// npm run perf (QC-3, D-053): start Tama in a scratch data folder, let it settle, measure idle CPU / memory /
// event-loop lag for N seconds (default 30), print the result and compare it with NFR-1 (idle CPU < 2 %, RAM < 300 MB).
// The pet is shown (small, never takes focus) because hidden windows are throttled and would hide the real cost.
// Usage: npm run perf [-- --seconds 60] [-- --data <dir>]
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const arg = (/** @type {string} */ k, /** @type {string} */ d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const seconds = Number(arg('--seconds', '30')) || 30;
const data = arg('--data', fs.mkdtempSync(path.join(os.tmpdir(), 'tama-perf-')));
const electron = /** @type {string} */ (/** @type {unknown} */ (require('electron')));

const child = spawn(electron, ['.'], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, TAMA_DATA_DIR: data, TAMA_PERF: String(seconds), TAMA_SHOT_OFFSCREEN: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let out = '';
child.stdout.on('data', (b) => { out += b; });
child.stderr.on('data', (b) => { out += b; });
const kill = setTimeout(() => { console.error('perf: timed out'); child.kill(); }, (seconds + 90) * 1000);
child.on('exit', () => {
  clearTimeout(kill);
  const line = out.split('\n').find((l) => l.startsWith('[perf] '));
  if (!line) { console.error('perf: no result\n', out.slice(-2000)); process.exitCode = 1; return; }
  const r = JSON.parse(line.slice(7));
  console.log(JSON.stringify(r, null, 2));
  const ok = (/** @type {boolean} */ b) => (b ? 'ok' : 'OVER');
  console.log(`NFR-1 idle CPU ${r.cpuAvg}% (< 2%: ${ok(r.cpuAvg < 2)}), memory ${r.memMB} MB (< 300 MB: ${ok(r.memMB < 300)}), ready in ${r.readyMs} ms`);
});
