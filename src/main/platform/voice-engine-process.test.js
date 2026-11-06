// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createVoiceEngineProcess } = require('./voice-engine-process');

test('engine leftover cleanup: never kills a process that is not run.exe; stale pid files are removed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-vep-'));
  const pidFile = path.join(dir, 'voice-engine.pid');
  const p = createVoiceEngineProcess({ pidFile, exePath: () => path.join(dir, 'missing.exe') });
  assert.equal(p.cleanupStale(), false); // no file
  fs.writeFileSync(pidFile, String(process.pid)); // this test's node.exe, not an engine
  assert.equal(p.cleanupStale(), false);
  assert.equal(fs.existsSync(pidFile), false);
  fs.writeFileSync(pidFile, 'garbage');
  assert.equal(p.cleanupStale(), false);
  assert.equal(p.owned(), false);
});
