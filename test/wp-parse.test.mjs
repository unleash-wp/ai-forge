import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlumbing } from '../src/lib/wp-parse.mjs';

test('release plumbing commits are recognised', () => {
  assert.equal(isPlumbing({ subject: 'WordPress 7.1 Beta 3.' }), true);
  assert.equal(isPlumbing({ subject: 'Bump plugin version to 23.6.0' }), true);
  assert.equal(isPlumbing({ subject: 'Update Changelog for 23.6.0' }), true);
  assert.equal(isPlumbing({ subject: 'chore(release): publish' }), true);
});

test('real changes are not plumbing', () => {
  assert.equal(isPlumbing({ subject: 'Editor: Fix a block crash' }), false);
  assert.equal(isPlumbing({ subject: 'REST API: add a new endpoint' }), false);
});
