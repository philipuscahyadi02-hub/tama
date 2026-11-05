// A tiny fake ACP agent for tests (speaks the same JSON-RPC subset agy does).
// Prompt keywords: "RUN <cmd>" → asks permission to run a command and reports the outcome;
// "WRITE" → writes fake-written.txt in cwd without asking (like agy in-workspace edits);
// "ESCALATE" → replies with the escalation marker; anything else → echoes with the persona tag.
const fs = require('fs');
const path = require('path');

let buf = '';
let nextId = 1000;
let persona = '';
let cwd = process.cwd();
const waiting = new Map();
const send = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
const update = (sessionId, u) => send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: u } });
const chunk = (sessionId, text) => update(sessionId, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } });

function askClient(method, params) {
  const id = nextId++;
  send({ jsonrpc: '2.0', id, method, params });
  return new Promise((r) => waiting.set(id, r));
}

async function handle(m) {
  if (m.id != null && waiting.has(m.id)) { waiting.get(m.id)(m.result || m.error); waiting.delete(m.id); return; }
  const reply = (result) => send({ jsonrpc: '2.0', id: m.id, result });
  switch (m.method) {
    case 'initialize': return reply({ protocolVersion: 1, agentCapabilities: { _meta: { antigravity: { systemPrompt: { append: true } } } }, agentInfo: { name: 'fake', version: '0' } });
    case 'session/new':
      persona = m.params?._meta?.antigravity?.systemPrompt?.append || '';
      cwd = m.params.cwd;
      return reply({ sessionId: 's1', models: { currentModelId: 'fake-flash' }, modes: { currentModeId: 'default' } });
    case 'session/set_model': case 'session/set_config_option': return reply({});
    case 'session/prompt': {
      const text = m.params.prompt.map((p) => p.text).join(' ');
      const sid = m.params.sessionId;
      if (text.includes('RUN')) {
        update(sid, { sessionUpdate: 'tool_call', toolCallId: 't1', name: 'run_command', args: { CommandLine: 'echo hi' }, status: 'pending', kind: 'execute', title: 'echo hi' });
        const r = await askClient('session/request_permission', {
          sessionId: sid,
          toolCall: { toolCallId: 't1', name: 'run_command', args: { CommandLine: 'echo hi' }, kind: 'execute', title: 'echo hi' },
          options: [{ optionId: 'allow', name: 'Allow', kind: 'allow_once' }, { optionId: 'always', name: 'Always', kind: 'allow_always' }, { optionId: 'deny', name: 'Deny', kind: 'reject_once' }],
        });
        const allowed = r && r.outcome && r.outcome.outcome === 'selected' && r.outcome.optionId !== 'deny';
        update(sid, { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: allowed ? 'completed' : 'failed', content: [{ type: 'content', content: { type: 'text', text: allowed ? 'hi' : 'denied' } }] });
        chunk(sid, allowed ? 'ran it' : 'was not allowed');
      } else if (text.includes('WRITE')) {
        fs.writeFileSync(path.join(cwd, 'fake-written.txt'), 'x');
        update(sid, { sessionUpdate: 'tool_call', toolCallId: 't2', name: 'write_file', args: { Path: 'fake-written.txt' }, status: 'completed', kind: 'edit', title: 'write' });
        chunk(sid, 'wrote it');
      } else if (text.includes('ESCALATE')) {
        chunk(sid, '[[ESCAL'); chunk(sid, 'ATE]] fix the bug');
      } else {
        update(sid, { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'hmm' } });
        chunk(sid, `echo: ${text}`); chunk(sid, persona ? ` [${persona.slice(0, 40)}]` : "");
      }
      return reply({ stopReason: 'end_turn', usage: { totalTokens: 42 } });
    }
    default:
      if (m.id != null) send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'nope' } });
  }
}

process.stdin.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line) handle(JSON.parse(line));
  }
});
