// @ts-check
// Who is signed in to the agent CLIs, and how to switch (M8, D-040). Tama never reads or stores their tokens (D-006):
// it asks the official CLIs (`claude auth status`) or reads agy's own log line, and switching runs the official sign-in
// in a visible console window.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { CLAUDE_EXE } = require('./claude/session');
const { findAgyExecutable, CLI_DIR_NAME } = require('./agy/setup');

/** @returns {Promise<{ loggedIn: boolean, email?: string, plan?: string, org?: string, method?: string, expiresAt?: string, error?: string }>} */
function claudeStatus() {
  return new Promise((resolve) => {
    if (!CLAUDE_EXE) return resolve({ loggedIn: false, error: 'Claude Code is not installed.' });
    execFile(CLAUDE_EXE, ['auth', 'status', '--json'], { windowsHide: true, timeout: 20000 }, (err, out) => {
      try {
        const j = JSON.parse(String(out || '{}'));
        resolve({ loggedIn: !!j.loggedIn, email: j.email, plan: j.subscriptionType, org: j.orgName, method: j.authMethod, expiresAt: j.loginExpiresAt });
      } catch { resolve({ loggedIn: false, error: err ? String(err.message).slice(0, 200) : 'Could not read the Claude login status.' }); }
    });
  });
}

/**
 * The Google account agy last signed in with, from agy's own logs (Tama's tama-acp sessions first, then the user's CLI).
 * @param {string} [home] @returns {{ email: string | null, method: string | null, seenAt: number | null }}
 */
function geminiStatus(home = os.homedir()) {
  const dirs = [path.join(home, '.gemini', 'antigravity-cli', CLI_DIR_NAME, 'log'), path.join(home, '.gemini', 'antigravity-cli', 'log')];
  /** @type {Array<{ file: string, at: number }>} */ const files = [];
  for (const d of dirs) {
    let names = [];
    try { names = fs.readdirSync(d); } catch { continue; }
    for (const n of names) if (/\.log$/.test(n)) { const f = path.join(d, n); try { files.push({ file: f, at: fs.statSync(f).mtimeMs }); } catch { /* gone */ } }
  }
  files.sort((a, b) => b.at - a.at);
  for (const { file, at } of files.slice(0, 12)) {
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const all = [...text.matchAll(/applyAuthResult: email=([^\s,]+), authMethod=([^\s,]+)/g)];
    const m = all[all.length - 1] || [...text.matchAll(/authenticated successfully as (\S+)/g)].pop();
    if (m) return { email: m[1], method: m[2] || null, seenAt: at };
  }
  return { email: null, method: null, seenAt: null };
}

/** The console scripts that switch accounts with the official tools. @param {'claude'|'gemini'} kind */
function switchScript(kind) {
  if (kind === 'claude') {
    if (!CLAUDE_EXE) throw new Error('Claude Code is not installed.');
    return [
      '@echo off', 'title Tama - switch Claude account',
      'echo Signing out of Claude Code...', `"${CLAUDE_EXE}" auth logout`,
      'echo.', 'echo Sign in with the account you want (a browser window opens)...', `"${CLAUDE_EXE}" auth login`,
      'echo.', 'echo Done! Close this window and press Refresh in Tama.', 'pause',
    ];
  }
  const agy = findAgyExecutable();
  if (!agy) throw new Error('agy (Antigravity CLI) is not installed.');
  return [
    '@echo off', 'title Tama - switch Gemini (agy) account',
    'echo In agy below: type /logout and press Enter, then sign in with the Google account you want, then type /exit.',
    'echo Note: this is the same sign-in your own agy CLI uses.', 'echo.', `"${agy}"`,
    'echo.', 'echo Done! Close this window and press Refresh in Tama.', 'pause',
  ];
}

module.exports = { claudeStatus, geminiStatus, switchScript };
