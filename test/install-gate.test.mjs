/**
 * The first-run installer must not run on a public read-only instance.
 *
 * Hiding the Connectors and Updates tabs in Settings left the harder case in
 * place: the installer is a blocking overlay, not a tab, and it appears before
 * a visitor can reach anything. It asks for a GitHub token and a wordpress.org
 * cookie and ends with POST /api/installed, and a read-only server refuses all
 * three, so it can never be dismissed. Measured on the live instance while it
 * was still there: /api/config/status answered `"installed": false`, and the
 * page rendered "Step 1 of 2 - Connect GitHub" over the whole app.
 *
 * The other half of this seam is proven in hosted-readonly.test.mjs: the shell
 * ships window.__FORGE_READONLY__, which is what isReadOnly() reads to produce
 * the second argument here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldRunInstaller } from '../src/client/install-gate.js';

test('BELL: a read-only instance never runs the first-run installer', () => {
  assert.equal(shouldRunInstaller({ installed: false }, true), false);
});

test('SILENCE: a local instance that has not been set up still runs it', () => {
  assert.equal(shouldRunInstaller({ installed: false }, false), true);
});

test('SILENCE: a local instance that is set up does not run it', () => {
  assert.equal(shouldRunInstaller({ installed: true }, false), false);
});

test('no status yet means no overlay, so it cannot flash before the first load', () => {
  assert.equal(shouldRunInstaller(null, false), false);
  assert.equal(shouldRunInstaller(undefined, false), false);
});
