// @ts-check
// Regenerates the "Commit history" block in CHANGELOG.md from git log, grouped by v* tags.
// Usage: npm run changelog
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'CHANGELOG.md');
const START = '<!-- commit-history:start -->';
const END = '<!-- commit-history:end -->';

/** @param {string[]} args */
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

/** @param {string} range */
function commits(range) {
  const out = git(['log', '--no-merges', '--date=short', '--format=%h%x09%ad%x09%s', range]);
  return out ? out.split('\n').map((l) => l.split('\t')) : [];
}

/** @param {string} s */
const esc = (s) => s.replace(/\|/g, '\\|');

/** @param {string} title @param {string[][]} rows */
function table(title, rows) {
  if (!rows.length) return `### ${title}\n_No commits._\n`;
  const body = rows.map(([h, d, s]) => {
    const m = /^(\w+)(\(([^)]+)\))?!?:\s*(.*)$/.exec(s);
    const type = m ? m[1] + (m[3] ? `(${m[3]})` : '') : '—';
    return `| \`${h}\` | ${d} | ${type} | ${esc(m ? m[4] : s)} |`;
  });
  return `### ${title}\n| Commit | Date | Type | Subject |\n|---|---|---|---|\n${body.join('\n')}\n`;
}

function build() {
  const tags = git(['tag', '--list', 'v*', '--sort=creatordate']).split('\n').filter(Boolean);
  const sections = [];
  const head = tags.length ? `${tags[tags.length - 1]}..HEAD` : 'HEAD';
  sections.push(table('Unreleased', commits(head)));
  for (let i = tags.length - 1; i >= 0; i--) {
    const range = i === 0 ? tags[i] : `${tags[i - 1]}..${tags[i]}`;
    sections.push(table(tags[i], commits(range)));
  }
  return sections.join('\n');
}

const text = fs.readFileSync(FILE, 'utf8');
const a = text.indexOf(START);
const b = text.indexOf(END);
if (a < 0 || b < a) throw new Error('CHANGELOG.md is missing the commit-history markers');
const next = `${text.slice(0, a + START.length)}\n${build()}${text.slice(b)}`;
fs.writeFileSync(FILE, next);
console.log('CHANGELOG.md commit history updated.');
