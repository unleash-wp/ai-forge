import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quarterRange, monthRange, resolveWindow } from '../plugins/contributors/lib/quarters.mjs';

test('quarterRange maps Q4 to Oct 1 – Dec 31', () => {
  assert.deepEqual(quarterRange('2025-Q4'), { since: '2025-10-01', until: '2025-12-31', label: 'Q4 2025' });
});

test('quarterRange maps Q1 to Jan 1 – Mar 31 and accepts loose spelling', () => {
  assert.deepEqual(quarterRange('2024q1'), { since: '2024-01-01', until: '2024-03-31', label: 'Q1 2024' });
});

test('monthRange uses the real last day, including leap February', () => {
  assert.deepEqual(monthRange('2025-10'), { since: '2025-10-01', until: '2025-10-31', label: 'October 2025' });
  assert.equal(monthRange('2024-02').until, '2024-02-29');
  assert.equal(monthRange('2025-02').until, '2025-02-28');
});

test('resolveWindow passes an explicit since/until range through', () => {
  assert.deepEqual(resolveWindow({ since: '2025-01-01', until: '2025-01-15' }),
    { since: '2025-01-01', until: '2025-01-15', label: '2025-01-01 to 2025-01-15' });
});

test('resolveWindow throws when no period is given', () => {
  assert.throws(() => resolveWindow({}), /quarter|month|since/);
});

test('quarterRange rejects a bad quarter token', () => {
  assert.throws(() => quarterRange('2025-Q9'), /invalid quarter/);
});
