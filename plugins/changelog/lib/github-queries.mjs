// Changelog plugin: GitHub label queries. The commit fetch and the branch lists
// now live in Core (src/lib/wp-commits.mjs, src/lib/wp-branches.mjs) and are
// re-exported here so this plugin's imports stay unchanged; labels stay local.
// Auth lives in the Core connector's shared authed-fetch primitive (githubFetch).
import { githubFetch } from '../../../src/connectors/github-token.mjs';

export { commits } from '../../../src/lib/wp-commits.mjs';
export { branches } from '../../../src/lib/wp-branches.mjs';

// Label names for a list of issue/PR numbers, fetched with a bounded concurrency pool.
export async function labelsFor(repo, numbers, concurrency = 8) {
  const result = new Map();
  let i = 0;
  async function worker() {
    while (i < numbers.length) {
      const n = numbers[i++];
      try {
        const { data } = await githubFetch(`https://api.github.com/repos/${repo}/issues/${n}/labels`);
        result.set(n, data.map((l) => l.name));
      } catch {
        result.set(n, []);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, numbers.length) }, worker));
  return result;
}
