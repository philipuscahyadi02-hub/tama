// @ts-check
// The only module that touches secrets.bin (AGENTS.md rule 9).
// Values are encrypted as one blob with an OS-backed cipher (Electron safeStorage = DPAPI on Windows).
// If encryption isn't available we refuse to store, rather than fall back to plaintext.
const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} Cipher
 * @property {() => boolean} available
 * @property {(plain: string) => Buffer} encrypt
 * @property {(blob: Buffer) => string} decrypt
 */

/**
 * @param {string} rootDir @param {Cipher} cipher
 */
function createSecrets(rootDir, cipher) {
  const file = path.join(rootDir, 'secrets.bin');

  /** @returns {Record<string, string>} */
  function load() {
    let blob;
    try { blob = fs.readFileSync(file); } catch { return {}; }
    if (!cipher.available()) throw new Error('secrets: OS encryption unavailable');
    return JSON.parse(cipher.decrypt(blob));
  }

  /** @param {Record<string, string>} all */
  function save(all) {
    if (!cipher.available()) throw new Error('secrets: OS encryption unavailable; refusing to store in plaintext');
    fs.mkdirSync(rootDir, { recursive: true });
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, cipher.encrypt(JSON.stringify(all)));
    fs.renameSync(tmp, file);
  }

  return {
    /** @param {string} key */
    get: (key) => load()[key] ?? null,
    /** @param {string} key */
    has: (key) => key in load(),
    /** @param {string} key @param {string} value */
    set(key, value) { const all = load(); all[key] = value; save(all); },
    /** @param {string} key */
    delete(key) { const all = load(); delete all[key]; save(all); },
    /** Key names only, never values (safe to log). */
    keys: () => Object.keys(load()),
  };
}

/** Cipher backed by Electron safeStorage. Loaded lazily so tests don't need Electron. */
function electronCipher() {
  const { safeStorage } = require('electron');
  return {
    available: () => safeStorage.isEncryptionAvailable(),
    /** @param {string} s */ encrypt: (s) => safeStorage.encryptString(s),
    /** @param {Buffer} b */ decrypt: (b) => safeStorage.decryptString(b),
  };
}

module.exports = { createSecrets, electronCipher };
