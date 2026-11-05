// @ts-check
// Whole-file read/write for user-chosen paths (e.g. .tama export/import). Paths come from OS dialogs.
const fs = require('fs');
const path = require('path');

/** @param {string} p */
const readBuffer = (p) => fs.readFileSync(p);

/** Atomic write. @param {string} p @param {Buffer} buf */
function writeBuffer(p, buf) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, p);
}

module.exports = { readBuffer, writeBuffer };
