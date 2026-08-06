/**
 * An offline host with a cold cache counts one person twice, and has to say so.
 *
 * resolveIdentities folds a Gutenberg GitHub login onto the wp.org username it
 * belongs to (GitHub "t-hamano" is wp.org "wildworks"). The mapping comes from
 * profiles.wordpress.org, which UWP_OFFLINE deliberately never fetches, so on a
 * hosted instance the merge only works for names the warm-up job already cached.
 *
 * Measured against a real read-only server on a cold cache, October 2025:
 * "t-hamano" and "wildworks" both appeared in byContributor, as did "ramonopoly"
 * and "ramonjd", and totals.contributors read 273. The number was not wrong by
 * accident, it was an upper bound presented as a count.
 *
 * The environment is set before the import because UWP_OFFLINE and the cache
 * directory are read once at module level.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'forge-identity-'));
process.env.UWP_OFFLINE = '1';
process.env.UWP_CACHE_DIR = dir;
// One GitHub login already known, so the near-case below is a real distinction
// rather than an empty-cache accident.
writeFileSync(join(dir, 'ghslug-cache-v1.json'), JSON.stringify({ 't-hamano': 'wildworks' }));

const { unresolvedIdentities } = await import('../src/lib/wp-profiles.mjs');

after(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.UWP_OFFLINE;
  delete process.env.UWP_CACHE_DIR;
});

test('BELL: an unmatched GitHub login is counted, so the report can say the total is an upper bound', () => {
  const gap = unresolvedIdentities([
    { name: 'ramonopoly', source: 'gutenberg' },
    { name: 'ramonjd', source: 'core' },
  ]);
  assert.equal(gap, 1);
});

test('SILENCE: a login the warm-up job already cached is not a gap', () => {
  const gap = unresolvedIdentities([
    { name: 't-hamano', source: 'gutenberg' },
    { name: 'wildworks', source: 'core' },
  ]);
  assert.equal(gap, 0);
});

test('SILENCE: pure Core names are wp.org usernames already and are never looked up', () => {
  const gap = unresolvedIdentities([
    { name: 'audrasjb', source: 'core' },
    { name: 'sergeybiryukov', source: 'core' },
  ]);
  assert.equal(gap, 0);
});

test('the same unmatched name twice is one gap, not two', () => {
  const gap = unresolvedIdentities([
    { name: 'ramonopoly', source: 'gutenberg' },
    { name: 'ramonopoly', source: 'both' },
  ]);
  assert.equal(gap, 1);
});
