// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./format');

test('esc escapes html', () => {
  assert.equal(F.esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('md: headings, bullets, inline, code fences are escaped', () => {
  const h = F.md('# Hi\n- **bold** and `code`\n```js\n<b>x</b>\n```');
  assert.match(h, /<div class="h">Hi<\/div>/);
  assert.match(h, /• <b>bold<\/b> and <code>code<\/code>/);
  assert.match(h, /<pre class="code">&lt;b&gt;x&lt;\/b&gt;<\/pre>/);
  assert.doesNotMatch(F.md('<script>'), /<script>/);
});

test('diffHtml caps long diffs', () => {
  const h = F.diffHtml('a\nb\nc', 'd', 2);
  assert.match(h, /- a/);
  assert.match(h, /1 more removed/);
  assert.match(h, /\+ d/);
});

test('fmtDur', () => {
  assert.equal(F.fmtDur(4200), '4s');
  assert.equal(F.fmtDur(125000), '2m 5s');
});

test('tool helpers show paths relative to the working folder', () => {
  const t = F.make(() => 'C:\\proj');
  assert.equal(t.rel('C:\\proj\\src\\a.js'), 'src/a.js');
  assert.equal(t.rel('D:\\other\\b.js'), 'D:/other/b.js');
  assert.deepEqual(t.toolLabel('Edit', { file_path: 'C:\\proj\\a.js' }), ['Update', 'a.js']);
  assert.deepEqual(t.toolLabel('mcp__google__gmail_search', { query: 'tennis' }), ['google · gmail_search', 'tennis']);
  assert.equal(t.toolSummary('Read', {}, 'a\nb\nc\n', false), 'Read 3 lines');
  assert.equal(t.toolSummary('Bash', {}, '1\n2\n3\n4\n5\n6', false), '1\n2\n3\n4\n… +2 lines');
  assert.equal(t.toolSummary('Bash', {}, 'boom', true), 'boom');
  assert.equal(t.toolSummary('TodoWrite', {}, '', false), null);
  assert.match(t.toolExtra('TodoWrite', { todos: [{ status: 'completed', content: 'x' }] }), /☒ x/);
});
