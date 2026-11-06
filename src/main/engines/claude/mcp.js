// @ts-check
// Turn plain tool descriptions (e.g. services/google/tools.js) into an in-process MCP server for Claude Code
// (GOOG-2, D-034). The SDK module and zod (its peer dependency) are passed in by the session, which loads both
// from the same place (app.asar.unpacked when packaged) so the SDK and the schemas share one zod.

/**
 * @typedef {{ type: 'string'|'number'|'boolean'|'rows'|'tabs', desc: string, optional?: boolean }} Param
 * @typedef {{ name: string, description: string, params: Record<string, Param>, run: (args: any) => Promise<any> }} ToolDef
 */

/** @param {any} z */
const cell = (z) => z.union([z.string(), z.number(), z.boolean(), z.null()]);

/** @param {any} z @param {Param} p */
function schema(z, p) {
  /** @type {any} */ let s;
  if (p.type === 'number') s = z.number();
  else if (p.type === 'boolean') s = z.boolean();
  else if (p.type === 'rows') s = z.array(z.array(cell(z)));
  else if (p.type === 'tabs') s = z.array(z.object({ name: z.string(), rows: z.array(z.array(cell(z))).optional() }));
  else s = z.string();
  s = s.describe(p.desc);
  return p.optional ? s.optional() : s;
}

/** @param {any} r */
const asText = (r) => (typeof r === 'string' ? r : JSON.stringify(r, null, 2));

/**
 * @param {{ sdk: any, z: any }} mods  the Agent SDK module and zod
 * @param {string} name @param {ToolDef[]} defs
 * @returns {any} an McpSdkServerConfigWithInstance for `options.mcpServers[name]`
 */
function buildMcpServer({ sdk, z }, name, defs) {
  const tools = defs.map((d) => sdk.tool(
    d.name, d.description,
    Object.fromEntries(Object.entries(d.params).map(([k, p]) => [k, schema(z, p)])),
    async (args) => {
      try {
        return { content: [{ type: 'text', text: asText(await d.run(args)) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(/** @type {Error} */ (e).message || e)}` }], isError: true };
      }
    },
  ));
  return sdk.createSdkMcpServer({ name, version: '1.0.0', tools });
}

module.exports = { buildMcpServer, schema };
