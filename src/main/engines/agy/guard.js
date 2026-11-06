// @ts-check
// agy PreToolUse hook (D-037): the HARD read-only lock for Tama's agy sessions. agy's plan mode is only advisory
// (probe 2026-11-06: with a persuasive prompt it wrote files anywhere), so every tool call is checked here and anything
// not on the allow-list is denied. agy runs it from <workspace>/.agent/hooks.json via guard.cmd; if it fails, agy blocks
// the tool (fail-closed, verified). Usage: guard.js <allow-list file>   (file holds one regex; empty = deny everything)

/** @param {string} name @param {string} allow */
function decide(name, allow) {
  const ok = !!allow && !!name && new RegExp(allow).test(name);
  return ok ? { decision: 'allow' } : { decision: 'deny', reason: 'Tama\'s chat brain is read-only: this tool is not allowed (no files, no commands).' };
}

if (require.main === module) {
  let allow = '';
  try { allow = require('fs').readFileSync(process.argv[2] || '', 'utf8').trim(); } catch { /* missing file: deny all */ }
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { input += d; });
  process.stdin.on('end', () => {
    let name = '';
    try { const j = JSON.parse(input || '{}'); name = String((j.toolCall && j.toolCall.name) || ''); } catch { /* deny */ }
    process.stdout.write(JSON.stringify(decide(name, allow)));
  });
}

module.exports = { decide };
