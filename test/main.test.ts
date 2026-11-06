import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { main } from '../src/main.ts';
import { testContext } from './support.ts';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const version = manifest.version;

test('--version prints the package version', async () => {
  const { context, out } = testContext();
  assert.equal(await main(['--version'], context), 0);
  assert.deepEqual(out, [version]);
});

test('no command prints the usage and succeeds', async () => {
  const { context, out } = testContext();
  assert.equal(await main([], context), 0);
  assert.match(out.join('\n'), /^Usage:/);
});

test('the usage names every command by the executable the package links', async () => {
  const { context, out } = testContext();
  const [executable] = Object.keys(manifest.bin);
  assert.equal(await main(['--help'], context), 0);
  const lines = out.join('\n').split('\n').slice(1);
  assert.ok(lines.length > 0);
  for (const line of lines) {
    assert.match(line, new RegExp(`^  ${executable} `));
  }
});

test('an unknown command is refused with the usage', async () => {
  const { context, err } = testContext();
  assert.equal(await main(['publish'], context), 1);
  assert.match(err.join('\n'), /Unknown command "publish"/);
});
