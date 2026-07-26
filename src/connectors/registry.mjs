// Core connector registry: the single source for which connectors exist, what
// KIND each is, whether it's required, and (for credentials) its live status.
// The setup UI, the first-run installer and /api/config/status all derive from
// this instead of hardcoding four cards + a hand-maintained status shape. A
// second tool can add connectors by exporting `connectors` from its server.mjs —
// read at runtime via loadPlugins(), never a static tools/* import (cycle guard).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { loadPlugins } from '../plugins.mjs';
import { tokenStatus } from './github-token.mjs';
import { deviceFlowConfigured } from './github-device.mjs';
import { resolveCookie, cookiePath } from './wporg-cookie.mjs';

// The MCP server id — the key each agent registers Forge under (claude mcp add
// <id>, the mcpServers.<id> config key, the MCPB manifest name). One constant so
// the register command, the config probe and the Desktop merge never drift. It
// mirrors the product ("UnleashWP AI Forge") and the npm package (@unleashwp/
// ai-forge). Changing it orphans existing registrations — pick it once.
export const SERVER_ID = 'uwp-ai-forge';

// Is Forge already registered as an MCP server in this agent? Read the agent's own
// config file directly — instant, no subprocess (the `mcp get` CLI actually
// *connects* to the server, ~3s). Reflects external add/remove on the next
// refresh. Unreadable / missing config → not registered.
function agentHasForge(agent) {
  try {
    if (agent === 'claude') {
      const d = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8'));
      return { registered: !!(d.mcpServers && d.mcpServers[SERVER_ID]) };
    }
    if (agent === 'codex') {
      // TOML table header: bare hyphenated key, or quoted — match both. Built from
      // SERVER_ID so it can't drift from the id the register command writes.
      const rx = new RegExp('\\[mcp_servers\\.["\']?' + SERVER_ID + '["\']?\\]');
      return { registered: rx.test(readFileSync(join(homedir(), '.codex', 'config.toml'), 'utf8')) };
    }
    if (agent === 'claude-desktop') {
      const d = JSON.parse(readFileSync(desktopConfigPath(), 'utf8'));
      return { registered: !!(d.mcpServers && d.mcpServers[SERVER_ID]) };
    }
  } catch { /* no config or unreadable */ }
  return { registered: false };
}

// Claude Desktop has no CLI — it reads a JSON config at launch. So the one-click
// "Connect" merges Forge in (and out) of that file directly; the user restarts
// the app to apply. Same server command the CLI agents register.
const DESKTOP_ENTRY = { command: 'npx', args: ['-y', '@unleashwp/ai-forge@latest', 'mcp'] };

export function desktopConfigPath() {
  const home = homedir();
  if (process.platform === 'darwin') return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  if (process.platform === 'win32') return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  return join(home, '.config', 'Claude', 'claude_desktop_config.json');
}
function readDesktopConfig() {
  let raw;
  try { raw = readFileSync(desktopConfigPath(), 'utf8'); }
  catch { return {}; } // no config file yet — starting fresh is fine
  // File exists but doesn't parse: refuse rather than overwrite, or a one-click
  // Connect would silently wipe the user's other MCP servers.
  try { return JSON.parse(raw); }
  catch { throw new Error('Your Claude Desktop config is not valid JSON. Fix it first so your other MCP servers are not lost.'); }
}
function writeDesktopConfig(cfg) {
  const p = desktopConfigPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
}
// Merge Forge into the Claude Desktop config, preserving any other servers.
export function registerDesktop() {
  const cfg = readDesktopConfig();
  cfg.mcpServers = cfg.mcpServers || {};
  cfg.mcpServers[SERVER_ID] = { ...DESKTOP_ENTRY };
  writeDesktopConfig(cfg);
}
export function unregisterDesktop() {
  const cfg = readDesktopConfig();
  if (cfg.mcpServers) delete cfg.mcpServers[SERVER_ID];
  writeDesktopConfig(cfg);
}

// The kinds a connector can be. `credential` has a store + status; `command` is a
// copy-paste line (register Forge as an MCP server); `oauth-device` marks a
// credential that can be filled via an OAuth device flow (GitHub sign-in) — the
// same store, just a one-click acquisition path (see github-device.mjs).
export const CONNECTOR_KINDS = ['credential', 'command', 'oauth-device'];

// The line Claude Code / Codex run to register Forge as an MCP server. One source
// so the copy-paste card, the one-click "Register" button (server runs the same
// command) and any installer step stay in sync. Claude gets `--scope user` so it
// registers globally, not tied to whatever directory the server runs from.
const mcpAddCmd = (agent) => `${agent} mcp add ${agent === 'claude' ? '--scope user ' : ''}${SERVER_ID} -- npx -y @unleashwp/ai-forge@latest mcp`;

// Core connectors, in setup order. `status()` returns the per-connector status
// the UI renders (never the secret itself); `command` is the line for command-kind.
const coreConnectors = [
  // `device` tells the UI whether one-click sign-in (OAuth Device Flow) is
  // available; when it isn't, the gh-CLI / token-paste fallbacks still show.
  { id: 'github-token', kind: 'credential', required: true, status: () => ({ ...tokenStatus(), device: deviceFlowConfigured() }) },
  {
    // Optional: only needed for deep Trac ticket text. The base changelog runs
    // cookie-free, so this is never part of the required first-run.
    id: 'wporg-cookie', kind: 'credential', required: false,
    status: () => {
      const c = resolveCookie();
      return { set: !!c, source: process.env.WPORG_TRAC_COOKIE ? 'env' : 'file', path: cookiePath(), envLocked: !!process.env.WPORG_TRAC_COOKIE };
    },
  },
  { id: 'claude', kind: 'command', required: false, command: mcpAddCmd('claude'), status: () => agentHasForge('claude') },
  // Claude Desktop registers via a config-file merge (no CLI), so it carries no
  // copy-paste `command`; the UI shows a one-click Connect + a restart hint.
  { id: 'claude-desktop', kind: 'command', required: false, status: () => agentHasForge('claude-desktop') },
  { id: 'codex', kind: 'command', required: false, command: mcpAddCmd('codex'), status: () => agentHasForge('codex') },
];

// Every connector (Core + plugin-declared), with status resolved to plain data
// ready for JSON. Order: Core first, then whatever plugins add.
export async function listConnectors() {
  const fromPlugins = (await loadPlugins()).flatMap((p) => p.connectors || []);
  // `status` may be sync (credential) or async (agent CLI probe) — await handles both.
  return Promise.all([...coreConnectors, ...fromPlugins].map(async (c) => ({
    id: c.id,
    kind: c.kind,
    required: !!c.required,
    ...(c.command ? { command: c.command } : {}),
    ...(c.status ? { status: await c.status() } : {}),
  })));
}
