// Deactivating a tool has to stop it being loaded, not just stop it being served.
//
// The flag used to be read only by the HTTP layer, so a deactivated plugin's
// server.mjs was still imported (running its module body) and its exported
// mcpTools were still handed to the AI host. Deactivating is the only
// containment the product offers, so it has to hold at the loader.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPlugins } from '../src/plugins.mjs';

// A plugin whose module body leaves a trace on disk, so "was it imported?" is a
// fact we can check rather than something we infer from its exports.
function fixture(root, id, marker) {
  const dir = join(root, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'plugin.json'), JSON.stringify({ id, name: 'T ' + id, version: '0.1.0' }));
  writeFileSync(
    join(dir, 'server.mjs'),
    `import { writeFileSync } from 'node:fs';\n` +
      `writeFileSync(${JSON.stringify(marker)}, 'ran');\n` +
      `export const mcpTools = [{ name: '${id}_tool' }];\n` +
      `export const routes = [{ method: 'GET', path: '/api/${id}' }];\n`,
  );
}

test('BELL: a deactivated plugin is neither imported nor allowed to register tools', async () => {
  const work = mkdtempSync(join(tmpdir(), 'forge-disabled-'));
  const userDir = join(work, 'user');
  const bundledDir = join(work, 'bundled');
  mkdirSync(bundledDir, { recursive: true });
  const onMarker = join(work, 'on.ran');
  const offMarker = join(work, 'off.ran');
  fixture(userDir, 'switched-on', onMarker);
  fixture(userDir, 'switched-off', offMarker);

  const plugins = await loadPlugins({ bundledDir, userDir, disabled: new Set(['switched-off']) });
  const byId = new Map(plugins.map((p) => [p.manifest.id, p]));

  // Still listed, so the user can switch it back on.
  assert.ok(byId.has('switched-off'), 'a deactivated plugin stays visible in the list');

  assert.ok(existsSync(onMarker), 'the active plugin was imported');
  assert.ok(!existsSync(offMarker), 'the deactivated plugin must not be imported at all');

  assert.deepEqual(byId.get('switched-off').mcpTools, [], 'no MCP tools reach the AI host');
  assert.deepEqual(byId.get('switched-off').routes, [], 'no routes');
  assert.equal(byId.get('switched-on').mcpTools.length, 1);

  rmSync(work, { recursive: true, force: true });
});

test('SILENCE: with nothing deactivated, both load normally', async () => {
  const work = mkdtempSync(join(tmpdir(), 'forge-disabled-'));
  const userDir = join(work, 'user');
  const bundledDir = join(work, 'bundled');
  mkdirSync(bundledDir, { recursive: true });
  fixture(userDir, 'one', join(work, 'one.ran'));
  fixture(userDir, 'two', join(work, 'two.ran'));

  const plugins = await loadPlugins({ bundledDir, userDir, disabled: new Set() });

  assert.equal(plugins.length, 2);
  for (const p of plugins) assert.equal(p.mcpTools.length, 1);

  rmSync(work, { recursive: true, force: true });
});
