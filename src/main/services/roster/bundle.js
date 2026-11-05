// @ts-check
// .tama file format (PORT-5, D-025): one file holding a Tama's folder (+ optionally the user's
// productivity data and connections). gzip'd JSON; with a password it's AES-256-GCM with a scrypt key.
//
// Layout: "TAMA" | version (1 byte) | flags (1 byte: 1 = encrypted) | [salt 16 | iv 12 | tag 16] | payload
const crypto = require('crypto');
const zlib = require('zlib');

const MAGIC = Buffer.from('TAMA');
const VERSION = 1;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const MAX_BYTES = 20 * 1024 * 1024;
/** Only these file shapes may come out of a bundle (no '..', no absolute paths, no odd extensions). */
const SAFE_NAME = /^(?!.*\.\.)[a-z0-9_-]+(\/[a-z0-9_-]+)*\.(json|md|txt)$/i;

/**
 * @typedef {{ format: 'tama-bundle', version: number, exportedAt: number, app: string,
 *   tama: { name: string, files: Record<string, string> },
 *   user?: Record<string, string>, connections?: Record<string, string> }} Bundle
 */

/** @param {Bundle} bundle @param {string} [password] @returns {Buffer} */
function encode(bundle, password) {
  const plain = zlib.gzipSync(Buffer.from(JSON.stringify(bundle), 'utf8'));
  if (!password) {
    if (bundle.connections) throw new Error('Connections can only be exported with a password.');
    return Buffer.concat([MAGIC, Buffer.from([VERSION, 0]), plain]);
  }
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32, SCRYPT);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, Buffer.from([VERSION, 1]), salt, iv, c.getAuthTag(), body]);
}

/** @param {Buffer} buf */
const isEncrypted = (buf) => buf.length > 6 && buf.subarray(0, 4).equals(MAGIC) && buf[5] === 1;

/**
 * @param {Buffer} buf @param {string} [password]
 * @returns {Bundle}
 */
function decode(buf, password) {
  if (buf.length > MAX_BYTES) throw new Error('File is too large to be a Tama.');
  if (buf.length < 6 || !buf.subarray(0, 4).equals(MAGIC)) throw new Error('This is not a .tama file.');
  if (buf[4] !== VERSION) throw new Error(`This .tama file is from a newer app (format ${buf[4]}).`);
  let plain;
  if (buf[5] === 1) {
    if (!password) throw Object.assign(new Error('This Tama is password-protected.'), { code: 'NEED_PASSWORD' });
    const salt = buf.subarray(6, 22);
    const iv = buf.subarray(22, 34);
    const tag = buf.subarray(34, 50);
    const key = crypto.scryptSync(password, salt, 32, SCRYPT);
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
      d.setAuthTag(tag);
      plain = Buffer.concat([d.update(buf.subarray(50)), d.final()]);
    } catch {
      throw Object.assign(new Error('Wrong password, or the file is damaged.'), { code: 'BAD_PASSWORD' });
    }
  } else {
    plain = buf.subarray(6);
  }
  const json = zlib.gunzipSync(plain, { maxOutputLength: MAX_BYTES * 5 }).toString('utf8');
  return validate(JSON.parse(json));
}

/** Structural checks so a crafted file can't write outside its folder or smuggle junk. @param {any} b @returns {Bundle} */
function validate(b) {
  if (!b || b.format !== 'tama-bundle' || typeof b.tama !== 'object' || typeof b.tama.files !== 'object') {
    throw new Error('This .tama file is damaged or not a Tama.');
  }
  /** @param {any} files @param {string} what */
  const check = (files, what) => {
    for (const [name, content] of Object.entries(files || {})) {
      if (!SAFE_NAME.test(name)) throw new Error(`Unsafe file name in ${what}: ${name}`);
      if (typeof content !== 'string') throw new Error(`Bad file content in ${what}: ${name}`);
    }
  };
  check(b.tama.files, 'tama');
  if (!b.tama.files['character.json']) throw new Error('This .tama file has no character.');
  if (b.user) check(b.user, 'user');
  if (b.connections) {
    for (const [k, v] of Object.entries(b.connections)) {
      if (!/^[a-z0-9_.-]{1,64}$/i.test(k) || typeof v !== 'string') throw new Error('Bad connection entry.');
    }
  }
  return b;
}

module.exports = { encode, decode, isEncrypted, validate, SAFE_NAME };
