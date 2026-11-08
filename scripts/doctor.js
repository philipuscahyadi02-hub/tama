// @ts-check
// npm run doctor: check a developer machine for everything Tama needs, and say what to do next.
// `--fix` also downloads Electron's binary when npm skipped its install script (npm 11 "allow-scripts").
// `npm run setup` = npm install + this with --fix. Nothing here changes the user's tools, logins or saves.
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const fix = process.argv.includes('--fix');
const win = process.platform === 'win32';

/** @typedef {{ name: string, ok: boolean, required: boolean, info: string, next?: string }} Check */
/** @type {Check[]} */
const checks = [];
const add = (/** @type {Check} */ c) => checks.push(c);

/** Run a command and return its first output line, or '' if it fails. @param {string} cmd @param {string[]} args */
function firstLine(cmd, args) {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', windowsHide: true, timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split(/\r?\n/).map((s) => s.trim()).find(Boolean) || '';
  } catch { return ''; }
}

// Node 22+ (package.json "engines").
const major = Number(process.versions.node.split('.')[0]);
add({
  name: 'Node.js 22+', required: true, ok: major >= 22, info: `v${process.versions.node}`,
  next: 'Install Node.js 22 LTS or newer from https://nodejs.org (or `nvm use`, see .nvmrc).',
});

// Dependencies installed.
const hasModules = fs.existsSync(path.join(ROOT, 'node_modules', '@anthropic-ai', 'claude-agent-sdk'));
add({ name: 'npm dependencies', required: true, ok: hasModules, info: hasModules ? 'installed' : 'missing', next: 'Run `npm install` (or `npm run setup`).' });

// Electron's binary: npm 11 can block its install script, which leaves the package without the app.
const electronDir = path.join(ROOT, 'node_modules', 'electron');
const electronOk = () => {
  try {
    const p = fs.readFileSync(path.join(electronDir, 'path.txt'), 'utf8').trim();
    return fs.existsSync(path.join(electronDir, 'dist', p));
  } catch { return false; }
};
if (hasModules && !electronOk() && fix && fs.existsSync(path.join(electronDir, 'install.js'))) {
  console.log('Electron binary missing: downloading it (node node_modules/electron/install.js)…');
  spawnSync(process.execPath, [path.join(electronDir, 'install.js')], { cwd: ROOT, stdio: 'inherit' });
}
add({
  name: 'Electron binary', required: true, ok: electronOk(), info: electronOk() ? 'ready' : 'not downloaded',
  next: 'Run `npm run setup`, or `node node_modules/electron/install.js`.',
});

// Git identity (commits are conventional and authored by you; see CONTRIBUTING.md).
const gitName = firstLine('git', ['config', 'user.name']);
add({
  name: 'git user.name / email', required: false, ok: !!gitName && !!firstLine('git', ['config', 'user.email']),
  info: gitName || 'not set', next: 'git config --global user.name "Your Name" && git config --global user.email you@example.com',
});

// The AI tools (each optional: Tama runs without them, with fewer features). Found the same way the app finds them.
if (hasModules) {
  const { claudeExe } = require('../src/main/engines/claude');
  const { findAgyExecutable } = require('../src/main/engines/agy');
  const claude = claudeExe();
  add({
    name: 'Claude Code (terminal, coding)', required: false, ok: !!claude,
    info: claude ? `${claude}${firstLine(claude, ['--version']) ? ` (${firstLine(claude, ['--version'])})` : ''}` : 'not found',
    next: win ? 'PowerShell: `irm https://claude.ai/install.ps1 | iex`, then run `claude` once to sign in.' : 'curl -fsSL https://claude.ai/install.sh | bash, then run `claude` once to sign in.',
  });
  const agy = findAgyExecutable();
  add({
    name: 'Antigravity CLI agy (chat, moments)', required: false, ok: !!agy, info: agy || 'not found',
    next: win ? 'PowerShell: `irm https://antigravity.google/cli/install.ps1 | iex`, then run `agy` once to sign in. Or let Claude chat: Settings → Brains.' : 'See https://antigravity.google (or let Claude chat: Settings → Brains).',
  });
  if (win) {
    const { ENGINE_DEFS } = require('../src/main/platform/voice-engine-process');
    const found = Object.entries(ENGINE_DEFS).filter(([, d]) => d.paths().some((p) => fs.existsSync(p))).map(([id]) => id);
    add({
      name: 'Japanese voice engine', required: false, ok: found.length > 0, info: found.length ? found.join(', ') : 'none (English Windows voice only)',
      next: 'AivisSpeech Engine or VOICEVOX Engine (only for the Japanese dub); the in-app setup wizard (/setup) shows how.',
    });
  }
}

// Report.
const mark = (/** @type {Check} */ c) => (c.ok ? '✔' : c.required ? '✘' : '○');
console.log('\nTama doctor\n');
for (const c of checks) console.log(`  ${mark(c)} ${c.name.padEnd(38)} ${c.info}`);
const todo = checks.filter((c) => !c.ok && c.next);
if (todo.length) {
  console.log('\nNext steps:');
  for (const c of todo) console.log(`  ${c.required ? '[required]' : '[optional]'} ${c.name}: ${c.next}`);
}
const blocked = checks.some((c) => c.required && !c.ok);
console.log(blocked ? '\nNot ready yet: fix the [required] items above.\n' : '\nReady. Start a safe dev run with `npm run dev` (uses .dev-data/, never your real saves).\n');
process.exitCode = blocked ? 1 : 0;
