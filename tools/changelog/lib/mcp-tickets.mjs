// Changelog plugin: Trac ticket details via the wporg MCP (the --deep enrichment
// that fills a change's description from the ticket). This is changelog-specific,
// so it lives in the plugin; it runs on the Core-owned wporg binding
// (src/mcp-wporg.mjs) rather than knowing anything about the transport itself.
import { wporgSession, mcpText } from '../../../src/mcp-wporg.mjs';

// Batched + cached + capped so we stay fast and don't hammer WordPress.org. One
// session fetches every uncached id (load the trac provider once, then get-ticket
// sequentially - gentle on the upstream); results are cached for the server's
// lifetime so repeat reports are free. Returns Map<id, { summary, description,
// component, type, owner, priority }>, the shape applyDeepDetails() consumes.
// `capped` is set on the map when the request exceeded `cap`.
const ticketCache = new Map();
export async function mcpTicketDetails(ids, { cap = 40 } = {}) {
  const want = [...new Set((ids || []).filter((id) => id != null))];
  const missing = want.filter((id) => !ticketCache.has(id));
  const need = missing.slice(0, cap);
  if (need.length) {
    const calls = [{ method: 'tools/call', params: { name: 'wporg-load-provider', arguments: { provider: 'trac' } } }];
    for (const id of need) calls.push({ method: 'tools/call', params: { name: 'wporg-execute-tool', arguments: { provider: 'trac', tool: 'get-ticket', params: { id } } } });
    const results = await wporgSession(calls, { timeout: 120000 });
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
