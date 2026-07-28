import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentBreakdown } from '../src/lib/wp-components.mjs';

const map = new Map([
  [100, 'Editor'],
  [101, 'Editor'],
  [200, 'Media'],
]);

test('componentBreakdown groups Core commits by mapped component and ranks by count', () => {
  const core = [
    { tickets: [100] },
    { tickets: [101] },
    { tickets: [200] },
    { tickets: [999] },   // ticket not in the tracker -> Uncategorized
    { tickets: [] },      // no ticket -> Uncategorized
  ];
  const { byComponent, coverage } = componentBreakdown(core, map);
  assert.deepEqual(byComponent, [
    { component: 'Editor', count: 2 },
    { component: 'Uncategorized', count: 2 },
    { component: 'Media', count: 1 },
  ]);
  assert.deepEqual(coverage, { known: 3, total: 5, pct: 60 });
});

test('componentBreakdown takes the first mapped ticket when a commit closes several', () => {
  const { byComponent } = componentBreakdown([{ tickets: [999, 200] }], map);
  assert.deepEqual(byComponent, [{ component: 'Media', count: 1 }]);
});

test('componentBreakdown reports zero coverage for an empty tracker map', () => {
  const { byComponent, coverage } = componentBreakdown([{ tickets: [100] }], new Map());
  assert.deepEqual(byComponent, [{ component: 'Uncategorized', count: 1 }]);
  assert.deepEqual(coverage, { known: 0, total: 1, pct: 0 });
});
