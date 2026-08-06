// Text / Markdown renderers for a contributors report.

// The honesty note shown with any company breakdown: partial coverage, and no geo.
function companyNote(coverage) {
  return `Employer known for ${coverage.peopleKnown}/${coverage.peopleTotal} (${coverage.pct}%); the rest are grouped as "Unknown / not listed". Location/geography is not published on wp.org profiles, so it is not included.`;
}

// The report's tables (ranked contributors, tickets, components, companies,
// committers), each capped to `top` rows with a "…and N more" note. Shared by the
// plain report renderer and the Month-in-Core post scaffold.
function tableSections(report, top) {
  const lines = [];
  const more = (arr, shown, unit) => (arr.length > shown ? ['', `_…and ${arr.length - shown} more ${unit}. Raise \`top\` or use \`format=json\` for the full set._`] : []);
  lines.push('| # | Contributor | Contributions | Source |', '|--:|-------------|--------------:|--------|');
  report.byContributor.slice(0, top).forEach((c, i) => lines.push(`| ${i + 1} | ${c.name} | ${c.props} | ${c.source} |`));
  lines.push(...more(report.byContributor, top, 'contributors'));
  if (report.tickets) {
    lines.push('', '### Trac ticket activity', '',
      `**${report.tickets.opened}** opened · **${report.tickets.closed}** closed${report.tickets.closedApprox ? ' (by last change; Trac has no close-date field)' : ''}.`);
  }
  if (report.components && report.components.byComponent?.some((c) => c.component !== 'Uncategorized')) {
    const { byComponent, coverage } = report.components;
    const rows = byComponent.filter((c) => c.component !== 'Uncategorized');
    lines.push('', '### Core changes by component', '', `_Categorized ${coverage.known}/${coverage.total} (${coverage.pct}%) via the ${report.components.slug} tracker._`, '',
      '| Component | Changes |', '|-----------|--------:|');
    rows.slice(0, top).forEach((c) => lines.push(`| ${c.component} | ${c.count} |`));
    lines.push(...more(rows, top, 'components'));
  }
  if (report.companies) {
    const { byCompany, coverage } = report.companies;
    lines.push('', '### Which company invested most (Five for the Future)', '', `_${companyNote(coverage)}_`, '',
      '| # | Company | Contributions | People |', '|--:|---------|--------------:|-------:|');
    byCompany.slice(0, top).forEach((c, i) => lines.push(`| ${i + 1} | ${c.company} | ${c.contributions} | ${c.people} |`));
    lines.push(...more(byCompany, top, 'companies'));
  }
  if (report.committers?.length) {
    lines.push('', '### Core committers', '', '_Who landed the changesets (distinct from Props). Country is not published on wp.org profiles._', '',
      '| # | Account | Name | Company | Since | Commits | % |', '|--:|---------|------|---------|------:|--------:|--:|');
    report.committers.slice(0, top).forEach((c, i) => lines.push(`| ${i + 1} | ${c.login} | ${c.name || ''} | ${c.employer || 'Unknown / not listed'} | ${c.memberSince || 'n/a'} | ${c.commits} | ${c.pct}% |`));
    lines.push(...more(report.committers, top, 'committers'));
  }
  return lines;
}

// Said wherever the contributor count is shown while some GitHub logins are
// still unmatched: the same person can appear twice, so the number is an upper
// bound. One sentence, and it names the fix, because the reader can do nothing
// about it but the operator can.
export function identityGapNote(n) {
  return `_The contributor count is an upper bound: ${n} GitHub ${n === 1 ? 'login is' : 'logins are'} not yet matched to a wordpress.org account, so one person can appear twice. It settles once the profile cache has been warmed._`;
}

// Render the report as Markdown, capping each table to `top` rows (keeps the
// output within an AI's context budget).
export function toMarkdown(report, { top = 25 } = {}) {
  const w = report.window;
  const t = report.totals;
  return [
    `## Contributors · ${w.label}`, '',
    `**${t.contributors}** contributors · ${t.coreCommits} Core changes · ${t.gutenbergCommits} Gutenberg changes  `,
    `_Window: ${w.since} to ${w.until} (Core + Gutenberg)_`, '',
    ...(report.identityGap ? [identityGapNote(report.identityGap), ''] : []),
    ...tableSections(report, top),
  ].join('\n');
}

// A ready-to-edit "Month in Core"-style post scaffold (make.wordpress.org format):
// intro + by-the-numbers + the data tables, with honest notes. Prose highlights are
// left as TODOs so the writer grounds them in real changesets/PRs.
export function monthInCorePost(report, { top = 100 } = {}) {
  const w = report.window;
  const t = report.totals;
  const head = [
    `# A Month in Core: ${w.label}`, '',
    `_Draft scaffold. Replace the prose with highlights you have verified against real changesets/PRs; do not invent features. Window: ${w.since} to ${w.until} (Core + Gutenberg)._`, '',
    '## Highlights', '',
    '- _TODO: 3–5 verified highlights, each linked to a real changeset/PR._', '',
    '## By the numbers', '',
    `- **${t.coreCommits}** Core changesets · **${t.gutenbergCommits}** Gutenberg merges · **${t.contributors}** contributors`,
    ...(report.tickets ? [`- **${report.tickets.opened}** Trac tickets opened · **${report.tickets.closed}** closed`] : []),
    '',
    '_Countries/geography are not published on wp.org profiles, so they are omitted here (the official post compiles those from internal data)._', '',
    '## Details', '',
  ];
  return [...head, ...tableSections(report, top)].join('\n');
}

// A shallow copy of the report with each list capped to `top` entries + a `caps`
// summary, so a JSON MCP response stays within the agent's context budget. The
// per-entry `items` arrays (up to 100 commit records each - a UI affordance) are
// dropped: they blow the budget and a model ranking contributors/companies never
// needs them. The UI reads the full report over HTTP, not this.
export function capReport(report, top = 50) {
  const strip = (arr) => (Array.isArray(arr) ? arr.slice(0, top).map(({ items, ...rest }) => rest) : arr);
  const out = { ...report, byContributor: strip(report.byContributor) };
  if (report.committers) out.committers = strip(report.committers);
  if (report.companies) out.companies = { ...report.companies, byCompany: report.companies.byCompany.slice(0, top) };
  if (report.components) out.components = { ...report.components, byComponent: report.components.byComponent.slice(0, top) };
  out.caps = {
    top,
    contributors: report.byContributor?.length ?? 0,
    committers: report.committers?.length ?? 0,
    companies: report.companies?.byCompany?.length ?? 0,
    components: report.components?.byComponent?.length ?? 0,
    note: 'Lists are capped to `top` and per-entry commit `items` are omitted. Raise `top` for more rows; totals are exact. The browser UI has the full detail.',
  };
  return out;
}

export function toText(report) {
  const w = report.window;
  const t = report.totals;
  const lines = [
    `Contributors · ${w.label}  (${w.since} to ${w.until})`,
    `${t.contributors} contributors · ${t.coreCommits} Core · ${t.gutenbergCommits} Gutenberg`,
    '',
  ];
  const wName = Math.min(28, report.byContributor.reduce((m, c) => Math.max(m, c.name.length), 4));
  report.byContributor.forEach((c, i) => {
    lines.push(`${String(i + 1).padStart(3)}. ${c.name.padEnd(wName)}  ${String(c.props).padStart(3)}  ${c.source}`);
  });
  if (report.companies) {
    const { byCompany, coverage } = report.companies;
    lines.push('', `Which company invested most  (employer known ${coverage.pct}%):`);
    byCompany.slice(0, 15).forEach((c, i) => {
      lines.push(`${String(i + 1).padStart(3)}. ${c.company.padEnd(28)}  ${String(c.contributions).padStart(4)}  (${c.people} ppl)`);
    });
  }
  return lines.join('\n');
}
