import { fetchContributors } from '../../../src/lib/wp-contributors.mjs';
import { companyBreakdown } from '../../../src/lib/wp-profiles.mjs';
import { resolveWindow } from './quarters.mjs';

// Orchestrate: resolve the period window, then pull Core + Gutenberg contributors
// through the shared Core service (src/lib/wp-contributors.mjs) so the counts
// match the changelog plugin. Returns the report the CLI / MCP / UI render.
//
// With opts.companies, also resolve each contributor's employer via the shared
// profiles service and attach a "which company invested most" breakdown. That
// step fetches wp.org profiles (slower, cached), so it is opt-in.
export async function contributorsReport(opts = {}) {
  const window = resolveWindow(opts);
  const data = await fetchContributors({ since: window.since, until: window.until });
  const report = { window, ...data };
  if (opts.companies) report.companies = await companyBreakdown(data.byContributor);
  return report;
}
