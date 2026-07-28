// Text / Markdown renderers for a contributors report.

// The honesty note shown with any company breakdown — partial coverage, and no geo.
function companyNote(coverage) {
  return `Employer known for ${coverage.peopleKnown}/${coverage.peopleTotal} (${coverage.pct}%); the rest are grouped as "Unknown / not listed". Location/geography is not published on wp.org profiles, so it is not included.`;
}

export function toMarkdown(report) {
  const w = report.window;
  const t = report.totals;
  const lines = [
    `## Contributors — ${w.label}`,
    '',
    `**${t.contributors}** contributors · ${t.coreCommits} Core changes · ${t.gutenbergCommits} Gutenberg changes  `,
    `_Window: ${w.since} to ${w.until} (Core + Gutenberg)_`,
    '',
    '| # | Contributor | Contributions | Source |',
    '|--:|-------------|--------------:|--------|',
  ];
  report.byContributor.forEach((c, i) => {
    lines.push(`| ${i + 1} | ${c.name} | ${c.props} | ${c.source} |`);
  });
  if (report.companies) {
    const { byCompany, coverage } = report.companies;
    lines.push('', '### Which company invested most', '', `_${companyNote(coverage)}_`, '',
      '| # | Company | Contributions | People |', '|--:|---------|--------------:|-------:|');
    byCompany.forEach((c, i) => lines.push(`| ${i + 1} | ${c.company} | ${c.contributions} | ${c.people} |`));
  }
  return lines.join('\n');
}

export function toText(report) {
  const w = report.window;
  const t = report.totals;
  const lines = [
    `Contributors — ${w.label}  (${w.since} to ${w.until})`,
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
