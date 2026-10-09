import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnRunner } from '../src/process.ts';

test('a recorded run returns what both streams printed', async () => {
  const result = await spawnRunner('sh', ['-c', 'echo first; echo second >&2; echo third'], { record: true });
  assert.equal(result.code, 0);
  for (const line of ['first', 'second', 'third']) {
    assert.match(result.output ?? '', new RegExp(`^${line}$`, 'm'));
  }
  assert.equal(result.stdout, 'first\nthird\n');
});
