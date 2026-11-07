// @ts-check
// Fresh PATH (SHIP-4): a tool installed while Tama runs (Claude Code, agy) changes the user's PATH in the registry, but
// this process still has the PATH it started with. Re-read the user and machine PATH so `where claude` finds the new
// tool without restarting Tama. Windows only; elsewhere a no-op.
const { execFileSync } = require('child_process');

/** Read one REG_SZ / REG_EXPAND_SZ value with reg.exe. @param {string} key @param {string} name @returns {string} */
function regValue(key, name) {
  try {
    const out = execFileSync('reg', ['query', key, '/v', name], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    const m = out.match(new RegExp(`\\s${name}\\s+REG_(?:EXPAND_)?SZ\\s+(.*)`, 'i'));
    return m ? m[1].trim() : '';
  } catch { return ''; } // missing value or reg.exe unavailable: nothing to add
}

/** Expand %VAR% references with this process's environment. @param {string} s */
const expand = (s) => s.replace(/%([^%]+)%/g, (all, v) => process.env[v] ?? all);

/**
 * Merge the registry's machine + user PATH into process.env.PATH (new entries first, nothing removed).
 * @returns {boolean} whether anything was added
 */
function refreshPath() {
  if (process.platform !== 'win32') return false;
  const fromReg = [
    regValue('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', 'Path'),
    regValue('HKCU\\Environment', 'Path'),
  ].join(';').split(';').map((p) => expand(p.trim())).filter(Boolean);
  const cur = String(process.env.PATH || '').split(';').filter(Boolean);
  const seen = new Set(cur.map((p) => p.toLowerCase()));
  const added = fromReg.filter((p) => !seen.has(p.toLowerCase()) && (seen.add(p.toLowerCase()), true));
  if (added.length) process.env.PATH = [...cur, ...added].join(';');
  return added.length > 0;
}

module.exports = { refreshPath };
