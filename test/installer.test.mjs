import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { installArchive, uninstall, parseSource } from '../src/installer.mjs';

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
