// @ts-check
// npm run dev: start Tama with a scratch data folder (<repo>/.dev-data) so a dev run never touches your real
// Tamas in %APPDATA%\Tama, and can run next to an installed Tama (own Electron profile, D-028).
// Usage: npm run dev [-- --fresh] [-- --data <dir>]   --fresh wipes the folder first (a brand-new first run).
// Any TAMA_* debug variable you set (see AGENTS.md §6) is passed through.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const arg = (/** @type {string} */ k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const data = path.resolve(arg('--data') || path.join(ROOT, '.dev-data'));

if (process.argv.includes('--fresh')) fs.rmSync(data, { recursive: true, force: true });
fs.mkdirSync(data, { recursive: true });

/** @type {string} */
let electron;
try {
  electron = /** @type {string} */ (/** @type {unknown} */ (require('electron')));
} catch {
  console.error('Electron is not ready. Run `npm run setup` first.');
  process.exit(1);
}

console.log(`Tama dev run, data: ${data}`);
const child = spawn(electron, ['.'], {
  cwd: ROOT,
  env: { TAMA_NO_LEGACY: '1', ...process.env, TAMA_DATA_DIR: data },
  stdio: 'inherit',
});
child.on('exit', (code) => { process.exitCode = code ?? 0; });
