// Changelog Generator - server side of the first UnleashWP tool plugin.
// A plugin exposes `routes`; the core registry (src/plugins.mjs) mounts them.
// This one owns the report + branch endpoints; credential/setup routes stay in
// the core shell because every tool shares them.
import { generate } from '../../src/report.mjs';
import { toMarkdown, toPost, sourceUrls } from '../../src/format.mjs';
import { branches } from '../../src/github.mjs';
import { resolveCookie, countTracTickets } from '../../src/trac.mjs';
import { applyCommitBodies, applyDeepDetails } from '../../src/aggregate.mjs';
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
      // Cookie-free baseline: each Core change gets its own GitHub commit body as
      // the description. Always available, no extra request, no credentials.
      applyCommitBodies(report);
      meta.deepSource = 'commit';
      // Optional enrichment: fill any gaps with the Trac ticket description via
      // the MCP. Never block the report on a deep failure - the bodies still show.
      if (mcpAvailable()) {
        try {
          const details = await mcpTicketDetails(report.core.tickets || []);
          applyDeepDetails(report, details);
          meta.deepSource = 'commit+mcp';
          if (details.capped) meta.deepCapped = true;
        } catch (err) {
          meta.deepError = err.message;
        }
      }
    }
    if (q.get('devNotesOnly') === 'true') { filterDevNotes(report); meta.devNotesOnly = true; }

    const sources = sourceUrls(meta);
    // Align the Core-tickets card with the exact Trac query the Sources link
    // opens, so clicking "verify" shows the same number. Needs a saved cookie
    // (the CSV endpoint is bot-walled); without one the card keeps the cookie-free
    // count of tickets the in-window changesets close. Dev-notes-only has its own
    // ticket meaning, so leave it alone.
    if (meta.milestone && !meta.devNotesOnly) {
      const cookie = resolveCookie();
      if (cookie) {
        try {
          report.core.tracTicketCount = await countTracTickets(sources.trac, cookie);
          meta.ticketSource = 'trac';
        } catch (err) {
          meta.ticketCountError = err.message; // fall back to the changeset-derived count
        }
      }
    }

    ctx.json(res, 200, { meta, report, sources, markdown: toMarkdown(report, meta), post: toPost(report, meta) });
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
