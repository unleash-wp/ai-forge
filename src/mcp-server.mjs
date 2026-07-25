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

const DIR = dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(readFileSync(join(DIR, '..', 'package.json'), 'utf8')).version;
const PROTOCOL = '2024-11-05';

export async function startMcpServer() {
  // Aggregate every plugin's MCP tools and skills. Skills are exposed as MCP
  // prompts. First registration wins; a clashing name is skipped with a stderr
  // note (stdout stays pure JSON-RPC).
  const tools = new Map();
  const prompts = new Map();
  for (const p of await loadPlugins()) {
    for (const tool of p.mcpTools || []) {
      if (tools.has(tool.name)) { process.stderr.write(`uwp mcp: duplicate tool "${tool.name}" from ${p.manifest.id} ignored\n`); continue; }
      tools.set(tool.name, tool);
    }
    for (const skill of p.skills || []) {
      if (prompts.has(skill.name)) { process.stderr.write(`uwp mcp: duplicate skill "${skill.name}" from ${p.manifest.id} ignored\n`); continue; }
      prompts.set(skill.name, skill);
    }
  }

  const send = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');
  const ok = (id, result) => send({ jsonrpc: '2.0', id, result });
  const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

  async function handle(msg) {
    const { id, method, params } = msg;
    if (id == null) return; // notification (e.g. notifications/initialized): no reply

    if (method === 'initialize') {
      return ok(id, { protocolVersion: PROTOCOL, capabilities: { tools: {}, prompts: {} }, serverInfo: { name: 'forge', version: VERSION } });
    }
    if (method === 'ping') return ok(id, {});
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
        tools: [...tools.values()].map((t) => ({
          name: t.name,
          description: t.description || '',
          inputSchema: t.inputSchema || { type: 'object', properties: {} },
        })),
      });
    }
    if (method === 'tools/call') {
      const tool = tools.get(params && params.name);
      if (!tool) return fail(id, -32602, `unknown tool: ${params && params.name}`);
      try {
        const out = await tool.run((params && params.arguments) || {});
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
  process.stderr.write(`uwp mcp: ready, ${tools.size} tool(s) + ${prompts.size} skill(s) over stdio\n`);
}
