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
  if (win && process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, 'agy', 'bin', 'agy.exe'));
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

module.exports = { findAgyExecutable, ensureTamaAgySettings, CLI_DIR_NAME, TAMA_AGY_SETTINGS };
