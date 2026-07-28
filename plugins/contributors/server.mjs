// Contributors — a free bundled UnleashWP core plugin. Answers "who contributed
// to Core + Gutenberg in a period, and which company invested most" for the
// make.wordpress.org "Month in Core"-style analysis. Built on the shared Core
// services src/lib/wp-contributors.mjs (counts, matching the changelog plugin),
// src/lib/wp-profiles.mjs (employer), and src/lib/wp-branches.mjs (branch picker).
import { writeFileSync } from 'node:fs';
import { authenticated } from '../../src/connectors/github-token.mjs';
import { branches } from '../../src/lib/wp-branches.mjs';
import { contributorsReport } from './lib/report.mjs';
import { toMarkdown, toText } from './lib/format.mjs';
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
      companies: q.get('companies') === 'true',
    });
    ctx.json(res, 200, { report, markdown: toMarkdown(report) });
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
];

// ---- MCP tool: pull the ranked contributors live from Claude Code / Codex ----
export const mcpTools = [
  {
    name: 'get_contributors',
    description: 'Who contributed to WordPress Core + Gutenberg in a period, ranked by credited contributions (Core props + Gutenberg authored commits). Optionally, which company invested most.',
    inputSchema: {
      type: 'object',
      properties: {
        quarter: { type: 'string', description: 'Quarter, e.g. 2025-Q4' },
        month: { type: 'string', description: 'Month, e.g. 2025-10' },
        since: { type: 'string', description: 'Start date YYYY-MM-DD (use with until)' },
        until: { type: 'string', description: 'End date YYYY-MM-DD (use with since)' },
        gbBranch: { type: 'string', description: 'Gutenberg branch (default: trunk; e.g. wp/7.1)' },
        coreBranch: { type: 'string', description: 'Core branch (default: trunk)' },
        companies: { type: 'boolean', description: 'Also resolve each contributor\'s employer and rank which company invested most (slower; fetches wp.org profiles).' },
        format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format (default: markdown)' },
      },
    },
    run: async (a) => {
      const report = await build(a, { warn: mcpWarn });
      return a.format === 'json' ? JSON.stringify(report, null, 2) : toMarkdown(report);
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
        writeFileSync(args.svg, leaderboardSvg(report.byContributor, { top, title: `Contributors — ${report.window.label}` }));
        ctx.error(`uwp: wrote leaderboard chart (top ${top}) to ${args.svg}`);
      }
      if (args['company-svg'] && report.companies) {
        const top = Number(args.top) || 15;
        writeFileSync(args['company-svg'], companySvg(report.companies.byCompany, { top, title: `Company investment — ${report.window.label}` }));
        ctx.error(`uwp: wrote company chart (top ${top}) to ${args['company-svg']}`);
      }
      if (args.json) { ctx.log(JSON.stringify(report, null, 2)); return; }
      ctx.log(toText(report));
    },
  },
];
