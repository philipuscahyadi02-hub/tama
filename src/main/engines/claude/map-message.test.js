// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const { mapSdkMessage } = require('./map-message');

test('streamed text opens, streams and closes a block', () => {
  const ctx = { textOpen: false };
  const evs = [
    ...mapSdkMessage({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } } }, ctx),
    ...mapSdkMessage({ type: 'stream_event', event: { type: 'content_block_stop' } }, ctx),
  ];
  assert.deepEqual(evs.map((e) => e.t), ['text-start', 'text-delta', 'text-end']);
});

test('tool use and tool results are normalized', () => {
  const ctx = { textOpen: false };
  const tool = mapSdkMessage({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'a.js' } }] } }, ctx);
  assert.deepEqual(tool.map((e) => e.t), ['tool', 'status']);
  const res = mapSdkMessage({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'ok' }] }] } }, ctx);
  assert.deepEqual(res[0], { t: 'tool-result', id: 't1', isError: false, text: 'ok' });
});

test('a streaming tool input reports progress with the file name (no silent minute-long Writes)', () => {
  const ctx = { textOpen: false, tool: null };
  const se = (event) => mapSdkMessage({ type: 'stream_event', event }, ctx);
  const start = se({ type: 'content_block_start', content_block: { type: 'tool_use', name: 'Write' } });
  assert.deepEqual(start, [{ t: 'tool-progress', name: 'Write', chars: 0, file: '' }]);
  const evs = [
    ...se({ type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"file_path": "C:\\\\a\\\\index.html", "content": "' } }),
    ...se({ type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: 'x'.repeat(3000) } }),
  ];
  assert.equal(evs.length, 1);
  assert.equal(evs[0].file, 'C:\\a\\index.html');
  assert.ok(evs[0].chars > 3000);
  se({ type: 'content_block_stop' });
  assert.equal(ctx.tool, null);
});

test('thinking reports its growing size', () => {
  const ctx = { textOpen: false, think: null };
  const se = (event) => mapSdkMessage({ type: 'stream_event', event }, ctx);
  assert.deepEqual(se({ type: 'content_block_start', content_block: { type: 'thinking' } }), [{ t: 'status', state: 'thinking' }]);
  assert.deepEqual(se({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'x'.repeat(100) } }), []);
  assert.deepEqual(se({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'x'.repeat(1500) } }), [{ t: 'thinking-progress', chars: 1600 }]);
  se({ type: 'content_block_stop' });
  assert.equal(ctx.think, null);
});

test('system init exposes slash commands', () => {
  const [ev] = mapSdkMessage({ type: 'system', subtype: 'init', model: 'm', cwd: 'c', permissionMode: 'default', slash_commands: ['init'] }, { textOpen: false });
  assert.equal(ev.t, 'init');
  assert.deepEqual(ev.commands, ['init']);
});
