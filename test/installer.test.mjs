import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { installArchive, uninstall, parseSource, syncCommunityUi } from '../src/installer.mjs';

test('parseSource accepts github: and https github URLs', () => {
  assert.deepEqual(parseSource('github:you/my-tool'), { owner: 'you', repo: 'my-tool' });
  assert.deepEqual(parseSource('https://github.com/you/my-tool'), { owner: 'you', repo: 'my-tool' });
  assert.deepEqual(parseSource('https://github.com/you/my-tool.git'), { owner: 'you', repo: 'my-tool' });
  assert.equal(parseSource('not a repo'), null);
});

test('installArchive extracts, validates and installs a plugin; uninstall removes it', () => {
  const work = mkdtempSync(join(tmpdir(), 'forge-test-'));
  const toolsDir = join(work, 'tools');
  mkdirSync(toolsDir, { recursive: true });

  // build a fixture plugin folder: fixture/my-tool/{plugin.json,client.jsx}
  const src = join(work, 'fixture');
  const pdir = join(src, 'my-tool');
  mkdirSync(pdir, { recursive: true });
  writeFileSync(join(pdir, 'plugin.json'), JSON.stringify({ id: 'my-tool', name: 'My Tool', version: '0.1.0' }));
  writeFileSync(join(pdir, 'client.jsx'), 'export default function T(){return null;}\n');
  const tarball = join(work, 'plugin.tar.gz');
  const tar = spawnSync('tar', ['-czf', tarball, '-C', src, 'my-tool']);
  assert.equal(tar.status, 0, 'fixture tar created');

  const manifest = installArchive(tarball, 'tar', { toolsDir });
  assert.equal(manifest.id, 'my-tool');
  assert.ok(existsSync(join(toolsDir, 'my-tool', 'plugin.json')));
  assert.ok(existsSync(join(toolsDir, 'my-tool', 'client.jsx')));

  uninstall('my-tool', { toolsDir });
  assert.ok(!existsSync(join(toolsDir, 'my-tool')));

  rmSync(work, { recursive: true, force: true });
});

test('uninstall rejects unsafe ids', () => {
  assert.throws(() => uninstall('../etc'), /invalid tool id/);
  assert.throws(() => uninstall('a/b'), /invalid tool id/);
});

// ---------------------------------------------------------------------------
// A community plugin must not take a bundled tool's id.
//
// loadPlugins() scans the user dir after the bundled one and the last writer
// wins, so the copy answered the shipped tool's routes, MCP tools and skills.
// It was invisible (syncCommunityUi skips bundled ids, so the real panel kept
// rendering) and permanent (uninstall() refuses bundled ids, so the app could
// not take it back out).
// ---------------------------------------------------------------------------

function fixtureTarball(work, id, extra = {}) {
  const src = join(work, 'fixture-' + id);
  const pdir = join(src, id);
  mkdirSync(pdir, { recursive: true });
  writeFileSync(join(pdir, 'plugin.json'), JSON.stringify({ id, name: 'T ' + id, version: '0.1.0', ...extra }));
  writeFileSync(join(pdir, 'client.jsx'), 'export default function T(){return null;}\n');
  const tarball = join(work, id + '.tar.gz');
  const tar = spawnSync('tar', ['-czf', tarball, '-C', src, id]);
  assert.equal(tar.status, 0, 'fixture tar created');
  return tarball;
}

test('BELL: a plugin claiming a bundled tool id is refused', () => {
  const work = mkdtempSync(join(tmpdir(), 'forge-test-'));
  const toolsDir = join(work, 'tools');
  mkdirSync(toolsDir, { recursive: true });

  // 'changelog' really ships with the app, so this needs no stubbing.
  const tarball = fixtureTarball(work, 'changelog');
  assert.throws(() => installArchive(tarball, 'tar', { toolsDir }), /ships with the app/);
  assert.ok(!existsSync(join(toolsDir, 'changelog')), 'nothing was written');

  rmSync(work, { recursive: true, force: true });
});

test('SILENCE: an ordinary id still installs', () => {
  const work = mkdtempSync(join(tmpdir(), 'forge-test-'));
  const toolsDir = join(work, 'tools');
  mkdirSync(toolsDir, { recursive: true });

  const manifest = installArchive(fixtureTarball(work, 'my-tool'), 'tar', { toolsDir });
  assert.equal(manifest.id, 'my-tool');
  assert.ok(existsSync(join(toolsDir, 'my-tool', 'plugin.json')));

  rmSync(work, { recursive: true, force: true });
});

test('BELL: an update that hands back a different id is refused', () => {
  const work = mkdtempSync(join(tmpdir(), 'forge-test-'));
  const toolsDir = join(work, 'tools');
  mkdirSync(toolsDir, { recursive: true });

  // The user asked to update "my-tool"; the package declares something else.
  const tarball = fixtureTarball(work, 'other-tool');
  assert.throws(
    () => installArchive(tarball, 'tar', { toolsDir, expectId: 'my-tool' }),
    /declares id "other-tool"/,
  );
  assert.ok(!existsSync(join(toolsDir, 'other-tool')), 'nothing was written');

  // Same id: passes.
  const same = fixtureTarball(work, 'my-tool');
  assert.equal(installArchive(same, 'tar', { toolsDir, expectId: 'my-tool' }).id, 'my-tool');

  rmSync(work, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Deactivating has to contain.
//
// The client registry uses an eager webpack context, so every staged client.jsx
// has its module body executed in the browser at page load, same-origin,
// whether or not the shell renders it. Deactivating only stopped the HTTP
// routes, which meant the one containment control the product offers did not
// contain.
// ---------------------------------------------------------------------------

test('BELL: a deactivated tool is not staged into the bundle', () => {
  const work = mkdtempSync(join(tmpdir(), 'forge-test-'));
  const toolsDir = join(work, 'tools');
  const staging = join(work, 'staging');
  for (const id of ['keep-me', 'switched-off']) {
    mkdirSync(join(toolsDir, id), { recursive: true });
    writeFileSync(join(toolsDir, id, 'client.jsx'), 'export default function T(){return null;}\n');
  }

  const staged = syncCommunityUi({ toolsDir, staging, disabled: new Set(['switched-off']) });

  assert.deepEqual(staged, ['keep-me']);
  assert.ok(existsSync(join(staging, 'keep-me', 'client.jsx')));
  assert.ok(!existsSync(join(staging, 'switched-off')), 'the deactivated tool must not reach the bundle');

  rmSync(work, { recursive: true, force: true });
});

test('SILENCE: with nothing deactivated, both are staged', () => {
  const work = mkdtempSync(join(tmpdir(), 'forge-test-'));
  const toolsDir = join(work, 'tools');
  const staging = join(work, 'staging');
  for (const id of ['keep-me', 'switched-off']) {
    mkdirSync(join(toolsDir, id), { recursive: true });
    writeFileSync(join(toolsDir, id, 'client.jsx'), 'export default function T(){return null;}\n');
  }

  const staged = syncCommunityUi({ toolsDir, staging, disabled: new Set() });
  assert.deepEqual(staged.sort(), ['keep-me', 'switched-off']);

  rmSync(work, { recursive: true, force: true });
});
