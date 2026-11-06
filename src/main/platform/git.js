// @ts-check
// Read-only git queries for the commit watcher (PROD-2). Never writes to a repo.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

/** @param {string} cwd @param {string[]} args @returns {Promise<string>} */
function git(cwd, args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 }, (err, out) => {
      if (err) reject(err); else resolve(String(out).trim());
    });
  });
}

/** @param {string} dir */
const isRepo = (dir) => fs.existsSync(path.join(dir, '.git'));

/** The repo's configured author email (repo config, falling back to global). @param {string} repo */
async function userEmail(repo) {
  try { return (await git(repo, ['config', 'user.email'])).toLowerCase(); } catch { return ''; }
}

/**
 * Recent commits on HEAD, newest first.
 * @param {string} repo @param {number} [n]
 * @returns {Promise<Array<{ sha: string, email: string, time: number, subject: string }>>}
 */
async function recentCommits(repo, n = 30) {
  let out;
  try { out = await git(repo, ['log', `-n${n}`, '--format=%H%x09%ae%x09%ct%x09%s']); } catch { return []; }
  return out ? out.split('\n').map((l) => {
    const [sha, email, ct, ...rest] = l.split('\t');
    return { sha, email: (email || '').toLowerCase(), time: Number(ct) * 1000, subject: rest.join('\t') };
  }) : [];
}

/** Paths changed in the working tree ("M src/a.js", "?? new.txt"). @param {string} repo */
async function changedFiles(repo) {
  const out = await git(repo, ['status', '--porcelain', '--untracked-files=normal']);
  return out ? out.split('\n').map((l) => `${l.slice(0, 2).trim()} ${l.slice(3)}`.trim()) : [];
}

/**
 * The working tree's changes vs HEAD as a unified diff, plus untracked file names (read-only; for remote
 * /code results on Telegram, TG-6). Capped at `max` characters.
 * @param {string} repo @param {number} [max]
 */
async function diff(repo, max = 400000) {
  const [tracked, untracked] = await Promise.all([
    git(repo, ['--no-pager', 'diff', 'HEAD', '--no-color']).catch(() => ''),
    git(repo, ['ls-files', '--others', '--exclude-standard']).catch(() => ''),
  ]);
  const extra = untracked ? `\n# New files (not shown):\n${untracked.split('\n').map((f) => `#   ${f}`).join('\n')}\n` : '';
  const text = tracked + extra;
  return text.length > max ? `${text.slice(0, max)}\n# … diff truncated` : text;
}

module.exports = { isRepo, userEmail, recentCommits, changedFiles, diff };
