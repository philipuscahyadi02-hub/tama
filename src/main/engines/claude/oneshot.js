// @ts-check
// One-shot structured generation through the Claude Agent SDK, with NO tools, no user settings and
// no saved session. Used by the character designer (D-021, kept by D-028: it needs strict JSON output).
const path = require('path');
const { pathToFileURL } = require('url');
const { findClaudeExecutable } = require('./find-exe');

const APP_ROOT = path.join(__dirname, '..', '..', '..', '..');
const SDK_URL = pathToFileURL(
  path.join(APP_ROOT, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'sdk.mjs')
    .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`),
).href;

/**
 * @param {{ system: string, prompt: string, schema: object, model?: string, timeoutMs?: number }} req
 * @returns {Promise<any>} the parsed JSON object
 */
async function askJson({ system, prompt, schema, model = 'haiku', timeoutMs = 60000 }) {
  const { query } = await import(SDK_URL);
  const exe = findClaudeExecutable();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  /** @type {Record<string, any>} */
  const options = {
    model,
    systemPrompt: system,
    tools: [],                 // no tools at all: this call can only produce text
    settingSources: [],        // ignore the user's CLAUDE.md / settings / hooks
    persistSession: false,     // nothing written to ~/.claude/projects
    maxTurns: 3,               // allows the SDK's structured-output retry
    outputFormat: { type: 'json_schema', schema },
    abortController: abort,
    cwd: APP_ROOT,
  };
  if (exe) options.pathToClaudeCodeExecutable = exe;
  try {
    for await (const m of query({ prompt, options })) {
      if (m.type !== 'result') continue;
      if (m.subtype !== 'success') throw new Error(`designer model failed: ${m.subtype}`);
      if (m.structured_output && typeof m.structured_output === 'object') return m.structured_output;
      return parseJsonLoose(m.result || '');
    }
    throw new Error('designer model returned no result');
  } finally {
    clearTimeout(timer);
  }
}

/** Accept a bare JSON object, optionally wrapped in a ``` fence. @param {string} text */
function parseJsonLoose(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('designer model reply had no JSON');
  return JSON.parse(text.slice(start, end + 1));
}

module.exports = { askJson, parseJsonLoose };
