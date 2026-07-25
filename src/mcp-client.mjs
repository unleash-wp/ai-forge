// Generic, zero-dependency MCP client: JSON-RPC 2.0 over the stdio transport
// (newline-delimited). It knows how to spawn a registered MCP server, run a
// session and shape results — but nothing about which credentials or paths any
// particular server needs. Servers register themselves with a locator + a
// credentialEnv map of resolvers, so the transport never hardcodes provider
// specifics (see src/mcp-wporg.mjs for the one server we bind today).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { VERSION } from './version.mjs';

// id -> { resolvePath: () => string, credentialEnv: { ENV_NAME: () => value|null } }
const servers = new Map();

// Register an MCP server the client can spawn. `resolvePath()` returns the path
// to the built server entry (or a falsy value when it isn't installed).
// `credentialEnv` maps an env var name to a resolver; each non-null result is
// injected into the child's environment so the server's providers stay
// authenticated. Ownership of *which* credential lives with the registrant.
export function registerMcpServer({ id, resolvePath, credentialEnv = {} }) {
  servers.set(id, { resolvePath, credentialEnv });
}

function serverOf(id) {
  const s = servers.get(id);
  if (!s) throw new Error(`no MCP server registered as "${id}"`);
  return s;
}

// The resolved path to a registered server's entry, or null when not installed.
export function mcpServerPath(id) {
  const p = serverOf(id).resolvePath();
  return p && existsSync(p) ? p : null;
}
export function mcpAvailable(id) { return !!mcpServerPath(id); }

// Run one MCP session against server `id`: initialize, then the given
// [{method, params}] calls in order; resolves with their results (or rejects).
// Spawns fresh each time and injects the server's resolved credentialEnv.
export function mcpSession(id, calls, { timeout = 30000 } = {}) {
  const path = mcpServerPath(id);
  if (!path) return Promise.reject(new Error(`MCP server "${id}" is not installed`));
  const { credentialEnv } = serverOf(id);
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    for (const [name, resolver] of Object.entries(credentialEnv)) {
      try { const v = resolver(); if (v) env[name] = v; } catch { /* skip unresolved */ }
    }
    const proc = spawn('node', [path], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '', err = '', done = false, rid = 0;
    const pending = new Map();
    const timer = setTimeout(() => finish(new Error('MCP timed out')), timeout);
    function finish(e, r) { if (done) return; done = true; clearTimeout(timer); try { proc.kill(); } catch { /* ignore */ } e ? reject(e) : resolve(r); }
    function send(obj) { try { proc.stdin.write(JSON.stringify(obj) + '\n'); } catch { /* ignore */ } }
    function req(method, params) { return new Promise((res) => { const n = ++rid; pending.set(n, res); send({ jsonrpc: '2.0', id: n, method, params }); }); }

    proc.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id != null && pending.has(msg.id)) { const res = pending.get(msg.id); pending.delete(msg.id); res(msg); }
      }
    });
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('error', (e) => finish(e));
    proc.on('exit', (code) => { if (!done) finish(new Error(`MCP server exited (${code})${err ? ': ' + err.slice(-200) : ''}`)); });

    (async () => {
      try {
        await req('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'forge', version: VERSION } });
        send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        const results = [];
        for (const c of calls) {
          const r = await req(c.method, c.params);
          if (r.error) throw new Error(r.error.message || JSON.stringify(r.error));
          results.push(r.result);
        }
        finish(null, results);
      } catch (e) { finish(e); }
    })();
  });
}

export async function mcpListTools(id) {
  const [r] = await mcpSession(id, [{ method: 'tools/list', params: {} }]);
  return (r && r.tools) || [];
}
export async function mcpCallTool(id, name, args) {
  const [r] = await mcpSession(id, [{ method: 'tools/call', params: { name, arguments: args || {} } }]);
  return r;
}

// Load a provider (trac | github | make) then execute one of its tools, in a
// single session. Returns the MCP tool result ({ content, isError }).
export async function mcpExecute(id, provider, tool, params) {
  const results = await mcpSession(id, [
    { method: 'tools/call', params: { name: 'wporg-load-provider', arguments: { provider } } },
    { method: 'tools/call', params: { name: 'wporg-execute-tool', arguments: { provider, tool, params: params || {} } } },
  ]);
  return results[1];
}

// Flatten an MCP tool result's text content, parsing JSON when it is JSON.
export function mcpText(result) {
  const txt = (result && result.content || []).map((c) => c.text || '').join('\n');
  try { return JSON.parse(txt); } catch { return txt; }
}
