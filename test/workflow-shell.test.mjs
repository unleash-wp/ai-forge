import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Every `run:` block in every workflow has to be a script bash can parse.
 *
 * This exists because a workflow shipped to main that could not run at all.
 * A half-applied edit left `warm-cache.yml` with
 *
 *     {
 *       printf ...
 *       cat <<'REMOTE'
 *     ... 90 lines ...
 *     REMOTE
 *
 * and no closing brace, no pipe and NO ssh invocation. The job could never have
 * reached the server. Nothing caught it: the tests beside this one match text,
 * and CI runs the app's suite, not the workflows. It was only found by reading
 * the file for an unrelated reason.
 *
 * Two lessons, both cheap to encode. A workflow is code, so parse it like code.
 * And an unreachable step is invisible in exactly the way a green-but-inert
 * deploy is -- the failure mode this whole repo keeps rediscovering.
 *
 * `bash -n` parses without executing, so nothing here runs a command.
 */

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '.github/workflows');

/** Each `run: |` body, dedented, with its workflow name and line number. */
function runBlocks() {
  const out = [];
  for (const file of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (!/run: \|\s*$/.test(lines[i])) continue;
      const indent = lines[i].length - lines[i].trimStart().length + 2;
      const body = [];
      for (const line of lines.slice(i + 1)) {
        if (line.trim() === '') { body.push(''); continue; }
        if (line.length - line.trimStart().length < indent) break;
        body.push(line.slice(indent));
      }
      out.push({ file, line: i + 1, body: body.join('\n') });
    }
  }
  return out;
}

test('the workflow directory is where it is expected', { skip: !existsSync(dir) }, () => {
  // Guards the guard. An empty list would make the assertion below vacuous, and
  // a vacuous check is what this file is about.
  const blocks = runBlocks();
  assert.ok(blocks.length > 5, `expected several run: blocks, found ${blocks.length}`);
});

test('BELL: every run: block parses as bash', { skip: !existsSync(dir) }, () => {
  const broken = [];
  for (const { file, line, body } of runBlocks()) {
    const r = spawnSync('bash', ['-n'], { input: body, encoding: 'utf8' });
    if (r.status !== 0) broken.push(`  ${file}:${line}\n${r.stderr.trim()}`);
  }
  assert.deepEqual(broken, [], `These run: blocks cannot run:\n${broken.join('\n')}`);
});

test('BELL: a step that means to reach the server actually invokes ssh', { skip: !existsSync(dir) }, () => {
  // The specific shape of the bug above: the script survived, the transport did
  // not. A heredoc named REMOTE is only ever there to be fed to a remote shell,
  // so its block has to call one.
  const orphans = runBlocks()
    .filter(({ body }) => body.includes("<<'REMOTE'") && !/\bssh\b/.test(body))
    .map(({ file, line }) => `  ${file}:${line}`);

  assert.deepEqual(
    orphans,
    [],
    `These build a remote script and never send it:\n${orphans.join('\n')}`,
  );
});
