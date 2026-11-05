// @ts-check
// Ported from kero-pet/agent.js — map Claude Agent SDK messages to normalized EngineEvents.
// Pure (except for the small `ctx` that tracks whether a text block is open): unit-testable.

/**
 * @param {any} m  SDK message (not 'result'; the session handles cost bookkeeping for those)
 * @param {{textOpen: boolean}} ctx
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
        out.push({ t: 'status', state: 'thinking' });
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
