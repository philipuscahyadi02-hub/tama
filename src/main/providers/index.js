// @ts-check
// Provider layer (SHIP-8, D-054): features ask for a capability, not an engine. Providers (Claude Code, agy, and in v2
// Tama's own agent, D-056) register what they can do; `pick(cap)` returns the user's preferred provider that has the
// capability and is installed and signed in, falling back to the next one. Pure apart from the injected device store.
const { TOPICS } = require('../bus-topics');

/**
 * chat    = talk with her (persona, streaming, hidden markers)      compose = short one-shot lines (moments, diary, dubs)
 * json    = structured output against a schema (the designer)       code    = agentic work in a folder, tools via PermissionGate
 * @typedef {'chat'|'compose'|'json'|'code'} Capability
 */
const CAPS = /** @type {Capability[]} */ (['chat', 'compose', 'json', 'code']);

/** What the user gets when they never chose: D-029's split. */
const DEFAULT_ORDER = /** @type {Record<Capability, string[]>} */ ({
  chat: ['agy', 'claude'], compose: ['agy', 'claude'], json: ['claude', 'agy'], code: ['claude'],
});

/**
 * @typedef {(emit: (ev: any) => void, persona: string) => any} EngineFactory
 * @typedef {{
 *   id: string, name: string, model?: string,
 *   available: () => boolean, recheck?: () => boolean,
 *   optIn?: Capability[],
 *   features?: { webSearch?: boolean, googleTools?: boolean },
 *   chat?: EngineFactory, compose?: EngineFactory, code?: (emit: (ev: any) => void) => any,
 *   json?: (o: any) => Promise<any>,
 * }} Provider
 *   optIn: capabilities this provider only serves when the user allowed it (Claude for chat/moments spends Claude quota).
 *   features: what its chat can do beyond talking (the persona only mentions what is there).
 */

/**
 * @param {{ bus?: import('../bus').BusInstance, device: { get: () => any, patch: (s: string | null, p: any) => void }, providers: Provider[],
 *   refreshEnv?: () => unknown }} deps
 *   refreshEnv: run before a recheck (the bootstrap passes platform/env refreshPath)
 */
function createProviders({ bus, device, providers, refreshEnv }) {
  const byId = new Map(providers.map((p) => [p.id, p]));
  const prefs = () => {
    const p = device.get().providers || {};
    return { order: /** @type {Partial<Record<Capability, string[]>>} */ (p.order || {}), allow: /** @type {string[]} */ (p.allow || []) };
  };
  /** @param {Capability} cap */
  const order = (cap) => {
    const want = (prefs().order[cap] || []).filter((id) => byId.has(id));
    return [...new Set([...want, ...DEFAULT_ORDER[cap], ...providers.map((p) => p.id)])].filter((id) => byId.has(id));
  };
  /** Does this provider serve the capability for this user (offers it, and any opt-in was given)? @param {Provider} p @param {Capability} cap */
  const serves = (p, cap) => !!p[cap] && (!(p.optIn || []).includes(cap) || prefs().allow.includes(`${p.id}:${cap}`));

  /** The provider to use for a capability right now, or null. @param {Capability} cap @returns {Provider | null} */
  function pick(cap) {
    for (const id of order(cap)) {
      const p = /** @type {Provider} */ (byId.get(id));
      if (serves(p, cap) && safe(p.available)) return p;
    }
    return null;
  }

  /** What each capability uses and what else could serve it (for Settings and the setup wizard). */
  function status() {
    const all = providers.map((p) => ({ id: p.id, name: p.name, available: safe(p.available), model: p.model || null }));
    /** @type {Record<string, any>} */ const caps = {};
    for (const cap of CAPS) {
      const chosen = pick(cap);
      caps[cap] = {
        using: chosen ? chosen.id : null,
        options: order(cap).map((id) => /** @type {Provider} */ (byId.get(id))).filter((p) => !!p[cap])
          .map((p) => ({ id: p.id, name: p.name, available: safe(p.available), optIn: (p.optIn || []).includes(cap), allowed: serves(p, cap) })),
      };
    }
    return { providers: all, caps, allow: prefs().allow };
  }

  /**
   * @param {{ prefer?: { cap: string, id: string }, allow?: { cap: string, id: string, on: boolean } }} p
   *   prefer: put this provider first for the capability. allow: opt in/out of an optIn capability.
   */
  function set(p) {
    const cur = prefs();
    const isCap = (/** @type {any} */ c) => CAPS.includes(c);
    if (p && p.prefer && isCap(p.prefer.cap) && byId.has(p.prefer.id)) {
      const cap = /** @type {Capability} */ (p.prefer.cap);
      cur.order = { ...cur.order, [cap]: [p.prefer.id, ...order(cap).filter((id) => id !== p.prefer?.id)] };
    }
    if (p && p.allow && isCap(p.allow.cap) && byId.has(p.allow.id)) {
      const key = `${p.allow.id}:${p.allow.cap}`;
      cur.allow = p.allow.on ? [...new Set([...cur.allow, key])] : cur.allow.filter((k) => k !== key);
    }
    device.patch('providers', { order: cur.order, allow: cur.allow });
    const st = status();
    if (bus) bus.emit(TOPICS.PROVIDERS_CHANGED, st);
    return st;
  }

  /**
   * Look for installed tools again (SHIP-4: after the setup wizard installed one). Emits providers.changed when
   * something appeared or disappeared, so the brain switches over without a restart.
   * @param {() => unknown} [refreshEnv]  e.g. re-read PATH from the registry first
   */
  function recheck(refreshEnv) {
    const before = JSON.stringify(status().providers.map((p) => p.available));
    try { if (refreshEnv) refreshEnv(); } catch { /* a stale PATH only means the old lookup */ }
    for (const p of providers) { try { if (p.recheck) p.recheck(); } catch { /* treated as unavailable by safe() */ } }
    const st = status();
    if (bus && JSON.stringify(st.providers.map((p) => p.available)) !== before) bus.emit(TOPICS.PROVIDERS_CHANGED, st);
    return st;
  }

  function start() {
    if (!bus) return () => {};
    const offs = [
      bus.handle(TOPICS.PROVIDERS_GET, () => status()),
      bus.handle(TOPICS.PROVIDERS_SET, (/** @type {any} */ p) => set(p)),
      bus.handle(TOPICS.PROVIDERS_RECHECK, () => recheck(refreshEnv)),
    ];
    return () => { for (const off of offs) off(); };
  }

  return { pick, status, set, recheck, start, get: (/** @type {string} */ id) => byId.get(id) || null };
}

/** A provider's `available` must never throw into the caller (e.g. a CLI lookup failing). @param {() => boolean} f */
function safe(f) { try { return !!f(); } catch { return false; } } // a failing check means "not available"

/** @typedef {ReturnType<typeof createProviders>} Providers */

module.exports = { createProviders, CAPS, DEFAULT_ORDER };
