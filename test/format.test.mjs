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

// Split by character class, so a failure names which one broke. And asserted
// both ways: matching the encoded form does not prove the raw form is gone,
// because the parameter could contain both. `&` is the one that matters. Raw,
// it ends the parameter and silently starts another.
//
// Real milestones make this concrete: WordPress Trac ships "Awaiting Review"
// and "Future Release". Unencoded, the space terminates the URL inside the
// Markdown link that sourcesLines() writes, so the "check it yourself" link in
// every report was broken for those.
test('sourceUrls encodes a space in the milestone, and leaves none behind', () => {
  const s = sourceUrls({ ...meta, milestone: 'Awaiting Review' });
  assert.match(s.trac, /&milestone=Awaiting%20Review&group=component/);
  assert.doesNotMatch(s.trac, /milestone=Awaiting Review/);
});

test('sourceUrls encodes an ampersand in the milestone, and leaves none behind', () => {
  const s = sourceUrls({ ...meta, milestone: 'a&b' });
  assert.match(s.trac, /&milestone=a%26b&group=component/);
  assert.doesNotMatch(s.trac, /milestone=a&b/);
});

// Silence: an ordinary milestone must pass through untouched, delimiter and
// all. Without the trailing &group= this would also accept 7.1%26anything.
test('sourceUrls leaves an ordinary milestone byte-identical', () => {
  const s = sourceUrls(meta);
  assert.match(s.trac, /&milestone=7\.1&group=component/);
  // The display field stays raw either way. Only the URL carries the escaping.
  assert.equal(s.milestone, '7.1');
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
