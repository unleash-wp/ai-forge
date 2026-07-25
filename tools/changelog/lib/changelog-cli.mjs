// Shared changelog terminal output. Used by the top-level `uwp --since …` path
// (kept for back-compat) and the `uwp changelog` plugin command, so the two can
// never drift. Returns the string to print; side-channel notes go to `warn`.
import { authenticated } from '../../../src/connectors/github-token.mjs';
import { generate } from './report.mjs';
import { fetchTicketDetails } from './trac-tickets.mjs';
import { resolveCookie } from '../../../src/connectors/wporg-cookie.mjs';
import { applyDeepDetails } from './aggregate.mjs';
import { toMarkdown, toPost } from './format.mjs';

export async function changelogOutput(opts, { warn = () => {} } = {}) {
  const { since, until } = opts;
  if (!since || !until) throw new Error('--since and --until are required');

  if (!authenticated()) {
    warn('uwp: no GitHub token (gh not logged in) - using 60 req/h anonymous limit.');
  }

  const { meta, report } = await generate({
    since,
    until,
    milestone: opts.milestone ?? null,
    gbBranch: opts.gbBranch,
    coreBranch: opts.coreBranch,
    labels: opts.labels !== false,
    devNotes: opts.devNotes !== false,
  });

  if (meta.trackerMissing) {
    warn(`uwp: no dev-notes tracker for ${meta.milestone} - Core stays flat (use --deep or the wporg-context MCP to group).`);
  }

  if (opts.deep) {
    const cookie = resolveCookie({ cookieFile: opts.tracCookie });
    const details = await fetchTicketDetails({ milestone: meta.milestone, cookie });
    applyDeepDetails(report, details);
    warn(`uwp: --deep read ${details.size} Trac tickets (with descriptions).`);
  }

  if (opts.json) return JSON.stringify({ meta, ...report }, null, 2);
  if (opts.post) return toPost(report, meta);
  return toMarkdown(report, meta);
}
