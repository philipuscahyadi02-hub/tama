// @ts-check
// Who is signed in to the agent CLIs, and how to switch (M8, D-040). Tama never reads or stores their tokens (D-006):
// it asks the official CLIs (`claude auth status`) or reads agy's own log line, and switching runs the official sign-in
// in a visible console window.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { claudeExe } = require('./claude');
const { findAgyExecutable, CLI_DIR_NAME } = require('./agy');

/** @returns {Promise<{ loggedIn: boolean, email?: string, plan?: string, org?: string, method?: string, expiresAt?: string, error?: string }>} */
function claudeStatus() {
  return new Promise((resolve) => {
    const exe = claudeExe();
    if (!exe) return resolve({ loggedIn: false, error: 'Claude Code is not installed.' });
    execFile(exe, ['auth', 'status', '--json'], { windowsHide: true, timeout: 20000 }, (err, out) => {
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
    const exe = claudeExe();
    if (!exe) throw new Error('Claude Code is not installed.');
    return [
      '@echo off', 'title Tama - switch Claude account',
      'echo Signing out of Claude Code...', `"${exe}" auth logout`,
      'echo.', 'echo Sign in with the account you want (a browser window opens)...', `"${exe}" auth login`,
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

/**
 * Setup wizard (SHIP-4, D-059): run the vendor's official one-line installer in a visible PowerShell window (the user
 * sees the exact command first), then the official sign-in. Tama never handles their tokens (D-006).
 * @param {'claude'|'agy'} kind
 */
function installScript(kind) {
  const ps = (/** @type {string} */ cmd) => `powershell -NoProfile -ExecutionPolicy Bypass -Command "${cmd}"`;
  if (kind === 'claude') {
    return [
      '@echo off', 'title Tama - install Claude Code',
      'echo Installing Claude Code with Anthropic\'s official installer:', 'echo   irm https://claude.ai/install.ps1 ^| iex', 'echo.',
      ps('irm https://claude.ai/install.ps1 | iex'),
      'echo.', 'echo Now sign in (a browser window opens). Skip with Ctrl+C if you are already signed in.',
      'if exist "%USERPROFILE%\\.local\\bin\\claude.exe" ("%USERPROFILE%\\.local\\bin\\claude.exe" auth login) else (claude auth login)',
      'echo.', 'echo Done! Go back to Tama and press "Check again".', 'pause',
    ];
  }
  return [
    '@echo off', 'title Tama - install the Antigravity CLI (agy)',
    'echo Installing agy with Google\'s official installer:', 'echo   irm https://antigravity.google/cli/install.ps1 ^| iex', 'echo.',
    ps('irm https://antigravity.google/cli/install.ps1 | iex'),
    'echo.', 'echo Now agy starts: follow its sign-in with your Google account, then type /exit.',
    'if exist "%LOCALAPPDATA%\\Antigravity\\agy.exe" ("%LOCALAPPDATA%\\Antigravity\\agy.exe") else if exist "%LOCALAPPDATA%\\agy\\bin\\agy.exe" ("%LOCALAPPDATA%\\agy\\bin\\agy.exe") else (agy)',
    'echo.', 'echo Done! Go back to Tama and press "Check again".', 'pause',
  ];
}

/** First sign-in for an installed CLI (the switch scripts sign out first; this one doesn't). @param {'claude'|'agy'} kind */
function signInScript(kind) {
  if (kind === 'claude') {
    const exe = claudeExe();
    if (!exe) throw new Error('Claude Code is not installed.');
    return ['@echo off', 'title Tama - sign in to Claude Code', 'echo A browser window opens to sign in to Claude...', `"${exe}" auth login`,
      'echo.', 'echo Done! Go back to Tama and press "Check again".', 'pause'];
  }
  const agy = findAgyExecutable();
  if (!agy) throw new Error('agy (Antigravity CLI) is not installed.');
  return ['@echo off', 'title Tama - sign in to agy', 'echo agy starts below: follow its sign-in with your Google account, then type /exit.', 'echo.', `"${agy}"`,
    'echo.', 'echo Done! Go back to Tama and press "Check again".', 'pause'];
}

module.exports = { claudeStatus, geminiStatus, switchScript, installScript, signInScript };
