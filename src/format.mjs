const GB = 'https://github.com/WordPress/gutenberg';
const TRAC = 'https://core.trac.wordpress.org';

// Full technical report: summary table, sources, grouped changelog, contributors.
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

  out.push('## Sources', '', ...sourcesLines(meta), '');
  out.push(...gutenbergSection(report, gbBranch));
  out.push(...coreSection(report, coreBranch));
  out.push(...contributorsSection(report, t.contributors));

  return out.join('\n');
}

// Ready-to-edit release post: the "What's in WordPress x.y Beta N?" template a
// coordinator can fill in - deterministic count line + canonical source links +
// a highlights placeholder, backed by the grouped changelog as raw material.
export function toPost(report, meta) {
  const { since, until, milestone } = meta;
  const t = report.totals;
  const d1 = since.slice(0, 10);
  const issues = t.coreTickets + t.gutenbergPRs;
  const out = [];

  out.push(`# What's in WordPress ${milestone || '<x.y>'} <!-- Beta/RC N -->?`);
  out.push('');
  out.push(`For technical details on the more than ${issues} issues addressed since <!-- previous build -->, see the following links:`);
  out.push('');
  out.push(...sourcesLines(meta).map((l) => `${l.replace(/ - .*/, '')} since ${d1}`));
  out.push('');
  out.push('<!-- HIGHLIGHTS: 1–3 short paragraphs on the notable changes.');
  out.push('     Every sentence must link a real PR/ticket from the lists below.');
  out.push('     Prefer Gutenberg [Feature] PRs and Core dev-note / field-guide tickets. -->');
  out.push('');
  out.push('## Notable changes (raw material - trim to what matters)');
  out.push('');
  out.push(...gutenbergSection(report, meta.gbBranch));
  out.push(...coreSection(report, meta.coreBranch));
  out.push(...contributorsSection(report, t.contributors));

  return out.join('\n');
}

// The two canonical "trace it yourself" links, with the window + milestone baked
// into the query string. Single source of truth for the Markdown, the post, and
// the browser UI's Sources block.
export function sourceUrls(meta) {
  const { since, until, milestone, gbBranch } = meta;
  const d1 = since.slice(0, 10);
  const d2 = until.slice(0, 10);
  const trac = `${TRAC}/query?status=closed&changetime=${tracDate(d1)}..${tracDate(d2)}` +
    (milestone ? `&milestone=${milestone}` : '') +
    '&group=component&col=id&col=summary&col=component&col=owner&col=type&col=priority&order=id';
  const gutenberg = `${GB}/commits/${gbBranch}?since=${d1}&until=${d2}`;
  return { trac, gutenberg, since: d1, until: d2, milestone, gbBranch };
}

function sourcesLines(meta) {
  const s = sourceUrls(meta);
  return [
    `- [Closed Core Trac tickets](${s.trac})${s.milestone ? ` (milestone ${s.milestone})` : ''} - ${s.since} to ${s.until}`,
    `- [Gutenberg commits](${s.gutenberg}) on \`${s.gbBranch}\` - ${s.since} to ${s.until}`,
  ];
}

function gutenbergSection(report, gbBranch) {
  const out = [`## Gutenberg (\`${gbBranch}\`)`, ''];
  if (report.gutenberg.byCategory) {
    const cats = Object.entries(report.gutenberg.byCategory).sort((a, b) => b[1].length - a[1].length);
    for (const [cat, items] of cats) {
      out.push(`### ${cat} (${items.length})`, '');
      for (const c of items) out.push(gbLine(c));
      out.push('');
    }
  } else if (report.gutenberg.commits.length) {
    for (const c of report.gutenberg.commits) out.push(gbLine(c));
    out.push('');
  } else {
    out.push('_No commits in window._', '');
  }
  return out;
}

function coreSection(report, coreBranch) {
  const tracker = report.core.tracker;
  const out = [`## Core (\`${coreBranch}\`)`, ''];
  if (tracker) {
    out.push(`> Grouped by Trac component via the \`${tracker.slug}\` dev-notes tracker.`);
    if (tracker.stats) {
      out.push(`> Milestone classification: ${Object.entries(tracker.stats).map(([k, v]) => `${v} ${k}`).join(' · ')}.`);
    }
    out.push('');
    const groups = Object.entries(report.core.byComponent).sort((a, b) => {
      if (a[0] === 'Uncategorized') return 1;
      if (b[0] === 'Uncategorized') return -1;
      return b[1].length - a[1].length;
    });
    for (const [component, items] of groups) {
      out.push(`### ${component} (${items.length})`, '');
      for (const c of items) out.push(coreLine(c));
      out.push('');
    }
  } else {
    out.push('> Component grouping needs Trac. Add `--milestone` (dev-notes tracker) or the `wporg-context` MCP (see SKILL.md).', '');
    if (report.core.commits.length) {
      for (const c of report.core.commits) out.push(coreLine(c));
    } else {
      out.push('_No changesets in window._');
    }
    out.push('');
  }
  return out;
}

function contributorsSection(report, count) {
  const all = [...new Set([...report.gutenberg.contributors, ...report.core.contributors])].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  return [`## Contributors (${count})`, '', all.length ? all.join(', ') : '_None found._', ''];
}

// ISO date (YYYY-MM-DD) -> Trac changetime format MM/DD/YYYY.
function tracDate(d) {
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

function gbLine(c) {
  const ref = c.pr ? ` ([#${c.pr}](${GB}/pull/${c.pr}))` : '';
  return `- ${c.subject}${ref} - ${c.author}`;
}

function coreLine(c) {
  const ref = c.changeset ? `[r${c.changeset}](${TRAC}/changeset/${c.changeset})` : `\`${c.shortSha}\``;
  const tix = c.tickets.map((n) => `[#${n}](${TRAC}/ticket/${n})`).join(' ');
  const cls = c.classification ? ` _[${c.classification}]_` : '';
  const props = c.props.length ? ` - props ${c.props.join(', ')}` : '';
  return `- ${ref}: ${c.subject}${cls}${tix ? ' - ' + tix : ''}${props}`;
}
