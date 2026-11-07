// @ts-check
// Find the agy CLI and keep Tama's own agy settings folder correct (D-026).
// Tama never edits the user's ~/.gemini/antigravity-cli/settings.json; it uses --cli_dir_name tama-acp.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const CLI_DIR_NAME = 'tama-acp';
/** Exactly this. `toolPermission: request-review` makes agy ask before shell commands. Do not add agentMode
 *  ("default" is invalid and makes agy ignore the whole file). */
const TAMA_AGY_SETTINGS = { toolPermission: 'request-review' };

/** @returns {string | undefined} */
function findAgyExecutable() {
  const win = process.platform === 'win32';
  /** @type {string[]} */
  const candidates = [];
  if (process.env.TAMA_AGY_PATH) candidates.push(process.env.TAMA_AGY_PATH);
  try {
    for (const f of execSync(win ? 'where agy' : 'which agy', { encoding: 'utf8', windowsHide: true }).split(/\r?\n/)) {
      if (f.trim()) candidates.push(f.trim());
    }
  } catch { /* not on PATH */ }
  if (win && process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'agy', 'bin', 'agy.exe'));
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Antigravity', 'agy.exe')); // where the official CLI install script puts it
  }
  return candidates.find((c) => (win ? /\.exe$/i.test(c) : true) && fs.existsSync(c));
}

/** Write Tama's agy settings if missing or different. Returns the file path. @param {string} [home] */
function ensureTamaAgySettings(home = os.homedir()) {
  const dir = path.join(home, '.gemini', 'antigravity-cli', CLI_DIR_NAME);
  const file = path.join(dir, 'settings.json');
  const want = `${JSON.stringify(TAMA_AGY_SETTINGS, null, 2)}\n`;
  let have = '';
  try { have = fs.readFileSync(file, 'utf8'); } catch { /* missing */ }
  if (have !== want) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, want);
  }
  return file;
}

/** A path without spaces (Windows 8.3 short name when needed); throws if that's impossible, so the guard fails closed. @param {string} p */
function noSpaces(p) {
  if (!/\s/.test(p)) return p;
  if (process.platform !== 'win32') return p.replace(/ /g, '\\ ');
  const out = execSync(`cmd /d /c for %I in ("${p}") do @echo %~sI`, { encoding: 'utf8', windowsHide: true }).trim();
  if (!out || /\s/.test(out)) throw new Error(`Can't get a space-free path for ${p} (8.3 names disabled?)`);
  return out;
}

/** Tools Tama's chat brain may use (D-037): its own MCP tools (server "tama"), web search, reading web pages. */
const CHAT_ALLOW = '^(mcp_tama_[a-z0-9_]+|search_web|read_url_content)$';
/** Events/diary composer: no tools at all. */
const DENY_ALL = '';

/**
 * Install the hard read-only lock in an agy working folder (D-037): <dir>/.agent/hooks.json runs guard.cmd before
 * every tool call; guard.js denies anything not matching `allow`. agy blocks the tool if the hook fails (fail-closed).
 * Only ever used on Tama's own scratch folders, never on a user's project.
 * @param {string} dir @param {string} allow  regex of allowed tool names ('' = deny all)
 * @param {{ exe?: string, script?: string }} [o]  the JS runtime (Electron in node mode, or node) and guard.js path
 */
function ensureWorkspaceGuard(dir, allow, o = {}) {
  const exe = o.exe || process.execPath;
  const script = (o.script || path.join(__dirname, 'guard.js')).replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
  const agentDir = path.join(dir, '.agent');
  fs.mkdirSync(agentDir, { recursive: true });
  // The allow-list lives in a file (cmd.exe would mangle ^ and | in an argument); the launcher passes its path.
  fs.writeFileSync(path.join(agentDir, 'guard-allow.txt'), allow);
  const cmd = process.platform === 'win32'
    ? `@set ELECTRON_RUN_AS_NODE=1\r\n@"${exe}" "${script}" "%~dp0guard-allow.txt"\r\n`
    : `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec "${exe}" "${script}" "$(dirname "$0")/guard-allow.txt"\n`;
  const launcher = path.join(agentDir, process.platform === 'win32' ? 'guard.cmd' : 'guard.sh');
  fs.writeFileSync(launcher, cmd, { mode: 0o755 });
  // Absolute launcher path, unquoted: agy does not run hooks from the hooks.json folder, and it escapes quotes so cmd.exe
  // can't parse a quoted path (both verified). Paths with spaces use the 8.3 short form instead.
  const hooks = { 'tama-readonly-guard': { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: noSpaces(launcher), timeout: 10 }] }] } };
  fs.writeFileSync(path.join(agentDir, 'hooks.json'), `${JSON.stringify(hooks, null, 2)}\n`);
  return path.join(agentDir, 'hooks.json');
}

module.exports = { findAgyExecutable, ensureTamaAgySettings, ensureWorkspaceGuard, CLI_DIR_NAME, TAMA_AGY_SETTINGS, CHAT_ALLOW, DENY_ALL };
