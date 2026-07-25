// `uwp mcp` — a zero-dependency MCP server (JSON-RPC over stdio, the MCP stdio
// transport). Claude Code and Codex register it once and then call the MCP
// tools that tool plugins declare via `mcpTools` in their server.mjs. This is
// the "Funkstelle": agents pull Forge's data live and keep working with it.
//
// Register it (the server is named "forge"; the command it runs is `uwp mcp`):
//   Claude Code:  claude mcp add forge -- uwp mcp
//   Codex:        add an MCP server { command = "uwp", args = ["mcp"] }
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPlugins } from './plugins.mjs';
import { startInternalServer, forgeAppHtml, appAvailable } from './mcp-app.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(readFileSync(join(DIR, '..', 'package.json'), 'utf8')).version;
const PROTOCOL = '2024-11-05';

export async function startMcpServer() {
  // Aggregate every plugin's MCP tools and skills. Skills are exposed as MCP
  // prompts. First registration wins; a clashing name is skipped with a stderr
  // note (stdout stays pure JSON-RPC).
  const tools = new Map();
  const prompts = new Map();
  const uiResources = new Map(); // MCP Apps: ui:// HTML panels a tool can render in
  for (const p of await loadPlugins()) {
    for (const tool of p.mcpTools || []) {
      if (tools.has(tool.name)) { process.stderr.write(`uwp mcp: duplicate tool "${tool.name}" from ${p.manifest.id} ignored\n`); continue; }
      tools.set(tool.name, tool);
    }
    for (const skill of p.skills || []) {
      if (prompts.has(skill.name)) { process.stderr.write(`uwp mcp: duplicate skill "${skill.name}" from ${p.manifest.id} ignored\n`); continue; }
      prompts.set(skill.name, skill);
    }
    for (const res of p.uiResources || []) {
      if (uiResources.has(res.uri)) { process.stderr.write(`uwp mcp: duplicate app "${res.uri}" from ${p.manifest.id} ignored\n`); continue; }
      uiResources.set(res.uri, res);
    }
  }

  // Core MCP-App infrastructure (platform, not a plugin): serve the whole Forge
  // app as a ui:// window, backed by the existing HTTP server proxied through the
  // forge_api tool. The app shell hosts every plugin's UI unchanged.
  let internalPort = null;
  try { internalPort = (await startInternalServer()).port; }
  catch (err) { process.stderr.write(`uwp mcp: internal server failed (${err.message}); app window disabled\n`); }
  if (internalPort && appAvailable()) {
    tools.set('forge_api', {
      name: 'forge_api',
      description: 'Internal: proxy a Forge /api request. Used by the app window; not for direct use.',
      inputSchema: { type: 'object', properties: { method: { type: 'string' }, path: { type: 'string' }, body: {} } },
      run: async (a) => {
        const r = await fetch('http://127.0.0.1:' + internalPort + a.path, {
          method: a.method || 'GET',
          headers: a.body != null ? { 'Content-Type': 'application/json' } : {},
          body: a.body != null ? a.body : undefined,
        });
        return { text: `${r.status} ${a.method || 'GET'} ${a.path}`, structured: { status: r.status, contentType: r.headers.get('content-type') || 'application/json', body: await r.text() } };
      },
    });
    tools.set('open_forge', {
      name: 'open_forge',
      description: 'Open the full UnleashWP AI Forge app as a window in the conversation.',
      ui: 'ui://forge/app',
      inputSchema: { type: 'object', properties: {} },
      run: async () => ({ text: 'Opening UnleashWP AI Forge…', structured: {} }),
    });
    uiResources.set('ui://forge/app', {
      uri: 'ui://forge/app', name: 'forge', description: 'UnleashWP AI Forge — the full app.',
      html: forgeAppHtml(), permissions: { clipboardWrite: {} },
    });
  }

  const send = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');
  const ok = (id, result) => send({ jsonrpc: '2.0', id, result });
  const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

  async function handle(msg) {
    const { id, method, params } = msg;
    if (id == null) return; // notification (e.g. notifications/initialized): no reply

    if (method === 'initialize') {
      return ok(id, { protocolVersion: PROTOCOL, capabilities: { tools: {}, prompts: {}, resources: {} }, serverInfo: { name: 'forge', version: VERSION } });
    }
    if (method === 'ping') return ok(id, {});
    // MCP Apps: the ui:// HTML panels tools render in (rendered in a sandboxed
    // iframe by Claude Desktop / Codex, not a browser).
    if (method === 'resources/list') {
      return ok(id, {
        resources: [...uiResources.values()].map((r) => ({
          uri: r.uri, name: r.name, description: r.description || '', mimeType: 'text/html;profile=mcp-app',
        })),
      });
    }
    if (method === 'resources/read') {
      const r = uiResources.get(params && params.uri);
      if (!r) return fail(id, -32602, `unknown resource: ${params && params.uri}`);
      const content = { uri: r.uri, mimeType: 'text/html;profile=mcp-app', text: r.html };
      if (r.csp || r.permissions) content._meta = { ui: { ...(r.csp ? { csp: r.csp } : {}), ...(r.permissions ? { permissions: r.permissions } : {}) } };
      return ok(id, { contents: [content] });
    }
    if (method === 'prompts/list') {
      return ok(id, {
        prompts: [...prompts.values()].map((s) => ({
          name: s.name,
          description: s.description || '',
          arguments: s.arguments || [],
        })),
      });
    }
    if (method === 'prompts/get') {
      const skill = prompts.get(params && params.name);
      if (!skill) return fail(id, -32602, `unknown prompt: ${params && params.name}`);
      const text = skill.build ? skill.build((params && params.arguments) || {}) : (skill.instructions || '');
      return ok(id, { description: skill.description || '', messages: [{ role: 'user', content: { type: 'text', text } }] });
    }
    if (method === 'tools/list') {
      return ok(id, {
        tools: [...tools.values()].map((t) => {
          const entry = {
            name: t.name,
            description: t.description || '',
            inputSchema: t.inputSchema || { type: 'object', properties: {} },
          };
          // MCP Apps: link the tool to its ui:// panel so the host renders it.
          if (t.ui) entry._meta = { ui: { resourceUri: t.ui, visibility: ['model', 'app'] } };
          return entry;
        }),
      });
    }
    if (method === 'tools/call') {
      const tool = tools.get(params && params.name);
      if (!tool) return fail(id, -32602, `unknown tool: ${params && params.name}`);
      try {
        const out = await tool.run((params && params.arguments) || {});
        // A tool may return a string, or { text, structured } — the latter also
        // sends structuredContent, which the host pushes to the ui:// app.
        if (out && typeof out === 'object' && ('text' in out || 'structured' in out)) {
          const res = { content: [{ type: 'text', text: out.text != null ? String(out.text) : '' }] };
          if (out.structured !== undefined) res.structuredContent = out.structured;
          return ok(id, res);
        }
        const text = typeof out === 'string' ? out : JSON.stringify(out, null, 2);
        return ok(id, { content: [{ type: 'text', text }] });
      } catch (err) {
        // Tool errors are reported in-band so the agent can recover, not as a
        // protocol error that would kill the call.
        return ok(id, { content: [{ type: 'text', text: `error: ${err.message}` }], isError: true });
      }
    }
    return fail(id, -32601, `method not found: ${method}`);
  }

  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      handle(msg).catch((err) => { if (msg && msg.id != null) fail(msg.id, -32603, err.message); });
    }
  });
  process.stdin.on('end', () => process.exit(0));
  process.stderr.write(`uwp mcp: ready, ${tools.size} tool(s) + ${prompts.size} skill(s) + ${uiResources.size} app(s) over stdio\n`);
}
