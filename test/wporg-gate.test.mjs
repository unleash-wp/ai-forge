import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Which commands the wordpress.org gate is for, and which it was never for.
 *
 * The gate ran on every plugin command. That looked conservative and was not: it
 * blocked `contributors ingest-profiles`, whose entire job is to fetch the
 * GitHub-login-to-wordpress.org mapping that turns the contributor count from an
 * upper bound (`identityGap`) into a count. That command asks Trac nothing --
 * ticket activity is fetched only under `opts.tickets`, which it does not set --
 * and the lookup endpoint it does use is public. So the report kept saying "this
 * number is an upper bound" because the fix for it was gated on a credential the
 * fix has no use for.
 *
 * Both cases run with UWP_OFFLINE=1, which makes them hermetic: `ingest-profiles`
 * refuses on that flag as its FIRST act, so reaching that refusal is proof the
 * gate let it through, and nothing is fetched either way.
 *
 * HOME and XDG_CONFIG_HOME point at an empty directory so a cookie saved on the
 * developer's own machine cannot make the BELL case pass for the wrong reason.
 */

const CLI = fileURLToPath(new URL('../bin/ai-forge.mjs', import.meta.url));

function runCli(args) {
  const empty = mkdtempSync(join(tmpdir(), 'forge-nocookie-'));
  const env = { ...process.env, HOME: empty, XDG_CONFIG_HOME: empty, UWP_OFFLINE: '1' };
  delete env.WPORG_TRAC_COOKIE;
  // Both streams, on purpose. The CLI writes progress and refusals to stderr and
  // only the report itself to stdout, so a harness that reads stdout alone sees a
  // successful run as an empty one -- which is how the first draft of this test
  // reported a passing command as a failure.
  const r = spawnSync(process.execPath, [CLI, ...args], { env, encoding: 'utf8' });
  return { code: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

test('BELL: a command that reads Trac still refuses without a wordpress.org cookie', () => {
  // Unchanged behaviour, and the point of keeping the default. `changelog` reads
  // Trac directly (lib/trac-tickets.mjs), and Trac without a session serves a bot
  // wall -- so a number produced without the cookie would be wrong while looking
  // right.
  const { code, out } = runCli(['changelog', '--since', '2026-06-01', '--until', '2026-06-30']);
  assert.notEqual(code, 0);
  assert.match(out, /wordpress\.org connection required/);
});

test('SILENCE: ingest-profiles runs without a cookie, because it never asks Trac', () => {
  // It must get PAST the gate and reach its own UWP_OFFLINE refusal. If the gate
  // still fired we would see the connection message instead, and the hosted
  // instance would keep reporting identityGap forever.
  //
  // Note the invocation: `ingest-profiles` is a top-level command, not a
  // subcommand of `contributors`. Dispatch matches only the FIRST positional, so
  // `contributors ingest-profiles` runs the reporting command and passes
  // "ingest-profiles" along as its `since` -- a different command, no error. The
  // warm-cache job called it that way.
  const { out } = runCli(['ingest-profiles', '--month', '2026-06']);
  assert.doesNotMatch(out, /wordpress\.org connection required/);
  assert.match(out, /UWP_OFFLINE is set/);
});

test('BELL: the warm-cache job invokes ingest-profiles by its real name', () => {
  // The wrong spelling is silent -- it runs the reporting command and exits 0 --
  // so nothing but a check on the text catches it.
  const wf = readFileSync(new URL('../.github/workflows/warm-cache.yml', import.meta.url), 'utf8');
  const calls = [...wf.matchAll(/ai-forge\.mjs\s+([a-z-]+)(?:\s+([a-z-]+))?/g)];
  assert.ok(calls.length > 0, 'the workflow calls the CLI at all');
  for (const [, first, second] of calls) {
    assert.notEqual(
      `${first} ${second ?? ''}`.trim(),
      'contributors ingest-profiles',
      'ingest-profiles is a top-level command, not a subcommand of contributors',
    );
  }
  assert.ok(
    calls.some(([, first]) => first === 'ingest-profiles'),
    'the job still warms profiles',
  );
});

test('the opt-out is explicit, so a new command inherits the gate', () => {
  // A command that declares nothing keeps today's behaviour. Skipping the gate is
  // something a command has to say out loud, near the code that proves it.
  return import('../plugins/contributors/server.mjs').then((mod) => {
    const cmds = mod.default?.commands ?? mod.commands ?? [];
    const ingest = cmds.find((c) => c.name === 'ingest-profiles');
    const report = cmds.find((c) => c.name === 'contributors');
    assert.ok(ingest, 'ingest-profiles command is registered');
    assert.equal(ingest.needsWporg, false);
    assert.notEqual(report?.needsWporg, false, 'the reporting command keeps the gate');
  });
});
