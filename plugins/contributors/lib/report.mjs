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
  const data = await fetchContributors({ since: window.since, until: window.until, coreBranch: opts.coreBranch, gbBranch: opts.gbBranch });
  const report = { window, ...data };
  if (opts.companies) {
    const companies = await companyBreakdown(data.byContributor);
    report.companies = companies;
    // Fold each contributor's employer + avatar back onto byContributor, so the
    // UI can show where a person works and their photo without a second lookup.
    const byName = new Map(companies.resolved.map((r) => [r.name, r]));
    for (const p of report.byContributor) {
      const r = byName.get(p.name);
      if (r) { p.employer = r.employer; p.avatar = r.avatar; p.slug = r.slug; }
    }
  }
  return report;
}
