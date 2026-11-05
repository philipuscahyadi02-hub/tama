// @ts-check
// Ported from kero-pet/agent.js — ClaudeCodeEngine (ENG-1): a long-lived Claude Code session via
// the Claude Agent SDK. Emits normalized EngineEvents (ARCHITECTURE §5) through `emit`.
const path = require('path');
const { pathToFileURL } = require('url');
const { InputQueue } = require('./input-queue');
const { findClaudeExecutable } = require('./find-exe');
const { mapSdkMessage } = require('./map-message');

// In the packaged app the SDK lives in app.asar.unpacked (see "asarUnpack" in package.json).
const APP_ROOT = path.join(__dirname, '..', '..', '..', '..');
const SDK_URL = pathToFileURL(
  path.join(APP_ROOT, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'sdk.mjs')
    .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`),
).href;

const CLAUDE_EXE = findClaudeExecutable();

// Persona rule BRAIN-5: cute in chat, never in code / commits / files. Name comes from the Tama.
/** @param {string} name */
const persona = (name) =>
  `You are running inside "Tama", a desktop app where a chibi anime character named ${name} is the ` +
  'face of the assistant. Work exactly as you normally would as Claude Code. You may add a light ' +
  'touch of cute flavor in short conversational replies, but never in code, commit messages, or file contents.';

/** @typedef {(ev: {t: string, [k: string]: any}) => void} Emit */

/**
 * Profiles: 'worker' = full Claude Code (tools, CLAUDE.md, permissions via the gate);
 * 'lite' = Tama's chat brain fallback (D-027): Haiku, no tools, no user settings, not saved, persona prompt.
 * @typedef {{ role?: 'worker'|'lite', tamaName?: string, gate?: import('../../brain/permission-gate').PermissionGate | null,
 *   persona?: string, model?: string | null }} ClaudeOpts
 */

class ClaudeCodeEngine {
  /** @param {Emit} emit @param {ClaudeOpts} [opts] */
  constructor(emit, opts = {}) {
    this.emit = emit;
    this.role = opts.role || 'worker';
    this.gate = opts.gate || null;
    this.persona = opts.persona || '';
    this.tamaName = opts.tamaName || 'Tama';
    /** @type {string | null} */ this.cwd = null;
    this.mode = 'default';
    /** @type {string | null} */ this.model = opts.model || null; // null = Claude Code's default
    /** @type {string | null} */ this.sessionId = null;
    /** @type {any} */ this.q = null;
    /** @type {InstanceType<typeof InputQueue> | null} */ this.input = null;
    this.busy = false;
    this.totalCost = 0;
    this.baseCost = 0;
    this.procCost = 0;
    this.turnStart = 0;
    /** @type {any[]} */ this.commands = [];
  }

  /** @param {string} dir */
  setCwd(dir) {
    this.stop();
    this.cwd = dir;
    this.sessionId = null;
    this.totalCost = 0;
  }

  /** @param {string} mode */
  async setMode(mode) {
    this.mode = mode;
    if (this.q) { try { await this.q.setPermissionMode(mode); } catch (e) { this.emitError(e); } }
    this.emit({ t: 'mode', mode });
  }

  /** Lite profile: new persona applies from the next session. @param {string} persona */
  setPersona(persona) { if (persona !== this.persona) { this.persona = persona; this.stop(); this.sessionId = null; } }

  /** @param {string | null} model */
  async setModel(model) {
    this.model = model || null;
    if (this.q) { try { await this.q.setModel(this.model || undefined); } catch (e) { this.emitError(e); } }
    this.emit({ t: 'model', model: this.model });
  }

  /** Start (or resume) the underlying Claude Code process. @param {string | null} [resumeId] */
  async start(resumeId) {
    const { query } = await import(SDK_URL);
    this.input = new InputQueue();
    this.baseCost = this.totalCost;
    this.procCost = 0;
    /** @type {Record<string, any>} */
    const options = this.role === 'lite'
      ? {
        cwd: this.cwd, includePartialMessages: true, model: this.model || 'haiku',
        systemPrompt: this.persona, tools: [], settingSources: [], persistSession: false,
      }
      : {
        cwd: this.cwd,
        includePartialMessages: true,
        permissionMode: this.mode,
        systemPrompt: { type: 'preset', preset: 'claude_code', append: persona(this.tamaName) },
        canUseTool: (/** @type {string} */ name, /** @type {any} */ input, /** @type {any} */ o) => this.askPermission(name, input, o),
      };
    if (CLAUDE_EXE) options.pathToClaudeCodeExecutable = CLAUDE_EXE;
    if (this.model && this.role !== 'lite') options.model = this.model;
    if (resumeId && this.role !== 'lite') options.resume = resumeId;
    this.q = query({ prompt: this.input, options });
    this.loop(this.q);
  }

  /** @param {string} text */
  async send(text) {
    if (!this.cwd) return this.emit({ t: 'error', message: 'No project folder yet. Use /cd to pick one.' });
    if (!this.q) await this.start(this.sessionId);
    /** @type {InstanceType<typeof InputQueue>} */ (this.input).push({
      type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null, origin: { kind: 'human' },
    });
    if (!this.busy) this.setBusy(true);
  }

  /** @param {string} id */
  async resume(id) {
    this.stop();
    this.sessionId = id;
    await this.start(id);
    this.emit({ t: 'info', text: `Resumed session ${id.slice(0, 8)}…` });
  }

  /** @param {boolean} b */
  setBusy(b) {
    this.busy = b;
    if (b) this.turnStart = Date.now();
    this.emit({ t: 'status', state: b ? 'thinking' : 'idle' });
  }

  async interrupt() {
    if (this.gate) this.gate.cancelAll('claude', 'The user interrupted.');
    if (this.q && this.busy) { try { await this.q.interrupt(); } catch { /* already stopped */ } }
  }

  stop() {
    if (this.gate && this.role === 'worker') this.gate.cancelAll('claude', 'Session closed.');
    if (this.input) this.input.close();
    if (this.q) { try { this.q.close(); } catch { /* already closed */ } }
    this.q = null; this.input = null;
    if (this.busy) this.setBusy(false);
  }

  /**
   * Claude Code asks before a tool → PermissionGate (SAFE-1) → SDK answer.
   * @param {string} name @param {any} input @param {any} opts
   */
  async askPermission(name, input, opts) {
    if (!this.gate) return { behavior: 'deny', message: 'No permission gate configured.' };
    const d = await this.gate.request({
      engine: 'claude', role: this.role === 'lite' ? 'lite' : 'worker', sessionKey: this.sessionId || '',
      tool: { name, input, reason: opts && opts.decisionReason },
    });
    if (d.choice === 'yes') return { behavior: 'allow', updatedInput: input };
    if (d.choice === 'always') return { behavior: 'allow', updatedInput: input, updatedPermissions: (opts && opts.suggestions) || [] };
    return {
      behavior: 'deny',
      message: d.feedback ? `The user said no and gave this instruction: ${d.feedback}` : 'The user denied this action. Wait for their instructions.',
      interrupt: !d.feedback,
    };
  }

  /** @param {any} q */
  async loop(q) {
    const ctx = { textOpen: false };
    try {
      for await (const m of q) {
        if (q !== this.q) break; // superseded by a newer session
        if (m.session_id && m.session_id !== this.sessionId) {
          this.sessionId = m.session_id;
          this.emit({ t: 'session', sessionId: m.session_id });
        }
        if (m.parent_tool_use_id) continue; // subagent internals: keep the main transcript clean
        if (m.type === 'system' && m.subtype === 'init') this.commands = m.slash_commands || [];
        if (m.type === 'result') this.onResult(m);
        else for (const ev of mapSdkMessage(m, ctx)) this.emit(ev);
      }
    } catch (e) {
      if (q === this.q) this.emitError(e);
    } finally {
      if (q === this.q) { this.q = null; this.input = null; if (this.busy) this.setBusy(false); }
    }
  }

  /** @param {any} m */
  onResult(m) {
    // total_cost_usd is cumulative for this Claude Code process.
    let turnCost;
    if (typeof m.total_cost_usd === 'number') {
      turnCost = m.total_cost_usd - this.procCost;
      this.procCost = m.total_cost_usd;
      this.totalCost = this.baseCost + m.total_cost_usd;
    }
    this.emit({
      t: 'result', isError: m.subtype !== 'success' || !!m.is_error, subtype: m.subtype, text: m.result || '',
      cost: turnCost, totalCost: this.totalCost, durationMs: Date.now() - this.turnStart,
    });
    this.setBusy(false);
  }

  /** @param {unknown} e */
  emitError(e) { this.emit({ t: 'error', message: String((e && /** @type {any} */ (e).message) || e) }); }
}

module.exports = { ClaudeCodeEngine, CLAUDE_EXE };
