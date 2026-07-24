const GB = 'https://github.com/WordPress/gutenberg';
const TRAC = 'https://core.trac.wordpress.org';

export function toMarkdown(report, meta) {
  const { since, until, milestone, gbBranch, coreBranch } = meta;
  const t = report.totals;
  const out = [];

  out.push(`# WordPress ${milestone ? milestone + ' ' : ''}release changes`);
  out.push('');
  out.push(`**Window:** ${since} → ${until}`);
  out.push('');
  out.push('## Summary');
  out.push('');
  out.push('| Metric | Count |');
  out.push('| --- | ---: |');
  out.push(`| Gutenberg commits (\`${gbBranch}\`) | ${t.gutenbergCommits} |`);
  out.push(`| Gutenberg merged PRs | ${t.gutenbergPRs} |`);
  out.push(`| Core changesets (\`${coreBranch}\`) | ${t.coreChangesets} |`);
  out.push(`| Core tickets closed | ${t.coreTickets} |`);
  out.push(`| Contributors (union) | ${t.contributors} |`);
  out.push('');

  out.push(`## Gutenberg (\`${gbBranch}\`)`);
  out.push('');
  if (report.gutenberg.byCategory) {
    const cats = Object.entries(report.gutenberg.byCategory).sort((a, b) => b[1].length - a[1].length);
    for (const [cat, items] of cats) {
      out.push(`### ${cat} (${items.length})`);
      out.push('');
      for (const c of items) out.push(gbLine(c));
      out.push('');
    }
  } else if (report.gutenberg.commits.length) {
    for (const c of report.gutenberg.commits) out.push(gbLine(c));
    out.push('');
  } else {
    out.push('_No commits in window._');
    out.push('');
  }

  out.push(`## Core (\`${coreBranch}\`)`);
  out.push('');
  out.push('> Component / milestone grouping needs Trac. Enrich with the Automattic `mcp-context-wporg` MCP (see SKILL.md).');
  out.push('');
  if (report.core.commits.length) {
    for (const c of report.core.commits) out.push(coreLine(c));
  } else {
    out.push('_No changesets in window._');
  }
  out.push('');

  const all = [...new Set([...report.gutenberg.contributors, ...report.core.contributors])].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  out.push(`## Contributors (${t.contributors})`);
  out.push('');
  out.push(all.length ? all.join(', ') : '_None found._');
  out.push('');

  return out.join('\n');
}

function gbLine(c) {
  const ref = c.pr ? ` ([#${c.pr}](${GB}/pull/${c.pr}))` : '';
  return `- ${c.subject}${ref} — ${c.author}`;
}

function coreLine(c) {
  const ref = c.changeset ? `[r${c.changeset}](${TRAC}/changeset/${c.changeset})` : `\`${c.shortSha}\``;
  const tix = c.tickets.map((n) => `[#${n}](${TRAC}/ticket/${n})`).join(' ');
  const props = c.props.length ? ` — props ${c.props.join(', ')}` : '';
  return `- ${ref}: ${c.subject}${tix ? ' — ' + tix : ''}${props}`;
}
