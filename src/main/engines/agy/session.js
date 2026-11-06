// @ts-check
// AgyEngine (ENG-2/3, D-026): drives `agy acp` over the Agent Client Protocol. One process per session.
// Implements the Engine contract (ARCHITECTURE §5). Every permission request goes through the PermissionGate.
const { spawn } = require('child_process');
const { createAcpClient } = require('../acp/client');
const { mapAcpUpdate, pickOption } = require('./map-update');
const { findAgyExecutable, ensureTamaAgySettings, ensureWorkspaceGuard, CLI_DIR_NAME } = require('./setup');

/** Terminal mode names (Claude style) → agy ACP mode ids. */
const MODE_MAP = { default: 'default', acceptEdits: 'accept-edits', plan: 'plan' };

/** @typedef {(ev: {t: string, [k: string]: any}) => void} Emit */

class AgyEngine {
  /**
   * @param {Emit} emit
   * @param {{
   *   role: 'lite'|'worker',
   *   gate: import('../../brain/permission-gate').PermissionGate,
   *   persona?: string,
   *   model?: string | null,
   *   thoughtLevel?: 'low'|'medium'|'high',
   *   mode?: 'default'|'acceptEdits'|'plan',
   *   lockMode?: boolean,
   *   spawnAgent?: (cwd: string) => any,
   *   mcpServers?: () => any[],
   *   guard?: string | null,
   *   prepare?: () => void,
   * }} opts
   */
  constructor(emit, opts) {
    this.emit = emit;
    this.role = opts.role;
    this.gate = opts.gate;
    this.persona = opts.persona || '';
    /** @type {string | null} */ this.model = opts.model || null;
    this.thoughtLevel = opts.thoughtLevel || null;
    this.spawnAgent = opts.spawnAgent || defaultSpawn;
    this.prepare = opts.prepare || (() => { ensureTamaAgySettings(); });
    /** MCP servers (ACP stdio entries) for new sessions, e.g. Tama's Google tools relay (D-037). */
    this.mcpServers = opts.mcpServers || (() => []);
    /** Allow-list regex for the hard read-only hook in the working folder ('' = no tools); null = no guard (D-037). */
    this.guard = opts.guard === undefined ? null : opts.guard;
    /** @type {string | null} */ this.cwd = null;
    /** @type {string} */
    this.mode = opts.mode || 'default';
    /** Locked engines ignore mode changes (D-027: agy always runs in read-only plan mode). */
    /** @type {string | null} */
    this.lockedMode = opts.lockMode ? this.mode : null;
    /** @type {string | null} */ this.sessionId = null;
    /** @type {import('../acp/client').AcpClient | null} */ this.client = null;
    this.busy = false;
    this.totalCost = 0;
    this.tokensToday = 0;
    /** @type {string[]} */ this.commands = [];
    /** @type {Promise<void> | null} */ this.starting = null;
    this.ctx = { textOpen: false, text: '' };
  }

  /** @param {string} dir */
  setCwd(dir) { this.stop(); this.cwd = dir; }

  /** @param {string} persona  applies from the next session */
  setPersona(persona) { if (persona !== this.persona) { this.persona = persona; this.stop(); } }

  /** @param {string} mode */
  async setMode(mode) {
    if (this.lockedMode) mode = this.lockedMode;
    this.mode = mode;
    if (this.client && this.sessionId) {
      try { await this.client.request('session/set_mode', { sessionId: this.sessionId, modeId: MODE_MAP[/** @type {keyof typeof MODE_MAP} */ (mode)] || 'default' }); } catch (e) { this.emitError(e); }
    }
    this.emit({ t: 'mode', mode });
  }

  /** @param {string | null} model */
  async setModel(model) {
    this.model = model || null;
    if (this.client && this.sessionId && this.model) {
      try { await this.client.request('session/set_model', { sessionId: this.sessionId, modelId: this.model }); } catch (e) { this.emitError(e); }
    }
    this.emit({ t: 'model', model: this.model });
  }

  async start() {
    if (!this.cwd) throw new Error('agy needs a working folder.');
    this.prepare();
    if (this.guard !== null) ensureWorkspaceGuard(this.cwd, this.guard);
    const child = this.spawnAgent(this.cwd);
    const client = createAcpClient(child, { requestTimeoutMs: 0 });
    this.client = client;
    client.onNotification('session/update', (p) => {
      if (client !== this.client || !p || p.sessionId !== this.sessionId) return;
      for (const ev of mapAcpUpdate(p.update, this.ctx)) {
        if (ev.t === 'commands') this.commands = ev.commands; else this.emit(ev);
      }
    });
    client.onRequest('session/request_permission', async (p) => {
      const tc = (p && p.toolCall) || {};
      const d = await this.gate.request({
        engine: 'agy', role: this.role, sessionKey: this.sessionId || '',
        tool: { name: tc.name || tc.title || 'tool', title: tc.title, kind: tc.kind, input: tc.args || tc.rawInput },
      });
      const optionId = pickOption(p.options, d.choice);
      return optionId ? { outcome: { outcome: 'selected', optionId } } : { outcome: { outcome: 'cancelled' } };
    });
    client.onClose((err) => {
      if (client !== this.client) return;
      this.client = null; this.sessionId = null;
      if (err) this.emitError(err);
      if (this.busy) this.setBusy(false);
    });
    await client.request('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } }, 60000);
    /** @type {any} */
    const params = { cwd: this.cwd, mcpServers: this.mcpServers() };
    if (this.persona) params._meta = { antigravity: { systemPrompt: { append: this.persona } } };
    const s = await client.request('session/new', params, 60000);
    this.sessionId = s.sessionId;
    this.emit({ t: 'session', sessionId: s.sessionId });
    const tier = s._meta && s._meta.antigravity && s._meta.antigravity.tier;
    this.emit({ t: 'init', model: s.models && s.models.currentModelId, cwd: this.cwd, mode: this.mode, commands: this.commands, version: 'agy', tier: tier && tier.name });
    if (this.model) await client.request('session/set_model', { sessionId: s.sessionId, modelId: this.model }).catch(() => null);
    if (this.thoughtLevel) await client.request('session/set_config_option', { sessionId: s.sessionId, configId: 'thought_level', value: this.thoughtLevel }).catch(() => null);
    if (this.mode !== 'default') await this.setMode(this.mode);
  }

  /** @param {string} text */
  async send(text) {
    if (!this.cwd) return this.emit({ t: 'error', message: 'No project folder yet. Use /cd to pick one.' });
    if (this.busy) return this.emit({ t: 'info', text: '⎿  still working on the last message…' });
    this.setBusy(true);
    try {
      if (!this.client) {
        this.starting = this.starting || this.start();
        try { await this.starting; } finally { this.starting = null; }
      }
      this.ctx = { textOpen: false, text: '' };
      const t0 = Date.now();
      const client = /** @type {import('../acp/client').AcpClient} */ (this.client);
      const r = await client.request('session/prompt', { sessionId: this.sessionId, prompt: [{ type: 'text', text }] });
      if (this.ctx.textOpen) { this.ctx.textOpen = false; this.emit({ t: 'text-end' }); }
      const tokens = (r && r.usage && r.usage.totalTokens) || 0;
      this.tokensToday += tokens;
      this.emit({
        t: 'result', isError: r && r.stopReason === 'refusal', subtype: r && r.stopReason, text: this.ctx.text,
        cost: 0, tokens, totalCost: 0, durationMs: Date.now() - t0, model: this.model || undefined,
      });
    } catch (e) {
      this.emitError(e);
      this.emit({ t: 'result', isError: true, subtype: 'error', text: String(/** @type {Error} */ (e).message || e), cost: 0 });
    } finally {
      this.setBusy(false);
    }
  }

  /** @param {boolean} b */
  setBusy(b) { this.busy = b; this.emit({ t: 'status', state: b ? 'thinking' : 'idle' }); }

  async interrupt() {
    this.gate.cancelAll('agy', 'The user interrupted.');
    if (this.client && this.sessionId) this.client.notify('session/cancel', { sessionId: this.sessionId });
  }

  stop() {
    this.gate.cancelAll('agy', 'Session closed.');
    if (this.client) { const c = this.client; this.client = null; c.close(); }
    if (this.sessionId) this.gate.resetSession('agy', this.sessionId);
    this.sessionId = null;
    if (this.busy) this.setBusy(false);
  }

  /** @param {unknown} e */
  emitError(e) { this.emit({ t: 'error', message: `agy: ${String((e && /** @type {any} */ (e).message) || e)}` }); }
}

/** @param {string} cwd */
function defaultSpawn(cwd) {
  const exe = findAgyExecutable();
  if (!exe) throw new Error('agy (Antigravity CLI) was not found. Install it and log in, or set TAMA_AGY_PATH.');
  return spawn(exe, ['acp', '--cli_dir_name', CLI_DIR_NAME], { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
}

module.exports = { AgyEngine, MODE_MAP };
