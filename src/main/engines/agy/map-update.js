// @ts-check
// ACP session/update → normalized EngineEvents (ARCHITECTURE §5). Pure except for the small ctx.

/**
 * @param {any} u  params.update from a session/update notification
 * @param {{ textOpen: boolean, text: string }} ctx  accumulates the turn's reply text
 * @returns {Array<{t: string, [k: string]: any}>}
 */
function mapAcpUpdate(u, ctx) {
  /** @type {Array<{t: string, [k: string]: any}>} */
  const out = [];
  switch (u && u.sessionUpdate) {
    case 'agent_message_chunk': {
      const text = (u.content && u.content.type === 'text' && u.content.text) || '';
      if (!text) break;
      if (!ctx.textOpen) { ctx.textOpen = true; out.push({ t: 'text-start' }); }
      ctx.text += text;
      out.push({ t: 'text-delta', text });
      break;
    }
    case 'agent_thought_chunk':
      out.push({ t: 'status', state: 'thinking' });
      break;
    case 'tool_call':
      if (ctx.textOpen) { ctx.textOpen = false; out.push({ t: 'text-end' }); }
      out.push({ t: 'tool', id: u.toolCallId, name: toolName(u), input: u.args || u.rawInput || {} });
      out.push({ t: 'status', state: 'tool', tool: toolName(u) });
      if (u.status === 'completed' || u.status === 'failed') out.push(result(u));
      break;
    case 'tool_call_update':
      if (u.status === 'completed' || u.status === 'failed') out.push(result(u));
      break;
    case 'plan':
      out.push({
        t: 'todo',
        todos: (u.entries || []).map((/** @type {any} */ e) => ({ content: e.content, status: e.status === 'completed' ? 'completed' : e.status === 'in_progress' ? 'in_progress' : 'pending' })),
      });
      break;
    case 'available_commands_update':
      out.push({ t: 'commands', commands: (u.availableCommands || []).map((/** @type {any} */ c) => c.name) });
      break;
    default:
      break;
  }
  return out;
}

/** agy names tools like "write_file"; prefer the human title when it's short. @param {any} u */
function toolName(u) {
  return u.name || u.title || u.kind || 'tool';
}

/** @param {any} u */
function result(u) {
  const parts = Array.isArray(u.content) ? u.content : [];
  const text = parts.map((/** @type {any} */ c) => (c && c.content && c.content.text) || (c && c.text) || '').filter(Boolean).join('\n');
  return { t: 'tool-result', id: u.toolCallId, isError: u.status === 'failed', text: text.slice(0, 4000) };
}

/** Map a gate decision to the ACP option the agent offered. @param {any[]} options @param {'yes'|'always'|'no'} choice */
function pickOption(options, choice) {
  const want = choice === 'always' ? ['allow_always', 'allow_once'] : choice === 'yes' ? ['allow_once'] : ['reject_once', 'reject_always'];
  for (const kind of want) {
    const o = (options || []).find((x) => x && x.kind === kind);
    if (o) return o.optionId;
  }
  return null; // nothing suitable offered → caller answers "cancelled" (= not allowed)
}

module.exports = { mapAcpUpdate, pickOption };
