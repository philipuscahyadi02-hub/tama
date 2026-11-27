// @ts-check
// Which model agy runs for Tama (D-086): the user picks any model their Antigravity account lists (`agy models`),
// one for the chat and one for her moments, diary and dubs (`compose`). Empty = Tama's default (Gemini Flash, low thinking).
const { execFile } = require('child_process');

const DEFAULT_MODEL = 'gemini-3.8-flash-low';
/** A model id as agy prints it, e.g. gemini-4-hydrogen-high, claude-opus-4-6-thinking. */
const MODEL_ID = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const CACHE_MS = 10 * 60 * 1000;

/** Pure: `agy models` output → [{ id, name }]. Lines are "id<TAB>name"; anything else is skipped. @param {string} text */
function parseAgyModels(text) {
  /** @type {{ id: string, name: string }[]} */
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const [id, ...rest] = line.split('\t');
    const name = rest.join('\t').trim();
    if (!name || !MODEL_ID.test(id.trim()) || out.some((m) => m.id === id.trim())) continue;
    out.push({ id: id.trim(), name: name.slice(0, 80) });
  }
  return out;
}

/** Pure: the picked model for a capability ('' or a bad id = the default). @param {any} picks { chat?, compose? } @param {'chat'|'compose'} cap */
function agyModelFor(picks, cap) {
  const v = String((picks && picks[cap]) || '');
  return MODEL_ID.test(v) ? v : '';
}

/** Ask agy which models this account has. Cached 10 minutes; [] when agy is missing or fails. */
function createModelList() {
  /** @type {{ at: number, list: { id: string, name: string }[] } | null} */
  let cache = null;
  /** @param {string | undefined} exe @param {boolean} [fresh] */
  function list(exe, fresh = false) {
    if (!exe) return Promise.resolve([]);
    if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.list);
    return new Promise((resolve) => {
      execFile(exe, ['models'], { timeout: 60000, windowsHide: true, maxBuffer: 1 << 20 }, (err, stdout) => {
        const models = err ? [] : parseAgyModels(String(stdout));
        if (models.length) cache = { at: Date.now(), list: models };
        resolve(models.length ? models : (cache ? cache.list : []));
      });
    });
  }
  /** The last list, without asking agy (for picking a fallback model synchronously). */
  list.known = () => (cache ? cache.list.map((m) => m.id) : []);
  return list;
}

module.exports = { parseAgyModels, agyModelFor, createModelList, DEFAULT_MODEL, MODEL_ID };
