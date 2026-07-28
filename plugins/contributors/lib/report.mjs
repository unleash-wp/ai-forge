import { fetchContributors } from '../../../src/lib/wp-contributors.mjs';
import { companyBreakdown, enrichCommitters } from '../../../src/lib/wp-profiles.mjs';
import { ticketActivity } from '../../../src/lib/wp-tickets.mjs';
import { resolveWindow } from './quarters.mjs';

const shiftMonths = (iso, months) => { const d = new Date(iso); d.setUTCMonth(d.getUTCMonth() - months); return d.toISOString().slice(0, 10); };
const dayBefore = (iso) => { const d = new Date(iso); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

// Orchestrate: resolve the period window, then pull Core + Gutenberg contributors
// through the shared Core service (src/lib/wp-contributors.mjs) so the counts
// match the changelog plugin. Returns the report the CLI / MCP / UI render.
//
// With opts.companies, also resolve each contributor's employer via the shared
// profiles service and attach a "which company invested most" breakdown. That
// step fetches wp.org profiles (slower, cached), so it is opt-in.
export async function contributorsReport(opts = {}) {
  const window = resolveWindow(opts);
  const data = await fetchContributors({ since: window.since, until: window.until, coreBranch: opts.coreBranch, gbBranch: opts.gbBranch, components: opts.components });
  const report = { window, ...data };
  // Enrich the Core committers with employer + join year from their profiles.
  if (opts.committers && report.committers?.length) {
    report.committers = await enrichCommitters(report.committers);
  }
  // Trac ticket activity (opened/closed) - cookie-gated; null without a cookie.
  if (opts.tickets) {
    report.tickets = await ticketActivity({ since: window.since, until: window.until }).catch(() => null);
  }
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

// First-time contributors, loaded separately so the main report stays fast. Pulls
// the contributor set for the `months` before the report window; the caller flags
// anyone in the window who is NOT in that prior set as new. Honest approximation:
// "no merged contribution in the prior N months", not "first ever".
export async function priorContributors(opts = {}) {
  const window = resolveWindow(opts);
  const months = Number(opts.months) || 12;
  const since = shiftMonths(window.since, months);
  const until = dayBefore(window.since);
  const data = await fetchContributors({ since, until, coreBranch: opts.coreBranch, gbBranch: opts.gbBranch });
  return { since, until, months, names: data.byContributor.map((p) => p.name) };
}
