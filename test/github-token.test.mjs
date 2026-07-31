import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// Stub fetch so no real network requests are made.
const fetchMock = mock.fn(async () => { throw new Error('fetch should not be called'); });
global.fetch = fetchMock;

// Stub the net module's timeoutSignal so there are no side-effects.
import { register } from 'node:module';

// Import after stubbing global.fetch.
const { githubFetch } = await import('../src/connectors/github-token.mjs');

test('githubFetch rejects http:// even for api.github.com', async () => {
  fetchMock.mock.resetCalls();
  await assert.rejects(
    () => githubFetch('http://api.github.com/repos/foo/bar'),
    (err) => {
      assert.ok(err.message.includes('api.github.com'), `expected hostname in message, got: ${err.message}`);
      return true;
    },
  );
  assert.equal(fetchMock.mock.calls.length, 0, 'fetch must not be called');
});

test('githubFetch rejects https:// pointing at a different host', async () => {
  fetchMock.mock.resetCalls();
  await assert.rejects(
    () => githubFetch('https://elsewhere.example/steal-token'),
    (err) => {
      assert.ok(err.message.includes('elsewhere.example'), `expected hostname in message, got: ${err.message}`);
      return true;
    },
  );
  assert.equal(fetchMock.mock.calls.length, 0, 'fetch must not be called');
});

test('githubFetch forwards a valid https://api.github.com URL to fetch', async () => {
  // Replace stub with a successful mock response for this test only.
  const goodFetch = mock.fn(async () => ({
    ok: true,
    json: async () => ({ ok: true }),
    headers: { get: () => null },
  }));
  global.fetch = goodFetch;

  const result = await githubFetch('https://api.github.com/rate_limit');
  assert.deepEqual(result.data, { ok: true });
  assert.equal(goodFetch.mock.calls.length, 1);

  // Restore fail-stub for any subsequent tests.
  global.fetch = fetchMock;
});
