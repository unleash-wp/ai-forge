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

  out.push('## Sources');
  out.push('');
  const d1 = since.slice(0, 10);
  const d2 = until.slice(0, 10);
  const tracUrl = `${TRAC}/query?status=closed&changetime=${tracDate(d1)}..${tracDate(d2)}` +
    (milestone ? `&milestone=${milestone}` : '') +
    '&group=component&col=id&col=summary&col=component&col=owner&col=type&col=priority&order=id';
  out.push(`- [Closed Core Trac tickets](${tracUrl})${milestone ? ` (milestone ${milestone})` : ''} — ${d1} to ${d2}`);
  out.push(`- [Gutenberg commits](${GB}/commits/${gbBranch}?since=${d1}&until=${d2}) on \`${gbBranch}\` — ${d1} to ${d2}`);
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

  const tracker = report.core.tracker;
  out.push(`## Core (\`${coreBranch}\`)`);
  out.push('');
  if (tracker) {
    out.push(`> Grouped by Trac component via the \`${tracker.slug}\` dev-notes tracker.`);
    if (tracker.stats) {
      const s = tracker.stats;
      out.push(`> Milestone classification: ${Object.entries(s).map(([k, v]) => `${v} ${k}`).join(' · ')}.`);
    }
    out.push('');
    const groups = Object.entries(report.core.byComponent).sort((a, b) => {
      if (a[0] === 'Uncategorized') return 1;
      if (b[0] === 'Uncategorized') return -1;
      return b[1].length - a[1].length;
    });
    for (const [component, items] of groups) {
      out.push(`### ${component} (${items.length})`);
      out.push('');
      for (const c of items) out.push(coreLine(c));
      out.push('');
    }
  } else {
    out.push('> Component grouping needs Trac. Add `--milestone` (dev-notes tracker) or the `wporg-context` MCP (see SKILL.md).');
    out.push('');
    if (report.core.commits.length) {
      for (const c of report.core.commits) out.push(coreLine(c));
    } else {
      out.push('_No changesets in window._');
    }
    out.push('');
  }

  const all = [...new Set([...report.gutenberg.contributors, ...report.core.contributors])].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  out.push(`## Contributors (${t.contributors})`);
  out.push('');
  out.push(all.length ? all.join(', ') : '_None found._');
  out.push('');

  return out.join('\n');
}

// ISO date (YYYY-MM-DD) -> Trac changetime format MM/DD/YYYY.
function tracDate(d) {
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

function gbLine(c) {
  const ref = c.pr ? ` ([#${c.pr}](${GB}/pull/${c.pr}))` : '';
  return `- ${c.subject}${ref} — ${c.author}`;
}

function coreLine(c) {
  const ref = c.changeset ? `[r${c.changeset}](${TRAC}/changeset/${c.changeset})` : `\`${c.shortSha}\``;
  const tix = c.tickets.map((n) => `[#${n}](${TRAC}/ticket/${n})`).join(' ');
  const cls = c.classification ? ` _[${c.classification}]_` : '';
  const props = c.props.length ? ` — props ${c.props.join(', ')}` : '';
  return `- ${ref}: ${c.subject}${cls}${tix ? ' — ' + tix : ''}${props}`;
}
