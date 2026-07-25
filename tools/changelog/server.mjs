// Changelog Generator - server side of the first UnleashWP tool plugin.
// A plugin exposes `routes`; the core registry (src/plugins.mjs) mounts them.
// This one owns the report + branch endpoints; credential/setup routes stay in
// the core shell because every tool shares them.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generate } from './lib/report.mjs';
import { changelogOutput } from './lib/changelog-cli.mjs';
import { toMarkdown, toPost, sourceUrls } from './lib/format.mjs';
import { branches } from '../../src/github.mjs';
import { resolveCookie, countTracTickets } from '../../src/trac.mjs';
import { applyCommitBodies, applyDeepDetails } from './lib/aggregate.mjs';
import { mcpAvailable, mcpTicketDetails } from '../../src/mcp.mjs';
import { fetchDevNotes } from './lib/makenotes.mjs';

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

// MCP tools: exposed over `uwp mcp` so Claude Code / Codex can pull changelog
// data live. stdout is reserved for JSON-RPC, so notes go to stderr.
const mcpWarn = (m) => process.stderr.write(m + '\n');

// MCP App: an interactive ui:// panel the host (Claude Desktop / Codex) renders
// in a sandboxed iframe. show_changelog links to it and returns structuredContent
// that the panel renders — no browser involved.
const APP_HTML = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'app.html'), 'utf8');

export const uiResources = [
  {
    uri: 'ui://forge/changelog',
    name: 'changelog',
    description: 'Interactive changelog panel for a date window.',
    html: APP_HTML,
    permissions: { clipboardWrite: {} },
  },
];

// Build the compact, structured payload the changelog panel renders.
async function changelogData(a) {
  const { meta, report } = await generate({ since: a.since, until: a.until, milestone: a.milestone ?? null });
  const s = sourceUrls(meta);
  const tot = report.totals || {};
  return {
    since: a.since, until: a.until, milestone: meta.milestone || null,
    totals: {
      gutenberg: tot.gutenbergCommits || 0,
      core: tot.coreChangesets || 0,
      tickets: tot.coreTickets || 0,
      contributors: tot.contributors || 0,
      total: (tot.gutenbergCommits || 0) + (tot.coreChangesets || 0),
    },
    sources: { trac: s.trac, gutenberg: s.gutenberg },
    markdown: toMarkdown(report, meta),
  };
}

export const mcpTools = [
  {
    name: 'show_changelog',
    description: 'Open the interactive changelog panel for a date window (renders in the conversation).',
    ui: 'ui://forge/changelog',
    inputSchema: {
      type: 'object',
      properties: {
        since: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        until: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        milestone: { type: 'string', description: 'Release milestone x.y (optional)' },
      },
      required: ['since', 'until'],
    },
    run: async (a) => {
      const structured = await changelogData(a);
      return { text: `${structured.totals.total} changes for ${a.since} to ${a.until}.`, structured };
    },
  },
  {
    name: 'get_changelog',
    description: 'Release-post changelog for WordPress Core + Gutenberg over a date window.',
    inputSchema: {
      type: 'object',
      properties: {
        since: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        until: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        milestone: { type: 'string', description: 'Release milestone x.y (optional; defaults the Gutenberg branch to wp/<x.y>)' },
        format: { type: 'string', enum: ['markdown', 'post', 'json'], description: 'Output format (default: markdown)' },
      },
      required: ['since', 'until'],
    },
    run: (a) => changelogOutput({
      since: a.since,
      until: a.until,
      milestone: a.milestone ?? null,
      json: a.format === 'json',
      post: a.format === 'post',
    }, { warn: mcpWarn }),
  },
  {
    name: 'list_branches',
    description: 'List the available branches for a repo (gutenberg or core).',
    inputSchema: { type: 'object', properties: { repo: { type: 'string', enum: ['gutenberg', 'core'], description: 'Which repo (default: gutenberg)' } } },
    run: async (a) => {
      const repo = a.repo === 'core' ? 'WordPress/wordpress-develop' : 'WordPress/gutenberg';
      return (await branches(repo)).join('\n');
    },
  },
  {
    name: 'list_milestones',
    description: 'List release milestones, derived from the Gutenberg wp/x.y branches.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const versions = [];
      for (const b of await branches('WordPress/gutenberg')) {
        if (b.indexOf('wp/') !== 0) continue;
        const v = b.slice(3);
        if (/^[0-9]+\.[0-9]+$/.test(v) && !versions.includes(v)) versions.push(v);
      }
      return versions.join('\n');
    },
  },
];

// Skills: AI instructions the tool provides, served as MCP prompts over
// `uwp mcp` and printable with `uwp skills`. This one teaches an agent to draft
// a release post from the changelog data while respecting the grounding rule.
export const skills = [
  {
    name: 'write_release_post',
    description: 'Draft a WordPress release post from the changelog for a date window.',
    arguments: [
      { name: 'since', description: 'Start date YYYY-MM-DD', required: true },
      { name: 'until', description: 'End date YYYY-MM-DD', required: true },
      { name: 'milestone', description: 'Release milestone x.y', required: false },
    ],
    build: (a) => [
      `Draft a WordPress release post for the window ${a.since || '<since>'} to ${a.until || '<until>'}${a.milestone ? ` (milestone ${a.milestone})` : ''}.`,
      '',
      'Steps:',
      `1. Call the get_changelog tool (since=${a.since || '<since>'}, until=${a.until || '<until>'}${a.milestone ? `, milestone=${a.milestone}` : ''}, format=json) to get the grounded data: counts, the Core/Gutenberg changes, contributors and the source links.`,
      '2. Write the post: a headline, a 1-2 sentence intro, then highlights grouped by area.',
      '3. Grounding rule (strict): every prose highlight MUST trace to a real PR or ticket in that data. Never invent features and never estimate counts — use the numbers the tool returns.',
      '4. End with the source links and a props / contributors section.',
      '',
      'Voice: the WordPress release-post style — clear, factual, community-facing.',
    ].join('\n'),
  },
];

// Terminal command: `uwp changelog --since … --until … [--milestone x.y]
// [--gb-branch ref] [--core-branch ref] [--no-labels] [--no-dev-notes] [--deep]
// [--post|--json]`. Accepts `uwp changelog <since> <until>` positionally too.
export const commands = [
  {
    name: 'changelog',
    summary: 'Release-post changelog for a date window (--since --until [--post|--json]).',
    run: async (args, ctx) => {
      ctx.log(await changelogOutput({
        since: args.since ?? args._[1],
        until: args.until ?? args._[2],
        milestone: args.milestone ?? null,
        gbBranch: args['gb-branch'],
        coreBranch: args['core-branch'],
        labels: args.labels,
        devNotes: args['dev-notes'],
        deep: args.deep,
        tracCookie: args['trac-cookie'],
        json: args.json,
        post: args.post,
      }, { warn: ctx.error }));
    },
  },
];
