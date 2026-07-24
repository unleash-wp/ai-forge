// Changelog Generator - server side of the first UnleashWP tool plugin.
// A plugin exposes `routes`; the core registry (src/plugins.mjs) mounts them.
// This one owns the report + branch endpoints; credential/setup routes stay in
// the core shell because every tool shares them.
import { generate } from '../../src/report.mjs';
import { toMarkdown, toPost, sourceUrls } from '../../src/format.mjs';
import { branches } from '../../src/github.mjs';
import { fetchTicketDetails, resolveCookie } from '../../src/trac.mjs';
import { applyDeepDetails } from '../../src/aggregate.mjs';
import { mcpAvailable, mcpTicketDetails } from '../../src/mcp.mjs';
import { fetchDevNotes } from '../../src/makenotes.mjs';

// "Dev notes only": narrow the report to Core changesets flagged in the docs
// tracker (dev-note / misc-dev-note / field-guide) and drop Gutenberg. Mutates
// report in place so the same object feeds the view, counts and Markdown/post.
function filterDevNotes(report) {
  const kept = (report.core.commits || []).filter((c) => c.classification);
  const byComponent = {};
  for (const c of kept) {
    const k = c.component || 'Uncategorized';
    (byComponent[k] = byComponent[k] || []).push(c);
  }
  const tickets = [...new Set(kept.flatMap((c) => c.tickets || []))];
  const contributors = [...new Set(kept.flatMap((c) => c.props || []))]
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  report.core = { ...report.core, commits: kept, byComponent, tickets,
    changesetCount: kept.length, ticketCount: tickets.length, contributors };
  report.gutenberg = { commits: [], byCategory: null, contributors: [] };
  report.totals = { gutenbergCommits: 0, gutenbergPRs: 0,
    coreChangesets: kept.length, coreTickets: tickets.length, contributors: contributors.length };
  return report;
}

async function reportHandler(req, res, url, ctx) {
  try {
    const q = url.searchParams;
    const { meta, report } = await generate({
      since: q.get('since'),
      until: q.get('until'),
      milestone: q.get('milestone') || null,
      gbBranch: q.get('gbBranch') || undefined,
      coreBranch: q.get('coreBranch') || undefined,
      labels: q.get('labels') !== 'false',
      devNotes: q.get('devNotes') !== 'false',
    });
    if (q.get('deep') === 'true') {
      try {
        // Prefer the MCP (authenticated Trac, per-ticket, batched + cached). Fall
        // back to the direct milestone CSV when the MCP server isn't installed.
        if (mcpAvailable()) {
          const details = await mcpTicketDetails(report.core.tickets || []);
          applyDeepDetails(report, details);
          meta.deepSource = 'mcp';
          if (details.capped) meta.deepCapped = true;
        } else {
          const cookie = resolveCookie();
          if (!cookie) throw new Error('no Trac cookie saved yet');
          applyDeepDetails(report, await fetchTicketDetails({ milestone: meta.milestone, cookie }));
          meta.deepSource = 'trac';
        }
      } catch (err) {
        meta.deepError = err.message; // never block the report on a deep failure
      }
    }
    if (q.get('devNotesOnly') === 'true') { filterDevNotes(report); meta.devNotesOnly = true; }
    ctx.json(res, 200, { meta, report, sources: sourceUrls(meta), markdown: toMarkdown(report, meta), post: toPost(report, meta) });
  } catch (err) {
    ctx.json(res, 400, { error: err.message });
  }
}

// Cache the last good branch list per repo so a transient GitHub rate limit
// (403) doesn't blank the milestone/branch pickers. Kept in memory for the
// server's lifetime; refreshed on every successful fetch.
const branchCache = new Map();

async function branchesHandler(req, res, url, ctx) {
  const repo = url.searchParams.get('repo') === 'core' ? 'WordPress/wordpress-develop' : 'WordPress/gutenberg';
  try {
    const list = await branches(repo);
    branchCache.set(repo, list);
    ctx.json(res, 200, { branches: list });
  } catch (err) {
    const cached = branchCache.get(repo);
    if (cached) { ctx.json(res, 200, { branches: cached, stale: true }); return; }
    ctx.json(res, 200, { branches: [], error: err.message });
  }
}

// Published dev notes for a milestone, from make.wordpress.org (tag-precise).
async function devNotesHandler(req, res, url, ctx) {
  const milestone = url.searchParams.get('milestone') || '';
  try {
    ctx.json(res, 200, { milestone, notes: await fetchDevNotes(milestone) });
  } catch (err) {
    ctx.json(res, 200, { milestone, notes: [], error: err.message });
  }
}

export const routes = [
  { method: 'GET', path: '/api/report', handler: reportHandler },
  { method: 'GET', path: '/api/branches', handler: branchesHandler },
  { method: 'GET', path: '/api/devnotes', handler: devNotesHandler },
];
