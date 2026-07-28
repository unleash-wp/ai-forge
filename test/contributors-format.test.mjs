import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMarkdown, toText } from '../plugins/contributors/lib/format.mjs';

const report = {
  window: { since: '2025-10-01', until: '2025-10-31', label: 'October 2025' },
  totals: { contributors: 2, coreCommits: 3, gutenbergCommits: 4 },
  byContributor: [
    { name: 'alice', props: 5, source: 'core' },
    { name: 'bob', props: 2, source: 'gutenberg' },
  ],
};

test('toText lists the window, totals and a ranked leaderboard', () => {
  const out = toText(report);
  assert.match(out, /October 2025/);
  assert.match(out, /2 contributors/);
  assert.match(out, /1\. alice/);
});

test('toMarkdown renders a table and, when present, the company section', () => {
  assert.match(toMarkdown(report), /\| # \| Contributor \| Contributions \| Source \|/);

  const withCo = { ...report, companies: {
    byCompany: [{ company: 'Automattic', contributions: 5, people: 1 }],
    coverage: { peopleKnown: 1, peopleTotal: 2, pct: 50 },
  } };
  const md = toMarkdown(withCo);
  assert.match(md, /Which company invested most/);
  assert.match(md, /Automattic/);
  assert.match(md, /50%/);
});
