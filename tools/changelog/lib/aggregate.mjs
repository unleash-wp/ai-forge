// Combine parsed Gutenberg + Core commits into counts, groupings and contributor lists.
export function buildReport(gb, core, gbLabels, tracker = null) {
  const gbPRs = new Set(gb.map((c) => c.pr).filter(Boolean));
  const coreChangesets = new Set(core.map((c) => c.changeset).filter(Boolean));
  const coreTickets = new Set(core.flatMap((c) => c.tickets));

  // Gutenberg contributors = commit author logins; Core = the "Props" line (SVN commits
  // are all authored by the committer, so the real credit lives in Props).
  const gbContribs = new Set(gb.map((c) => c.author).filter((a) => a && a !== 'unknown'));
  const coreContribs = new Set(core.flatMap((c) => c.props));
  const allContribs = new Set([...gbContribs, ...coreContribs]);

  const byCategory = gbLabels ? groupByLabel(gb, gbLabels) : null;
  const byComponent = tracker ? groupCoreByComponent(core, tracker.map) : null;

  return {
    gutenberg: {
      commits: gb,
      prCount: gbPRs.size,
      byCategory,
      contributors: [...gbContribs].sort(cmp),
    },
    core: {
      commits: core,
      changesetCount: coreChangesets.size,
      ticketCount: coreTickets.size,
      tickets: [...coreTickets].sort((a, b) => a - b),
      contributors: [...coreContribs].sort(cmp),
      byComponent,
      tracker: tracker ? { slug: tracker.slug, stats: tracker.stats } : null,
    },
    totals: {
      gutenbergCommits: gb.length,
      gutenbergPRs: gbPRs.size,
      coreChangesets: coreChangesets.size,
      coreTickets: coreTickets.size,
      contributors: allContribs.size,
    },
  };
}

function groupByLabel(commits, labelMap) {
  const groups = {};
  for (const c of commits) {
    const labels = c.pr ? labelMap.get(c.pr) || [] : [];
    const cat = pickCategory(labels);
    (groups[cat] ||= []).push(c);
  }
  return groups;
}

// Cookie-free deep detail: use each Core commit's own body as its change
// description. The GitHub commit carries a fuller explanation than the ticket
// title, and it is already fetched, so this needs no Trac cookie or extra call.
export function applyCommitBodies(report) {
  for (const c of report.core.commits) {
    if (c.body && !c.description) c.description = c.body;
  }
  report.core.deep = true;
}

// Merge full Trac ticket details (from the MCP) into the report: attach the
// summary to each changeset, fill any missing description, upgrade Uncategorized
// changesets to their real Trac component, and rebuild the component grouping.
// The commit body (applyCommitBodies) wins; Trac only fills gaps.
export function applyDeepDetails(report, details) {
  report.core.ticketDetails = Object.fromEntries(details);
  for (const c of report.core.commits) {
    const hit = c.tickets.map((id) => details.get(id)).find(Boolean);
    if (!hit) continue;
    c.trSummary = hit.summary;
    if (!c.description) c.description = hit.description;
    if (!c.component || c.component === 'Uncategorized') c.component = hit.component || 'Uncategorized';
  }
  const groups = {};
  for (const c of report.core.commits) (groups[c.component || 'Uncategorized'] ||= []).push(c);
  report.core.byComponent = groups;
  report.core.deep = true;
}

function groupCoreByComponent(core, map) {
  const groups = {};
  for (const c of core) {
    const hit = c.tickets.map((id) => map.get(id)).find(Boolean);
    c.component = hit?.component || 'Uncategorized';
    c.classification = hit?.classification || null;
    (groups[c.component] ||= []).push(c);
  }
  return groups;
}

// Prefer the Gutenberg "[Type] X" label, then "[Feature] X", else Uncategorized.
function pickCategory(labels) {
  const type = labels.find((l) => l.startsWith('[Type]'));
  if (type) return type.slice('[Type] '.length);
  const feature = labels.find((l) => l.startsWith('[Feature]'));
  if (feature) return feature.slice('[Feature] '.length);
  return 'Uncategorized';
}

const cmp = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());
