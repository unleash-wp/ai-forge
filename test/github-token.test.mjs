import { test } from 'node:test';
import assert from 'node:assert/strict';
import { githubFetch } from '../src/connectors/github-token.mjs';

test('githubFetch only sends requests to the HTTPS GitHub API', async (t) => {
  const originalFetch = globalThis.fetch;
  let requests = 0;

  globalThis.fetch = async () => {
    requests += 1;
    return {
      ok: true,
      json: async () => ({ ok: true }),
      headers: new Headers(),
    };
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    githubFetch('http://api.github.com/repos/WordPress/gutenberg'),
    /api\.github\.com/,
  );
  await assert.rejects(
    githubFetch('https://elsewhere.example/repos/WordPress/gutenberg'),
    /elsewhere\.example/,
  );
  assert.equal(requests, 0);

  const result = await githubFetch('https://api.github.com/repos/WordPress/gutenberg');
  assert.deepEqual(result, { data: { ok: true }, link: null });
  assert.equal(requests, 1);
});
