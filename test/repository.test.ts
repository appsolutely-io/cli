import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('no tracked file names the organisation the private repositories are kept in', () => {
  const organisation = ['appsolutely', 'io'].join('');
  // A hook can export git's own variables; drop them so the search reads this checkout.
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  const search = spawnSync('git', ['grep', '-l', '-i', '-F', organisation], { encoding: 'utf8', env });

  assert.equal(search.status, 1, `named in: ${search.stdout.trim()}`);
});
