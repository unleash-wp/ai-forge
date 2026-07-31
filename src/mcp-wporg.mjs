// Binds the one MCP server Forge talks to today: Automattic's mcp-context-wporg
// (authenticated WordPress.org data: Trac tickets/timeline, GitHub issues,
// dev-note reports). This descriptor owns the two things the generic client must
// NOT hardcode: the server's locator and its credentialEnv map (which env var
// each Core connector feeds). Both credentials are Core connectors, and the Core
// shell's /api/mcp/* routes proxy this server, so the binding lives in Core.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { registerMcpServer, mcpAvailable, mcpSession, mcpListTools, mcpExecute } from './mcp-client.mjs';
import { resolveCookie } from './connectors/wporg-cookie.mjs';
import { resolveToken } from './connectors/github-token.mjs';

export { mcpText } from './mcp-client.mjs';

const WPORG = 'wporg';

// Where the built server lives: FORGE_WPORG_MCP, else the default clone path.
// (A packaged build has no clone. Set FORGE_WPORG_MCP or the deep/MCP features
// degrade; a packaging-safe bundled default is still an open item.)
function resolvePath() {
  return process.env.FORGE_WPORG_MCP || join(homedir(), 'Documents', 'mcp-context-wporg', 'dist', 'index.js');
}

// Pass the tool's credentials through so the MCP's providers are not rate-limited:
// the Trac cookie (auth, avoids 403) + a GitHub token (60 -> 5000/h). Resolvers
// read the Core connectors live; unresolved values are simply skipped.
registerMcpServer({
  id: WPORG,
  resolvePath,
  credentialEnv: {
    WPORG_TRAC_COOKIE: () => resolveCookie(),
    GITHUB_TOKEN: () => resolveToken().token,
  },
});

// wporg-bound convenience wrappers so callers never pass the id around.
export function wporgAvailable() { return mcpAvailable(WPORG); }
export function wporgSession(calls, opts) { return mcpSession(WPORG, calls, opts); }
export function wporgListTools() { return mcpListTools(WPORG); }
export function wporgExecute(provider, tool, params) { return mcpExecute(WPORG, provider, tool, params); }
