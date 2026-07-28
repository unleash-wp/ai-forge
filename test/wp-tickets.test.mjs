import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ticketActivity } from '../src/lib/wp-tickets.mjs';

test('ticketActivity returns null (no fabrication) when no cookie is available', async () => {
  // An explicit empty cookie skips resolveCookie() and the network entirely.
  const r = await ticketActivity({ since: '2026-06-01', until: '2026-07-28', cookie: '' });
  assert.equal(r, null);
});
