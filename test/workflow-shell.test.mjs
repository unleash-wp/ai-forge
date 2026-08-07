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

/**
 * A block's executable lines only.
 *
 * Every text rule in this file has fired on the paragraph explaining itself, in
 * three separate sittings. A comment is not run, in YAML or in shell, so strip
 * comments once here rather than remembering to at each rule.
 */
function code(body) {
  return body
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('#'))
    .join('\n');
}

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

test('BELL: no inline interpreter program inside a remote script', { skip: !existsSync(dir) }, () => {
  // `node -e '<program>'` in the remote half of the warm job received only the
  // word "let" on the server and died with "ReferenceError: let is not defined".
  //
  // Checked, because the obvious explanation was wrong: extracting the step and
  // stubbing ssh shows the program arriving character for character, and it runs
  // correctly here. So the mangling happens in the remote node invocation, and
  // the remote node is not ours to assume.
  //
  // The damage was not the crash. A trailing `|| REMAINING=0` turned it into a
  // measured zero, and the job refused to warm on a number nobody had measured.
  // Use the tools the script already depends on, and read what a header gives
  // you rather than parsing a body.
  const offenders = runBlocks()
    .filter(({ body }) => body.includes("<<'REMOTE'"))
    .flatMap(({ file, body }) =>
      body
        .split('\n')
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter((r) => !r.line.startsWith('#') && /\b(?:node|python3?|ruby|perl)\s+-[ec]\b/.test(r.line))
        .map((r) => `  ${file} (remote line ${r.n})  ${r.line.slice(0, 90)}`),
    );

  assert.deepEqual(
    offenders,
    [],
    `These ship a quoted program to an interpreter we do not control:\n${offenders.join('\n')}`,
  );
});

test('BELL: an unreadable rate limit is not compared as a number', { skip: !existsSync(dir) }, () => {
  // The failure that cost a run was not the crash, it was `|| REMAINING=0`
  // turning a crash into a measurement and the job refusing on it. So the empty
  // case has to be decided BEFORE the numeric comparison, and decided as its own
  // outcome -- the same line the download path draws between 503 (no answer was
  // obtained) and 403 (an answer was obtained and it was no).
  //
  // This is positional, not behavioural: it proves the check is there and comes
  // first, not that it behaves. Running the branch for real needs the remote
  // host. Stated rather than implied, so nobody reads more into a green tick
  // than it earned.
  // By content, not by file: warm-cache.yml has three run: blocks and the first
  // of them configures ssh. Picking the file rather than the block is how this
  // assertion passed vacuously on its first draft.
  const warm = runBlocks().map((b) => code(b.body)).find((b) => b.includes('REMAINING'));
  assert.ok(warm, 'no block reads the rate limit any more');

  const emptyCheck = warm.indexOf('-z "${REMAINING}"');
  const numericCheck = warm.indexOf('"${REMAINING}" -lt');
  assert.ok(emptyCheck > -1, 'nothing separates an unreadable budget from an empty one');
  assert.ok(numericCheck > -1, 'the budget is no longer compared at all');
  assert.ok(emptyCheck < numericCheck, 'the empty case must be settled before the comparison');
  assert.ok(
    !/\|\|\s*REMAINING=0\b/.test(warm),
    'a failed read must not fall back to a number that reads as measured',
  );
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
