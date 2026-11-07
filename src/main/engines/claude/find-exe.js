// @ts-check
// Ported from kero-pet/agent.js — locate the user's installed Claude Code executable.
// Using the installed binary keeps the portable exe small (the SDK's own binary is excluded).
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

/** @returns {string | undefined} */
function findClaudeExecutable() {
  const win = process.platform === 'win32';
  /** @type {string[]} */
  const candidates = [];
  if (process.env.TAMA_CLAUDE_PATH) candidates.push(process.env.TAMA_CLAUDE_PATH);
  try {
    const found = execSync(win ? 'where claude' : 'which claude', { encoding: 'utf8', windowsHide: true })
      .split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    for (const f of found) {
      if (/\.(cmd|ps1)$/i.test(f) || !path.extname(f)) {
        // npm global install: <prefix>\claude.cmd -> <prefix>\node_modules\@anthropic-ai\claude-code\bin\claude.exe
        candidates.push(path.join(path.dirname(f), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', win ? 'claude.exe' : 'claude'));
      }
      candidates.push(f);
    }
  } catch { /* not on PATH */ }
  candidates.push(path.join(os.homedir(), '.local', 'bin', win ? 'claude.exe' : 'claude'));
  const usable = (/** @type {string} */ c) => (win ? /\.exe$/i.test(c) : !/\.(cmd|ps1)$/i.test(c)) && fs.existsSync(c);
  return candidates.find(usable);
}

/** @type {string | undefined | null} null = not looked up yet */
let cached = null;
/** The Claude Code executable, looked up once (SHIP-4: `recheckClaude` after an install). */
const claudeExe = () => (cached === null ? (cached = findClaudeExecutable()) : cached);
/** Look again (e.g. after the setup wizard installed Claude Code). */
const recheckClaude = () => (cached = findClaudeExecutable());

module.exports = { findClaudeExecutable, claudeExe, recheckClaude };
