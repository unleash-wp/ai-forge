import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommit } from '../src/parse.mjs';

const mk = (message) => parseCommit({
  sha: 'abc123def456',
  commit: { message, author: { name: 'committer', date: '2026-07-10T00:00:00Z' } },
  html_url: 'https://example.test/c',
  author: { login: 'alice' },
});

test('a single Fixes closes one ticket', () => {
  assert.deepEqual(mk('Editor: X.\n\nFixes #12345.\n\ngit-svn-id: svn://x@62800 y').tickets, [12345]);
});

test('one commit can close several tickets in a comma/and list', () => {
  assert.deepEqual(mk('REST API: Y.\n\nFixes #100, #101, #102.\n\ngit-svn-id: svn://x@62801 y').tickets, [100, 101, 102]);
  assert.deepEqual(mk('Comp: Z.\n\nCloses #200 and #201.\n\ngit-svn-id: svn://x@62802 y').tickets, [200, 201]);
});

test('a trailing "see" reference is not counted as fixed', () => {
  const c = mk('Comp: W.\n\nCloses #300, see #301.\n\ngit-svn-id: svn://x@62803 y');
  assert.deepEqual(c.tickets, [300]);
  assert.deepEqual(c.seeTickets, [301]);
});

test('changeset and props are parsed from the SVN trailer', () => {
  const c = mk('Comp: V.\n\nProps bob, carol.\nFixes #400.\n\ngit-svn-id: https://develop.svn.wordpress.org/trunk@62804 abc');
  assert.equal(c.changeset, 62804);
  assert.deepEqual(c.props, ['bob', 'carol']);
});
