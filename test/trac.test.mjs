import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../src/trac.mjs';

test('parseCsv handles quoted fields with embedded commas and newlines', () => {
  const rows = parseCsv('id,summary\n1,"Fix, the thing"\n2,"multi\nline"\n');
  assert.deepEqual(rows[0], ['id', 'summary']);
  assert.deepEqual(rows[1], ['1', 'Fix, the thing']);
  assert.deepEqual(rows[2], ['2', 'multi\nline']);
});

test('parseCsv unescapes doubled quotes', () => {
  const rows = parseCsv('a\n"he said ""hi"""\n');
  assert.equal(rows[1][0], 'he said "hi"');
});
