import { fetchContributors } from '../../../src/lib/wp-contributors.mjs';
import { companyBreakdown, enrichCommitters, resolveIdentities } from '../../../src/lib/wp-profiles.mjs';
import { ticketActivity } from '../../../src/lib/wp-tickets.mjs';
import { resolveWindow } from './quarters.mjs';

const shiftMonths = (iso, months) => {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1); // avoid month-length overflow (e.g. Mar 31 minus 1 month)
  d.setUTCMonth(d.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
};
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
  // Merge GitHub-vs-wp.org duplicate identities (e.g. GitHub "t-hamano" == wp.org
  // "wildworks") by default, so counts are correct in the UI, CLI and MCP alike.
  // Opt out with identities:false to skip the wp.org slug lookups.
  if (opts.identities !== false) {
    report.byContributor = await resolveIdentities(data.byContributor);
    report.totals = { ...report.totals, contributors: report.byContributor.length };
  }
  if (opts.companies) {
    const companies = await companyBreakdown(report.byContributor);
    report.companies = companies;
    // Fold employer + avatar (+ slug) back onto byContributor by index (resolved is
    // index-aligned), so the UI shows employer/photo without a second lookup.
    companies.resolved.forEach((r, i) => {
      report.byContributor[i].employer = r.employer;
      report.byContributor[i].avatar = r.avatar;
      report.byContributor[i].slug = r.slug;
    });
    // Drop the index-aligned intermediate now it's folded in: nothing downstream
    // reads it, and it's the whole per-person profile set (~270 KB) that would
    // otherwise bloat every HTTP report and MCP JSON response.
    delete report.companies.resolved;
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
  // Resolve to canonical wp.org slugs so first-timer matching lines up with the
  // (identity-merged) report, not raw GitHub logins.
  const merged = await resolveIdentities(data.byContributor);
  return { since, until, months, names: merged.map((p) => p.slug) };
}
