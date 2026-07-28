// Contributors — a free bundled UnleashWP core plugin. Answers "who contributed
// to Core + Gutenberg in a period, and which company invested most" for the
// make.wordpress.org "Month in Core"-style analysis. Built on the shared Core
// services src/lib/wp-contributors.mjs (counts, matching the changelog plugin),
// src/lib/wp-profiles.mjs (employer), and src/lib/wp-branches.mjs (branch picker).
import { writeFileSync } from 'node:fs';
import { authenticated } from '../../src/connectors/github-token.mjs';
import { branches } from '../../src/lib/wp-branches.mjs';
import { OFFLINE } from '../../src/lib/wp-profiles.mjs';
import { contributorsReport, priorContributors } from './lib/report.mjs';
import { toMarkdown, toText, capReport, monthInCorePost } from './lib/format.mjs';
import { leaderboardSvg, companySvg } from './lib/charts.mjs';

// stdout is reserved for JSON-RPC under `uwp mcp`, so notes go to stderr.
const mcpWarn = (m) => process.stderr.write(m + '\n');

// Shared build: warn once if unauthenticated (GitHub's 60 req/h anonymous limit),
// then produce the report.
async function build(opts, { warn = () => {} } = {}) {
  if (!authenticated()) warn('uwp: no GitHub token (gh not logged in) - using 60 req/h anonymous limit.');
  return contributorsReport(opts);
}

// ---- HTTP routes (browser UI + the app-window forge_api bridge) ----
async function reportHandler(req, res, url, ctx) {
  try {
    const q = url.searchParams;
    const report = await contributorsReport({
      quarter: q.get('quarter') || undefined,
      month: q.get('month') || undefined,
      since: q.get('since') || undefined,
      until: q.get('until') || undefined,
      gbBranch: q.get('gbBranch') || undefined,
      coreBranch: q.get('coreBranch') || undefined,
      companies: q.get('companies') !== 'false',
      components: q.get('components') !== 'false',
      committers: q.get('committers') !== 'false',
      tickets: q.get('tickets') !== 'false',
    });
    ctx.json(res, 200, { report, markdown: toMarkdown(report) });
  } catch (err) {
    ctx.json(res, 400, { error: err.message });
  }
}

// First-time contributors, on its own route so the main report isn't blocked by
// the (slow) historical lookback fetch. Returns the prior contributor name set.
async function priorHandler(req, res, url, ctx) {
  try {
    const q = url.searchParams;
    const prior = await priorContributors({
      quarter: q.get('quarter') || undefined,
      month: q.get('month') || undefined,
      since: q.get('since') || undefined,
      until: q.get('until') || undefined,
      gbBranch: q.get('gbBranch') || undefined,
      coreBranch: q.get('coreBranch') || undefined,
      months: q.get('months') || undefined,
    });
    ctx.json(res, 200, prior);
  } catch (err) {
    ctx.json(res, 400, { error: err.message });
  }
}

// Cache the last good branch list per repo so a transient GitHub rate limit
// doesn't blank the branch pickers.
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

export const routes = [
  { method: 'GET', path: '/api/contributors', handler: reportHandler },
  { method: 'GET', path: '/api/contributors/branches', handler: branchesHandler },
  { method: 'GET', path: '/api/contributors/prior', handler: priorHandler },
];

// ---- MCP tool: pull the ranked contributors live from Claude Code / Codex ----
export const mcpTools = [
  {
    name: 'get_contributors',
    description: 'Who contributed to WordPress Core + Gutenberg in a period, ranked by credited contributions (Core props + Gutenberg authored commits). Toggle the flags to also get the company breakdown, the Core committers table, the component breakdown and Trac ticket activity. Tables are capped to `top` rows (raise it for more; totals are always exact). Use format=json for the structured report.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        quarter: { type: 'string', pattern: '^\\d{4}-Q[1-4]$', description: 'Quarter, e.g. 2025-Q4' },
        month: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Month, e.g. 2025-10' },
        since: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Start date YYYY-MM-DD (use with until)' },
        until: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'End date YYYY-MM-DD (use with since)' },
        gbBranch: { type: 'string', description: 'Gutenberg branch (default: trunk; e.g. wp/7.1)' },
        coreBranch: { type: 'string', description: 'Core branch (default: trunk)' },
        companies: { type: 'boolean', description: 'Add the employer + "which company invested most" breakdown (fetches wp.org profiles; slower, cached).' },
        committers: { type: 'boolean', description: 'Add the Core committers table (who landed the changesets, with employer + wp.org join year).' },
        components: { type: 'boolean', description: 'Add the Core-changes-by-component breakdown (cookie-free, from the active dev-notes tracker).' },
        tickets: { type: 'boolean', description: 'Add Trac opened/closed ticket counts for the window (needs a WordPress.org session).' },
        top: { type: 'number', minimum: 1, maximum: 500, description: 'Max rows per table (default 25). Raise it for more; totals stay exact. Keep it modest to protect your context budget.' },
        format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format (default: markdown). Use json for the structured report (also capped to `top`).' },
      },
    },
    run: async (a) => {
      const report = await build(a, { warn: mcpWarn });
      const top = Math.min(500, Math.max(1, Number(a.top) || 25)); // clamp: schema max is advisory
      return a.format === 'json' ? JSON.stringify(capReport(report, top), null, 2) : toMarkdown(report, { top });
    },
  },
  {
    name: 'draft_month_in_core',
    description: 'Draft a make.wordpress.org "Month in Core"-style post for a period. Pulls contributors, Core committers, the component breakdown, the company (Five for the Future) breakdown and Trac ticket activity, and assembles a ready-to-edit Markdown post scaffold with the honest coverage notes. Prose highlights are left as TODOs - fill them in from real changesets/PRs you have read; never invent features.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        quarter: { type: 'string', pattern: '^\\d{4}-Q[1-4]$', description: 'Quarter, e.g. 2025-Q4' },
        month: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Month, e.g. 2025-10 (a Month-in-Core post is usually monthly)' },
        since: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Start date YYYY-MM-DD (use with until)' },
        until: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'End date YYYY-MM-DD (use with since)' },
        gbBranch: { type: 'string', description: 'Gutenberg branch (default: trunk; e.g. wp/7.1)' },
        coreBranch: { type: 'string', description: 'Core branch (default: trunk)' },
        top: { type: 'number', minimum: 1, maximum: 500, description: 'Max rows per table in the post (default 100).' },
      },
    },
    run: async (a) => {
      const report = await build({ ...a, companies: true, committers: true, components: true, tickets: true }, { warn: mcpWarn });
      return monthInCorePost(report, { top: Math.min(500, Math.max(1, Number(a.top) || 100)) });
    },
  },
];

// ---- terminal command ----
// `uwp contributors --quarter 2025-Q4 | --month 2025-10 | --since <d> --until <d>
//  [--gb-branch <ref>] [--core-branch <ref>] [--companies] [--json] [--svg <path>]
//  [--company-svg <path>] [--top N]`
export const commands = [
  {
    name: 'contributors',
    summary: 'Rank who contributed to Core + Gutenberg in a period (--quarter | --month | --since --until) [--gb-branch] [--core-branch] [--companies] [--svg <file>].',
    run: async (args, ctx) => {
      const report = await build({
        quarter: args.quarter,
        month: args.month,
        since: args.since ?? args._[1],
        until: args.until ?? args._[2],
        gbBranch: args['gb-branch'],
        coreBranch: args['core-branch'],
        companies: Boolean(args.companies) || Boolean(args['company-svg']),
      }, { warn: ctx.error });

      if (args.svg) {
        const top = Number(args.top) || 20;
        writeFileSync(args.svg, leaderboardSvg(report.byContributor, { top, title: `Contributors · ${report.window.label}` }));
        ctx.error(`uwp: wrote leaderboard chart (top ${top}) to ${args.svg}`);
      }
      if (args['company-svg'] && report.companies) {
        const top = Number(args.top) || 15;
        writeFileSync(args['company-svg'], companySvg(report.companies.byCompany, { top, title: `Company investment · ${report.window.label}` }));
        ctx.error(`uwp: wrote company chart (top ${top}) to ${args['company-svg']}`);
      }
      if (args.json) { ctx.log(JSON.stringify(report, null, 2)); return; }
      ctx.log(toText(report));
    },
  },
  {
    name: 'ingest-profiles',
    summary: 'Warm the shared wp.org profile cache for a period, politely. Deploy as a cron with UWP_CACHE_DIR (shared volume) + UWP_FETCH_RPS (e.g. 2); the app then runs read-only with UWP_OFFLINE=1. Run this WITHOUT UWP_OFFLINE.',
    run: async (args, ctx) => {
      if (OFFLINE) { ctx.error('uwp: UWP_OFFLINE is set - ingestion needs to fetch. Unset it for the ingest job.'); return; }
      const report = await build({
        quarter: args.quarter,
        month: args.month,
        since: args.since ?? args._[1],
        until: args.until ?? args._[2],
        gbBranch: args['gb-branch'],
        coreBranch: args['core-branch'],
        companies: true,
        committers: true,
      }, { warn: ctx.error });
      const known = report.byContributor.filter((p) => p.employer).length;
      ctx.error(`uwp: ingested ${report.window.label} - ${report.totals.contributors} contributors, employer resolved for ${known}. Cache dir: ${process.env.UWP_CACHE_DIR || '~/.config/uwp-ai-forge'}`);
    },
  },
];
