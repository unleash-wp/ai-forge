import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimitHint, resetClock } from '../src/connectors/github-token.mjs';

/**
 * A 403 from GitHub is the most-read error this project produces on a hosted
 * instance: without a token the whole site shares 60 requests an hour, and one
 * person checking the page can spend them before lunch. What the reader is told
 * at that moment is the product.
 */

test('BELL: a hosted visitor is not told to run a CLI command', () => {
  // They have no shell on that machine. The operator's token belongs in the
  // server environment, so the instruction sends somebody to a command that
  // would change nothing about the page in front of them.
  const hint = rateLimitHint({ hasToken: false, hostedReadOnly: true, resetsAt: '09:15 UTC' });
  assert.ok(!hint.includes('gh auth login'), hint);
  assert.match(hint, /09:15 UTC/);
  assert.match(hint, /already cached still answer/);
});

test('SILENCE: a local user without a token still gets the fix that works for them', () => {
  // `gh auth login` is the right answer on a workstation and raises 60/h to
  // 5000/h. Removing it everywhere would have been the easy overcorrection.
  const hint = rateLimitHint({ hasToken: false, hostedReadOnly: false, resetsAt: '09:15 UTC' });
  assert.match(hint, /gh auth login/);
  assert.match(hint, /09:15 UTC/);
});

test('SILENCE: with a token the message does not suggest getting one', () => {
  const hint = rateLimitHint({ hasToken: true, hostedReadOnly: false, resetsAt: null });
  assert.ok(!hint.includes('gh auth login'), hint);
  assert.match(hint, /5000\/h/);
  assert.match(hint, /resets within the hour/);
});

test('BELL: a real reset time replaces the guess', () => {
  // "try again shortly" is a guess, and a reader who reloads on it spends the
  // recovered quota the moment it returns.
  const headers = new Headers({ 'x-ratelimit-reset': String(Math.floor((Date.now() + 900_000) / 1000)) });
  assert.match(resetClock(headers), /^\d{2}:\d{2} UTC$/);
});

test('SILENCE: a missing, past or absurd reset header yields no clock at all', () => {
  // Quoting a time that already passed reads as a broken site rather than a
  // busy one, so the caller falls back to the vaguer sentence.
  const now = Date.now();
  assert.equal(resetClock(new Headers()), null);
  assert.equal(resetClock(new Headers({ 'x-ratelimit-reset': 'soon' })), null);
  assert.equal(resetClock(new Headers({ 'x-ratelimit-reset': String(Math.floor((now - 60_000) / 1000)) }), now), null);
  assert.equal(resetClock(new Headers({ 'x-ratelimit-reset': String(Math.floor((now + 5 * 3600_000) / 1000)) }), now), null);
});
