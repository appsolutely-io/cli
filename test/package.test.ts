import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('the package links asly and nothing else, and publishes publicly', () => {
  assert.equal(manifest.name, '@appsolutely-io/cli');
  assert.deepEqual(manifest.bin, { asly: 'dist/cli.js' });
  assert.deepEqual(manifest.publishConfig, { access: 'public' });
});
