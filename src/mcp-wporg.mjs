// Binds the one MCP server Forge talks to today: Automattic's mcp-context-wporg
// (authenticated WordPress.org data: Trac tickets/timeline, GitHub issues,
// dev-note reports). This descriptor owns the two things the generic client must
// NOT hardcode: the server's locator and its credentialEnv map (which env var
// each Core connector feeds). Both credentials are Core connectors, and the Core
// shell's /api/mcp/* routes proxy this server, so the binding lives in Core.
import { registerMcpServer, mcpAvailable, mcpSession, mcpListTools, mcpExecute } from './mcp-client.mjs';
import { resolveCookie } from './connectors/wporg-cookie.mjs';
import { resolveToken } from './connectors/github-token.mjs';

export { mcpText } from './mcp-client.mjs';

const WPORG = 'wporg';

// Where the built server lives. Set FORGE_WPORG_MCP to the entry file you trust.
// There is no default path: a writable ~/Documents default let any local process
// that could drop a file there inherit WPORG_TRAC_COOKIE and GITHUB_TOKEN on spawn.
function resolvePath() {
  return process.env.FORGE_WPORG_MCP || null;
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
