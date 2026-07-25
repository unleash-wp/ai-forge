// Minimal, zero-dependency MCP client for the Automattic mcp-context-wporg server
// (the authenticated WordPress.org data path - Trac tickets, timeline, GitHub
// issues, dev-note reports). Speaks JSON-RPC 2.0 over the stdio transport
// (newline-delimited messages): spawn the server, initialize, run calls, exit.
// The core CLI keeps zero runtime deps - this launches the separately-installed
// server as a subprocess rather than importing an SDK.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveCookie } from './connectors/wporg-cookie.mjs';
import { resolveToken } from './connectors/github-token.mjs';

// Where the built server lives: FORGE_WPORG_MCP, else the default clone path.
export function mcpServerPath() {
  const p = process.env.FORGE_WPORG_MCP || join(homedir(), 'Documents', 'mcp-context-wporg', 'dist', 'index.js');
  return existsSync(p) ? p : null;
}
export function mcpAvailable() { return !!mcpServerPath(); }

// Run one MCP session: initialize, then the given [{method, params}] calls in
// order; resolves with their results (or rejects). Spawns fresh each time.
export function mcpSession(calls, { timeout = 30000 } = {}) {
  const path = mcpServerPath();
  if (!path) return Promise.reject(new Error('mcp-context-wporg is not installed (clone + build it, or set FORGE_WPORG_MCP)'));
  return new Promise((resolve, reject) => {
    // Pass the tool's credentials through so the MCP's providers are not rate-
    // limited: the Trac cookie (auth, avoids 403) + a GitHub token (60 -> 5000/h).
    const cookie = resolveCookie();
    const { token } = resolveToken();
    const env = { ...process.env };
    if (cookie) env.WPORG_TRAC_COOKIE = cookie;
    if (token) env.GITHUB_TOKEN = token;
    const proc = spawn('node', [path], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '', err = '', done = false, id = 0;
    const pending = new Map();
    const timer = setTimeout(() => finish(new Error('MCP timed out')), timeout);
    function finish(e, r) { if (done) return; done = true; clearTimeout(timer); try { proc.kill(); } catch { /* ignore */ } e ? reject(e) : resolve(r); }
    function send(obj) { try { proc.stdin.write(JSON.stringify(obj) + '\n'); } catch { /* ignore */ } }
    function req(method, params) { return new Promise((res) => { const rid = ++id; pending.set(rid, res); send({ jsonrpc: '2.0', id: rid, method, params }); }); }

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
        await req('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'forge', version: '0.1.0' } });
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

export async function mcpListTools() {
  const [r] = await mcpSession([{ method: 'tools/list', params: {} }]);
  return (r && r.tools) || [];
}
export async function mcpCallTool(name, args) {
  const [r] = await mcpSession([{ method: 'tools/call', params: { name, arguments: args || {} } }]);
  return r;
}

// Load a provider (trac | github | make) then execute one of its tools, in a
// single session. Returns the MCP tool result ({ content, isError }).
export async function mcpExecute(provider, tool, params) {
  const results = await mcpSession([
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

// Trac ticket details via the MCP, batched + cached + capped so we stay fast and
// don't hammer WordPress.org. One session fetches every uncached id (load the
// trac provider once, then get-ticket sequentially - gentle on the upstream);
// results are cached for the server's lifetime so repeat reports are free.
// Returns Map<id, { summary, description, component, type, owner, priority }>,
// the same shape applyDeepDetails() consumes. `capped` is set on the map when
// the request exceeded `cap`.
const ticketCache = new Map();
export async function mcpTicketDetails(ids, { cap = 40 } = {}) {
  const want = [...new Set((ids || []).filter((id) => id != null))];
  const missing = want.filter((id) => !ticketCache.has(id));
  const need = missing.slice(0, cap);
  if (need.length) {
    const calls = [{ method: 'tools/call', params: { name: 'wporg-load-provider', arguments: { provider: 'trac' } } }];
    for (const id of need) calls.push({ method: 'tools/call', params: { name: 'wporg-execute-tool', arguments: { provider: 'trac', tool: 'get-ticket', params: { id } } } });
    const results = await mcpSession(calls, { timeout: 120000 });
    for (let i = 0; i < need.length; i++) {
      const d = mcpText(results[i + 1]);
      if (d && typeof d === 'object' && d.id != null) {
        ticketCache.set(d.id, { summary: d.summary, description: d.description, component: d.component, type: d.type, owner: d.owner, priority: d.priority });
      }
    }
  }
  const out = new Map();
  for (const id of want) if (ticketCache.has(id)) out.set(id, ticketCache.get(id));
  out.capped = missing.length > cap;
  return out;
}
