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

test('system init exposes slash commands', () => {
  const [ev] = mapSdkMessage({ type: 'system', subtype: 'init', model: 'm', cwd: 'c', permissionMode: 'default', slash_commands: ['init'] }, { textOpen: false });
  assert.equal(ev.t, 'init');
  assert.deepEqual(ev.commands, ['init']);
});
