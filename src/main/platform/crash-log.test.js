// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCrashLog, redact } = require('./crash-log');

test('crash log: secrets are redacted (SET-6)', () => {
  assert.equal(redact('bot 123456789:AAHxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxy failed'), 'bot <telegram-token> failed');
  assert.equal(redact('places failed for AIzaSyA1b2C3d4E5f6G7h8I9j0KlMnOpQrStUvW'), 'places failed for <google-api-key>');
  assert.equal(redact('refresh 1//0gAbCdEfGhIjKlMnOpQrStUvWxYz rejected'), 'refresh <google-refresh-token> rejected');
  assert.equal(redact('Authorization: Bearer abcdefghijklmnop123'), 'Authorization: Bearer <redacted>');
  assert.equal(redact('refresh_token=1//0gAbCdEfGhIjKlMnOp'), 'refresh_token=<redacted>');
  assert.equal(redact('got ya29.a0Abc_def-123 back'), 'got <google-token> back');
  assert.equal(redact('client GOCSPX-abc_DEF-123'), 'client <google-secret>');
  assert.equal(redact('plain error: ENOENT open x.json'), 'plain error: ENOENT open x.json');
});

test('crash log: a run that did not quit cleanly is reported once at the next start; old logs are pruned (SET-6)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-log-'));
  let t = Date.parse('2026-11-07T10:00:00Z');
  const log = createCrashLog({ dir, now: () => t });
  assert.equal(log.begin({ version: '0.9.0' }), null); // first run
  log.write('error', 'voice', new Error('engine went away'));
  // crash: no end() … next start
  t += 3600000;
  const again = createCrashLog({ dir, now: () => t });
  const last = again.begin();
  assert.equal(last && last.version, '0.9.0');
  again.end();
  assert.equal(createCrashLog({ dir, now: () => t }).begin(), null); // clean quit → nothing to report
  const text = fs.readFileSync(path.join(dir, 'tama-2026-11-07.log'), 'utf8');
  assert.match(text, /ERROR \[voice\] engine went away/);
  assert.match(text, /CRASH \[app\] the last run/);
  fs.writeFileSync(path.join(dir, 'tama-2026-10-01.log'), 'old');
  createCrashLog({ dir, now: () => t }).prune();
  assert.equal(fs.existsSync(path.join(dir, 'tama-2026-10-01.log')), false);
  assert.equal(fs.existsSync(path.join(dir, 'tama-2026-11-07.log')), true);
});
