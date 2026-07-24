import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMarketplace } from '../src/marketplace.mjs';

test('getMarketplace returns the curated (local) registry', async () => {
  const m = await getMarketplace();
  assert.equal(m.source, 'local');
  assert.ok(Array.isArray(m.tools));
  assert.ok(m.tools.some((t) => t.id === 'changelog' && t.verified === true));
});
