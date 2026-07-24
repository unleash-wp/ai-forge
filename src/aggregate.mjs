// Combine parsed Gutenberg + Core commits into counts, groupings and contributor lists.
export function buildReport(gb, core, gbLabels) {
  const gbPRs = new Set(gb.map((c) => c.pr).filter(Boolean));
  const coreChangesets = new Set(core.map((c) => c.changeset).filter(Boolean));
  const coreTickets = new Set(core.flatMap((c) => c.tickets));

  // Gutenberg contributors = commit author logins; Core = the "Props" line (SVN commits
  // are all authored by the committer, so the real credit lives in Props).
  const gbContribs = new Set(gb.map((c) => c.author).filter((a) => a && a !== 'unknown'));
  const coreContribs = new Set(core.flatMap((c) => c.props));
  const allContribs = new Set([...gbContribs, ...coreContribs]);

  const byCategory = gbLabels ? groupByLabel(gb, gbLabels) : null;

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

// Prefer the Gutenberg "[Type] X" label, then "[Feature] X", else Uncategorized.
function pickCategory(labels) {
  const type = labels.find((l) => l.startsWith('[Type]'));
  if (type) return type.slice('[Type] '.length);
  const feature = labels.find((l) => l.startsWith('[Feature]'));
  if (feature) return feature.slice('[Feature] '.length);
  return 'Uncategorized';
}

const cmp = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());
