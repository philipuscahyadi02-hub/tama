// @ts-check
// npm run coverage (QC-5): run the tests with Node's built-in coverage and summarize line coverage per layer, listing
// files under a threshold and main-process files no test loads at all. No extra dependency (lcov from node:test).
// Usage: npm run coverage [-- --min 80]
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const min = Number(process.argv[process.argv.indexOf('--min') + 1]) || 80;
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tama-cov-')), 'lcov.info');
const r = spawnSync(process.execPath, ['--test', '--experimental-test-coverage', '--test-timeout=30000',
  '--test-coverage-exclude=**/*.test.js', '--test-coverage-exclude=node_modules/**',
  '--test-reporter=lcov', `--test-reporter-destination=${out}`, '--test-reporter=dot', '--test-reporter-destination=stdout'],
{ cwd: root, encoding: 'utf8', env: { ...process.env, TAMA_NO_LEGACY: '1' } });
if (r.status !== 0) { console.error(r.stdout, r.stderr); console.error('coverage: tests failed'); process.exit(1); }

/** @type {Map<string, { found: number, hit: number }>} */
const files = new Map();
let cur = '';
for (const line of fs.readFileSync(out, 'utf8').split('\n')) {
  if (line.startsWith('SF:')) { cur = path.relative(root, line.slice(3)).replace(/\\/g, '/'); files.set(cur, { found: 0, hit: 0 }); }
  const f = files.get(cur);
  if (f && line.startsWith('LF:')) f.found = Number(line.slice(3));
  if (f && line.startsWith('LH:')) f.hit = Number(line.slice(3));
}

const walk = (/** @type {string} */ d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : /\.js$/.test(e.name) && !/\.test\.js$/.test(e.name) ? [path.relative(root, p).replace(/\\/g, '/')] : [];
});
const layer = (/** @type {string} */ f) => (f.match(/^src\/(main\/(services|engines|brain|platform|channels|dev)|main|shared|renderer|preload)/) || [, 'other'])[1];
/** @type {Record<string, { found: number, hit: number, files: number, untested: string[], low: string[] }>} */
const sum = {};
for (const f of walk(path.join(root, 'src'))) {
  const L = layer(f);
  const s = (sum[L] = sum[L] || { found: 0, hit: 0, files: 0, untested: [], low: [] });
  const c = files.get(f);
  if (!c) { s.untested.push(f); continue; }
  s.found += c.found; s.hit += c.hit; s.files++;
  const pct = (100 * c.hit) / Math.max(1, c.found);
  if (pct < min) s.low.push(`${f} ${pct.toFixed(0)}%`);
}
console.log(`\nLine coverage per layer (files loaded by tests; threshold ${min} %):`);
for (const [L, s] of Object.entries(sum).sort()) {
  const pct = s.found ? ((100 * s.hit) / s.found).toFixed(1) : '-';
  console.log(`  ${L.padEnd(16)} ${String(pct).padStart(5)} %  (${s.files} files tested, ${s.untested.length} not loaded by any test)`);
  for (const l of s.low) console.log(`      low       ${l}`);
  if (/^main/.test(L)) for (const u of s.untested) console.log(`      untested  ${u}`);
}
