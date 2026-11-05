// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSecrets } = require('.');

/** Fake cipher: reversible but visibly not plaintext. */
const fakeCipher = (available = true) => ({
  available: () => available,
  encrypt: (/** @type {string} */ s) => Buffer.from(Buffer.from(s).toString('base64').split('').reverse().join('')),
  decrypt: (/** @type {Buffer} */ b) => Buffer.from(b.toString().split('').reverse().join(''), 'base64').toString(),
});

test('set/get/delete round-trip and the file is not plaintext', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-sec-'));
  const s = createSecrets(dir, fakeCipher());
  s.set('telegram.token', '123:ABC');
  assert.equal(s.get('telegram.token'), '123:ABC');
  assert.deepEqual(s.keys(), ['telegram.token']);
  assert.ok(!fs.readFileSync(path.join(dir, 'secrets.bin')).toString().includes('123:ABC'));
  s.delete('telegram.token');
  assert.equal(s.get('telegram.token'), null);
});

test('refuses to store when OS encryption is unavailable (never plaintext)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tama-sec-'));
  const s = createSecrets(dir, fakeCipher(false));
  assert.throws(() => s.set('k', 'v'), /refusing to store/);
  assert.equal(fs.existsSync(path.join(dir, 'secrets.bin')), false);
});
