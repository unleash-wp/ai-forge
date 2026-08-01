import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectInstall } from '../src/self-update.mjs';

test('detectInstall never falls through to a fake global update', () => {
  const method = detectInstall();
  assert.notEqual(method, 'global', 'unknown layouts must not pretend to be global npm');
  assert.ok(['git', 'global', 'npx', 'local', 'unknown'].includes(method));
});
