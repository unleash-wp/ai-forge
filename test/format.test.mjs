import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceUrls, toMarkdown, toPost } from '../plugins/changelog/lib/format.mjs';

const meta = {
  since: '2026-07-15T00:00:00Z',
  until: '2026-07-22T23:59:59Z',
  milestone: '7.1',
  gbBranch: 'wp/7.1',
  coreBranch: 'trunk',
};

const report = {
  totals: { gutenbergCommits: 2, gutenbergPRs: 2, coreChangesets: 1, coreTickets: 1, contributors: 2 },
  gutenberg: { byCategory: null, commits: [{ subject: 'Add a block', pr: 100, author: 'alice' }], contributors: ['alice'] },
  core: { tracker: null, commits: [{ changeset: 62830, subject: 'REST API fix', tickets: [65682], props: ['bob'], classification: 'dev-note' }], contributors: ['bob'] },
};

test('sourceUrls bakes the window + milestone into the links', () => {
  const s = sourceUrls(meta);
  assert.equal(s.since, '2026-07-15');
  assert.equal(s.until, '2026-07-22');
  assert.equal(s.milestone, '7.1');
  assert.match(s.trac, /milestone=7\.1/);
  assert.match(s.trac, /07\/15\/2026\.\.07\/22\/2026/);
  assert.match(s.gutenberg, /commits\/wp\/7\.1\?since=2026-07-15&until=2026-07-22/);
});

test('sourceUrls encodes reserved milestone characters in the Trac URL', () => {
  const s = sourceUrls({ ...meta, milestone: '6.9 rc1&a' });
  assert.match(s.trac, /milestone=6\.9%20rc1%26a/);
});

test('sourceUrls leaves an ordinary milestone unchanged in the Trac URL', () => {
  const s = sourceUrls(meta);
  assert.match(s.trac, /milestone=7\.1/);
});

test('toMarkdown renders the summary table and both sections', () => {
  const md = toMarkdown(report, meta);
  assert.match(md, /# WordPress 7\.1 release changes/);
  assert.match(md, /Core changesets \(`trunk`\) \| 1/);
  assert.match(md, /\[r62830\]/);
  assert.match(md, /by bob/);
  assert.match(md, /_\[dev-note\]_/);
  assert.match(md, /## Contributors \(2\)/);
});

test('toPost renders the fill-in release-post template', () => {
  const post = toPost(report, meta);
  assert.match(post, /What's in WordPress 7\.1/);
  assert.match(post, /changes that landed/);
});
