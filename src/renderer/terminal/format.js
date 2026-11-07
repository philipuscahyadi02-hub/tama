/* Terminal text formatting (QC-4): escaping, tiny markdown, diffs and Claude Code tool lines. Pure, no DOM, so it is
   unit-tested in format.test.js. Loaded as a plain script in the terminal (window.TermFormat) and as a module in tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TermFormat = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const fmtDur = (ms) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);

  function fmtInline(t) {
    return t
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  }
  /** Tiny markdown: code fences, headings, bullets, numbered lists, inline code/bold/italic. Input is escaped first. */
  function md(src) {
    const parts = src.split('```');
    return parts.map((p, i) => {
      if (i % 2 === 1) {
        const nl = p.indexOf('\n');
        const code = nl >= 0 ? p.slice(nl + 1) : p;
        return `<pre class="code">${esc(code.replace(/\n$/, ''))}</pre>`;
      }
      let prevBlank = false;
      return esc(p).split('\n').map((line) => {
        if (!line.trim()) { if (prevBlank) return ''; prevBlank = true; return '<div></div>'; }
        prevBlank = false;
        let m;
        if ((m = line.match(/^#{1,6}\s+(.*)/))) return `<div class="h">${fmtInline(m[1])}</div>`;
        if ((m = line.match(/^(\s*)[-*]\s+(.*)/))) return `<div style="padding-left:${m[1].length * 7 + 2}px">• ${fmtInline(m[2])}</div>`;
        if ((m = line.match(/^(\s*)(\d+)\.\s+(.*)/))) return `<div style="padding-left:${m[1].length * 7 + 2}px">${m[2]}. ${fmtInline(m[3])}</div>`;
        return `<div>${fmtInline(line)}</div>`;
      }).join('');
    }).join('');
  }

  function diffHtml(oldS, newS, max = 40) {
    const out = [];
    const o = oldS ? String(oldS).split('\n') : [];
    const n = newS ? String(newS).split('\n') : [];
    o.slice(0, max).forEach((l) => out.push(`<div class="del">- ${esc(l)}</div>`));
    if (o.length > max) out.push(`<div class="more">  … ${o.length - max} more removed</div>`);
    n.slice(0, max).forEach((l) => out.push(`<div class="add">+ ${esc(l)}</div>`));
    if (n.length > max) out.push(`<div class="more">  … ${n.length - max} more added</div>`);
    return `<div class="diff">${out.join('')}</div>`;
  }

  /** Tool helpers that show paths relative to the working folder. @param {() => string | null} getCwd */
  function make(getCwd) {
    function rel(p) {
      if (!p) return '';
      const s = String(p).replace(/\\/g, '/');
      const c = (getCwd() || '').replace(/\\/g, '/');
      return c && s.toLowerCase().startsWith(c.toLowerCase() + '/') ? s.slice(c.length + 1) : s;
    }
    function toolLabel(name, i = {}) {
      switch (name) {
        case 'Read': case 'Edit': case 'MultiEdit': case 'Write': case 'NotebookEdit':
          return [name === 'MultiEdit' || name === 'Edit' ? 'Update' : name, rel(i.file_path || i.notebook_path)];
        case 'Bash': return ['Bash', trunc(String(i.command || ''), 120)];
        case 'Grep': return ['Search', `pattern: "${i.pattern || ''}"${i.path ? `, path: "${rel(i.path)}"` : ''}`];
        case 'Glob': return ['Search', `pattern: "${i.pattern || ''}"`];
        case 'WebFetch': return ['Fetch', i.url || ''];
        case 'WebSearch': return ['Web Search', `"${i.query || ''}"`];
        case 'Task': case 'Agent': return ['Task', i.description || ''];
        case 'TodoWrite': return ['Update Todos', ''];
        default: {
          const first = Object.values(i).find((v) => typeof v === 'string');
          return [name.replace(/^mcp__/, '').replace(/__/g, ' · '), first ? trunc(first, 80) : ''];
        }
      }
    }
    function toolExtra(name, i = {}) {
      if (name === 'Edit') return diffHtml(i.old_string, i.new_string);
      if (name === 'MultiEdit' && Array.isArray(i.edits)) return i.edits.slice(0, 4).map((e) => diffHtml(e.old_string, e.new_string, 15)).join('');
      if (name === 'TodoWrite' && Array.isArray(i.todos)) {
        return `<div class="todos">${i.todos.map((t) => {
          const box = t.status === 'completed' ? '☒' : '☐';
          const cls = t.status === 'completed' ? 'ok' : t.status === 'in_progress' ? 'doing' : '';
          return `<div class="${cls}">⎿ ${box} ${esc(t.content || t.activeForm || '')}</div>`;
        }).join('')}</div>`;
      }
      return '';
    }
    function toolSummary(name, i, text, isErr) {
      const lines = String(text || '').replace(/\r/g, '').split('\n').filter((l, idx, a) => !(idx === a.length - 1 && !l));
      if (isErr) return trunc(lines.slice(0, 3).join('\n') || 'Error', 400);
      switch (name) {
        case 'Read': return `Read ${lines.length} lines`;
        case 'Glob': return `Found ${lines.filter(Boolean).length} files`;
        case 'Grep': return lines.length <= 3 ? lines.join('\n') || 'No matches' : `Found ${lines.length} lines`;
        case 'Edit': case 'MultiEdit': return `Updated ${rel(i.file_path)}`;
        case 'Write': return `Wrote ${String(i.content || '').split('\n').length} lines to ${rel(i.file_path)}`;
        case 'TodoWrite': return null;
        default: {
          if (!lines.length) return '(No content)';
          const shown = lines.slice(0, 4).map((l) => trunc(l, 160)).join('\n');
          return lines.length > 4 ? `${shown}\n… +${lines.length - 4} lines` : shown;
        }
      }
    }
    return { rel, toolLabel, toolExtra, toolSummary };
  }

  return { esc, trunc, fmtDur, md, diffHtml, make };
}));
