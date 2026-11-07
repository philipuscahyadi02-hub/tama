// @ts-check
// Read-only git helpers (PROD-2, TG-6; QC-5) against a throwaway repo in the temp folder.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const git = require('./git');

const hasGit = (() => { try { execFileSync('git', ['--version'], { windowsHide: true }); return true; } catch { return false; } })();

test('isRepo, userEmail, recentCommits and diff on a real repo', { skip: !hasGit && 'git not installed' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-git-'));
  const run = (/** @type {string[]} */ a) => execFileSync('git', a, { cwd: dir, windowsHide: true });
  assert.equal(git.isRepo(dir), false);
  assert.deepEqual(await git.recentCommits(dir), []); // not a repo: empty, no throw
  run(['init', '-q']);
  run(['config', 'user.email', 'Me@Example.com']);
  run(['config', 'user.name', 'Me']);
  run(['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\n');
  run(['add', '.']);
  run(['commit', '-q', '-m', 'first\tcommit']);
  assert.equal(git.isRepo(dir), true);
  assert.equal(await git.userEmail(dir), 'me@example.com');
  const [c] = await git.recentCommits(dir);
  assert.equal(c.email, 'me@example.com');
  assert.equal(c.subject, 'first\tcommit');
  assert.match(c.sha, /^[0-9a-f]{40}$/);
  assert.ok(c.time > 0);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'two\n');
  fs.writeFileSync(path.join(dir, 'new.txt'), 'x');
  const d = await git.diff(dir);
  assert.match(d, /-one\n\+two/);
  assert.match(d, /# New files \(not shown\):\n# {3}new\.txt/);
  assert.match(await git.diff(dir, 20), /# … diff truncated$/);
  // read-only: nothing was committed by the helpers
  assert.equal((await git.recentCommits(dir)).length, 1);
});
