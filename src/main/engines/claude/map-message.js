// @ts-check
// Ported from kero-pet/agent.js — map Claude Agent SDK messages to normalized EngineEvents.
// Pure (except for the small `ctx` that tracks whether a text block is open): unit-testable.

/** Emit a progress event every this many streamed characters (tool input or thinking). */
const PROGRESS_STEP = 1500;

/**
 * @param {any} m  SDK message (not 'result'; the session handles cost bookkeeping for those)
 * @param {{textOpen: boolean, tool?: {name: string, json: string, sent: number, file: string} | null, think?: {chars: number, sent: number} | null}} ctx
 * @returns {Array<{t: string, [k: string]: any}>}
 */
function mapSdkMessage(m, ctx) {
  /** @type {Array<{t: string, [k: string]: any}>} */
  const out = [];
  switch (m.type) {
    case 'stream_event': {
      const ev = m.event;
      if (ev.type === 'content_block_start' && ev.content_block.type === 'text') {
        ctx.textOpen = true; out.push({ t: 'text-start' });
      } else if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
        if (!ctx.textOpen) { ctx.textOpen = true; out.push({ t: 'text-start' }); }
        out.push({ t: 'text-delta', text: ev.delta.text });
      } else if (ev.type === 'content_block_stop' && ctx.textOpen) {
        ctx.textOpen = false; out.push({ t: 'text-end' });
      } else if (ev.type === 'content_block_start' && ev.content_block.type === 'thinking') {
        // Long thinking was the main cause of "silent" minutes (2026-11-06 trace): report its size as it grows.
        ctx.think = { chars: 0, sent: 0 };
        out.push({ t: 'status', state: 'thinking' });
      } else if (ev.type === 'content_block_delta' && ev.delta.type === 'thinking_delta' && ctx.think) {
        ctx.think.chars += String(ev.delta.thinking || '').length;
        if (ctx.think.chars - ctx.think.sent >= PROGRESS_STEP) { ctx.think.sent = ctx.think.chars; out.push({ t: 'thinking-progress', chars: ctx.think.chars }); }
      } else if (ev.type === 'content_block_start' && ev.content_block.type === 'tool_use') {
        // The tool's input streams before the tool runs (a big Write can take a minute): show progress.
        ctx.tool = { name: ev.content_block.name, json: '', sent: 0, file: '' };
        out.push({ t: 'tool-progress', name: ctx.tool.name, chars: 0, file: '' });
      } else if (ev.type === 'content_block_delta' && ev.delta.type === 'input_json_delta' && ctx.tool) {
        const tl = ctx.tool;
        tl.json += ev.delta.partial_json || '';
        if (!tl.file) {
          const f = /"(?:file_path|notebook_path|path)"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(tl.json);
          if (f) tl.file = f[1].replace(/\\\\/g, '\\');
        }
        if (tl.json.length - tl.sent >= PROGRESS_STEP) { tl.sent = tl.json.length; out.push({ t: 'tool-progress', name: tl.name, chars: tl.json.length, file: tl.file }); }
      } else if (ev.type === 'content_block_stop' && (ctx.tool || ctx.think)) {
        ctx.tool = null; ctx.think = null;
      }
      break;
    }
    case 'assistant':
      for (const b of m.message.content) {
        if (b.type === 'tool_use') {
          out.push({ t: 'tool', id: b.id, name: b.name, input: b.input });
          out.push({ t: 'status', state: 'tool', tool: b.name });
        }
      }
      break;
    case 'user': {
      const content = Array.isArray(m.message.content) ? m.message.content : [];
      for (const b of content) {
        if (b.type !== 'tool_result') continue;
        let text = '';
        if (typeof b.content === 'string') text = b.content;
        else if (Array.isArray(b.content)) text = b.content.filter((/** @type {any} */ c) => c.type === 'text').map((/** @type {any} */ c) => c.text).join('\n');
        out.push({ t: 'tool-result', id: b.tool_use_id, isError: !!b.is_error, text: text.slice(0, 4000) });
      }
      break;
    }
    case 'rate_limit_event':
      // claude.ai plan limits (5-hour / weekly utilization) for the usage dashboard (D-040).
      if (m.rate_limit_info) out.push({ t: 'rate-limit', info: m.rate_limit_info });
      break;
    case 'system':
      if (m.subtype === 'init') {
        out.push({ t: 'init', model: m.model, cwd: m.cwd, mode: m.permissionMode, commands: m.slash_commands || [], version: m.claude_code_version });
      } else if (m.subtype === 'local_command_output') {
        out.push({ t: 'info', text: m.content });
      } else if (m.subtype === 'compact_boundary') {
        out.push({ t: 'info', text: '✻ Conversation compacted' });
      }
      break;
    default:
      break;
  }
  return out;
}

module.exports = { mapSdkMessage };
