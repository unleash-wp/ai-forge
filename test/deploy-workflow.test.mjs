/**
 * The remote half of the Forge deploy is ONE double-quoted argument to ssh.
 *
 * An unescaped double quote inside it ends the argument; the runner reads what
 * follows as its own words and operators, and everything after that point is
 * never sent to the server -- while the step still exits 0.
 *
 * This is not a hypothetical. The lumo-pro deploy beside this one ran green for
 * a day while deploying nothing, because a comment read
 *
 *     # with "|| true" and only discovering at the end that
 *
 * The server received 2331 bytes of a 6866-byte script, ending mid-comment. The
 * migration, the build swap, the restart and the health check simply did not
 * exist, and `true` returned 0 in their place. A green deploy that changes
 * nothing removes the very signal that would make someone look.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workflowPath = join(repoRoot, '.github/workflows/deploy-forge.yml');

/** Every `"` in the line not preceded by a backslash. */
function unescapedQuotes(line) {
  const cols = [];
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '"' && line[i - 1] !== '\\') cols.push(i);
  }
  return cols;
}

function sshScriptLines() {
  const lines = readFileSync(workflowPath, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.trimEnd().endsWith('"set -euo pipefail'));
  assert.ok(start > -1, 'the ssh script no longer starts with "set -euo pipefail');
  const end = lines.findIndex((l, i) => i > start && l.trimEnd().endsWith(`OK ====='"`));
  assert.ok(end > start, 'the ssh script no longer ends with the success echo');

  const slice = lines.slice(start, end + 1);
  // Drop the opening and closing quote characters themselves.
  slice[0] = slice[0].replace(/"set -euo pipefail$/, 'set -euo pipefail');
  slice[slice.length - 1] = slice[slice.length - 1].replace(/"$/, '');
  return slice;
}

test('the deploy ssh script contains no unescaped double quote', { skip: !existsSync(workflowPath) }, () => {
  const offenders = sshScriptLines()
    .filter((line) => unescapedQuotes(line).length > 0)
    .map((line) => `  ${line.trim()}`);

  assert.deepEqual(
    offenders,
    [],
    'These lines close the ssh argument early. Escape as \\" or reword:\n' + offenders.join('\n'),
  );
});

test('the steps that must reach the server are inside the argument', { skip: !existsSync(workflowPath) }, () => {
  // The truncation was invisible because the lost commands stopped existing.
  // Name them, so losing them fails here instead of in production.
  const script = sshScriptLines().join('\n');
  for (const required of [
    'npm install --omit=dev',
    'mv dist.incoming dist',
    'mittnitectl job restart forge',
    '__FORGE_TOKEN__',
    'FORGE DEPLOY OK',
  ]) {
    assert.ok(script.includes(required), `${required} is not inside the ssh argument`);
  }
});

test('SILENCE: an escaped quote is allowed', () => {
  assert.deepEqual(unescapedQuotes('HEALTH_PORT=\\"\\${PORT:-3000}\\"'), []);
  assert.equal(unescapedQuotes('# with "|| true" and').length, 2);
});
