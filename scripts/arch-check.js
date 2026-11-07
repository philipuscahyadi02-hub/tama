// @ts-check
// Architecture check (QC-1, D-052): AGENTS.md §1 rules as code. Runs in `npm run check`; exits 1 on a violation.
//   1. Only src/main/platform/** (and the preload) may require 'electron'.
//   2. No deep imports into another module: outside src/main/<area>/<module>/, only its index.js may be required.
//      The bootstrap (src/main/index.js) wires everything and is exempt, as are tests and dev/ tools.
//   3. Renderers never require anything (no Node in renderers); they only use window.tama.
//   4. Every TOPICS.X used is declared, and every declared topic is used somewhere (unused = dead code).
//   5. Every ipcRenderer channel in the preload has a main-side handler, and vice versa.
// `--report` prints warnings (e.g. files over ~300 lines) without failing.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const rel = (/** @type {string} */ f) => path.relative(ROOT, f).split(path.sep).join('/');

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.js$/.test(e.name) ? [p] : [];
  });
}

const files = walk(SRC);
const isTest = (/** @type {string} */ f) => /\.test\.js$/.test(f);
/** @type {string[]} */ const errors = [];
/** @type {string[]} */ const warnings = [];
const read = (/** @type {string} */ f) => fs.readFileSync(f, 'utf8');
const requires = (/** @type {string} */ src) => [...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);

/** The module folder a file belongs to: src/main/<area>/<module> (services, engines, channels) or src/main/<area>. */
function moduleOf(/** @type {string} */ f) {
  const r = rel(f).split('/');
  if (r[0] !== 'src' || r[1] !== 'main') return rel(path.dirname(f));
  if (['services', 'engines', 'channels'].includes(r[2]) && r.length > 4) return r.slice(0, 4).join('/');
  if (r.length > 3) return r.slice(0, 3).join('/');
  return 'src/main';
}

for (const f of files) {
  const r = rel(f);
  const src = read(f);
  const reqs = requires(src);
  // 1. electron only in platform/ and preload
  if (reqs.includes('electron') && !r.startsWith('src/main/platform/') && !r.startsWith('src/preload/')) errors.push(`${r}: requires 'electron' outside src/main/platform (AGENTS §1.2)`);
  // 3. renderers never require
  if (r.startsWith('src/renderer/') && !isTest(r) && reqs.length) errors.push(`${r}: renderer uses require(${reqs.join(', ')}) (AGENTS §1.3)`);
  // 2. deep imports
  if (r.startsWith('src/main/') && r !== 'src/main/index.js' && !isTest(f) && !r.startsWith('src/main/dev/')) {
    const mine = moduleOf(f);
    for (const q of reqs.filter((x) => x.startsWith('.'))) {
      const target = path.resolve(path.dirname(f), q);
      const t = fs.existsSync(`${target}.js`) ? `${target}.js` : fs.existsSync(path.join(target, 'index.js')) ? path.join(target, 'index.js') : `${target}.js`;
      const tr = rel(t);
      if (!tr.startsWith('src/main/')) continue;
      const theirs = moduleOf(t);
      if (theirs === mine || theirs === 'src/main' || !/^src\/main\/(services|engines|channels)\//.test(theirs)) continue;
      if (path.basename(t) !== 'index.js' || path.dirname(tr) !== theirs) errors.push(`${r}: deep import of ${tr} (use ${theirs}/index.js or the bus, AGENTS §1.4)`);
    }
  }
  // size (report only)
  const lines = src.split('\n').length;
  if (!isTest(f) && lines > 330) warnings.push(`${r}: ${lines} lines (rule of thumb ~300)`);
}

// 4. bus topics
const topicsSrc = read(path.join(SRC, 'main', 'bus-topics.js'));
const declared = [...topicsSrc.matchAll(/^\s+([A-Z][A-Z0-9_]+):\s*'/gm)].map((m) => m[1]);
const used = new Set(files.filter((f) => !f.endsWith('bus-topics.js')).flatMap((f) => [...read(f).matchAll(/TOPICS\.([A-Z][A-Z0-9_]+)/g)].map((m) => m[1])));
for (const t of used) if (!declared.includes(t)) errors.push(`TOPICS.${t} is used but not declared in bus-topics.js (AGENTS §1.5)`);
for (const t of declared) if (!used.has(t)) errors.push(`TOPICS.${t} is declared but never used (dead code, QC-2)`);

// 5. preload ↔ main IPC channels
const preload = read(path.join(SRC, 'preload', 'index.js'));
const asked = new Set([...preload.matchAll(/ipcRenderer\.(?:invoke|send)\(\s*'([^']+)'/g)].map((m) => m[1]));
const mainSrc = files.filter((f) => rel(f).startsWith('src/main/') && !isTest(f)).map(read).join('\n');
const handled = new Set([...mainSrc.matchAll(/ipc(?:Main)?\.(?:handle|on|once|onFromWindow)\(\s*'([^']+)'/g)].map((m) => m[1]));
for (const c of asked) if (!handled.has(c)) errors.push(`preload channel '${c}' has no main-side handler`);
for (const c of handled) if (!asked.has(c)) errors.push(`main handles '${c}' but the preload never sends it (dead code, QC-2)`);

const report = process.argv.includes('--report');
if (report || errors.length) for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`arch-check: ${files.length} files, ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exitCode = errors.length ? 1 : 0;
