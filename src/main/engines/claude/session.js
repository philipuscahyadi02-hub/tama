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

class ClaudeCodeEngine {
  /** @param {Emit} emit @param {{ tamaName?: string }} [opts] */
  constructor(emit, opts = {}) {
    this.emit = emit;
    this.tamaName = opts.tamaName || 'Tama';
    /** @type {string | null} */ this.cwd = null;
    this.mode = 'default';
    /** @type {string | null} */ this.model = null; // null = Claude Code's default
    /** @type {string | null} */ this.sessionId = null;
    /** @type {any} */ this.q = null;
    /** @type {InstanceType<typeof InputQueue> | null} */ this.input = null;
    this.busy = false;
    /** @type {Map<number, {resolve: (r: any) => void, suggestions?: any, input: any}>} */
    this.pendingPerms = new Map();
    this.permSeq = 0;
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
    const options = {
      cwd: this.cwd,
      includePartialMessages: true,
      permissionMode: this.mode,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: persona(this.tamaName) },
      canUseTool: (/** @type {string} */ name, /** @type {any} */ input, /** @type {any} */ o) => this.askPermission(name, input, o),
    };
    if (CLAUDE_EXE) options.pathToClaudeCodeExecutable = CLAUDE_EXE;
    if (this.model) options.model = this.model;
    if (resumeId) options.resume = resumeId;
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
    for (const [id, p] of this.pendingPerms) {
      p.resolve({ behavior: 'deny', message: 'The user interrupted.', interrupt: true });
      this.emit({ t: 'permission-done', id });
    }
    this.pendingPerms.clear();
    if (this.q && this.busy) { try { await this.q.interrupt(); } catch { /* already stopped */ } }
  }

  stop() {
    for (const [, p] of this.pendingPerms) p.resolve({ behavior: 'deny', message: 'Session closed.' });
    this.pendingPerms.clear();
    if (this.input) this.input.close();
    if (this.q) { try { this.q.close(); } catch { /* already closed */ } }
    this.q = null; this.input = null;
    if (this.busy) this.setBusy(false);
  }

  /** @param {string} name @param {any} input @param {any} opts */
  askPermission(name, input, opts) {
    const id = ++this.permSeq;
    this.emit({ t: 'status', state: 'permission' });
    this.emit({ t: 'permission', id, name, input, reason: opts && opts.decisionReason });
    return new Promise((resolve) => {
      this.pendingPerms.set(id, { resolve, suggestions: opts && opts.suggestions, input });
      if (opts && opts.signal) {
        opts.signal.addEventListener('abort', () => {
          if (this.pendingPerms.delete(id)) {
            resolve({ behavior: 'deny', message: 'Aborted.' });
            this.emit({ t: 'permission-done', id });
          }
        });
      }
    });
  }

  /** @param {number} id @param {'yes'|'always'|'no'} choice @param {string} [feedback] */
  answerPermission(id, choice, feedback) {
    const p = this.pendingPerms.get(id);
    if (!p) return;
    this.pendingPerms.delete(id);
    if (choice === 'yes') p.resolve({ behavior: 'allow', updatedInput: p.input });
    else if (choice === 'always') p.resolve({ behavior: 'allow', updatedInput: p.input, updatedPermissions: p.suggestions || [] });
    else {
      p.resolve({
        behavior: 'deny',
        message: feedback ? `The user said no and gave this instruction: ${feedback}` : 'The user denied this action. Wait for their instructions.',
        interrupt: !feedback,
      });
    }
    this.emit({ t: 'permission-done', id, choice });
    this.emit({ t: 'status', state: 'thinking' });
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
