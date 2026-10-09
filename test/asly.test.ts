import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const cli = JSON.parse(read('package.json'));
const shim = JSON.parse(read('asly/package.json'));

test('asly is a second name for the same command', () => {
  assert.deepEqual(Object.keys(cli.bin).sort(), ['appsolutely', 'asly']);
  assert.equal(cli.bin.asly, cli.bin.appsolutely);
});

test('the asly package is released with the CLI and runs exactly that version', () => {
  assert.equal(shim.name, 'asly');
  assert.equal(shim.version, cli.version);
  assert.deepEqual(shim.dependencies, { [cli.name]: cli.version });
  assert.deepEqual(shim.bin, { asly: 'bin.js' });
});

test("the asly package runs the CLI's own entry point", () => {
  const entry = `${cli.name}/${cli.bin.appsolutely.replace(/^\.\//, '')}`;

  assert.match(read('asly/bin.js'), new RegExp(`^import '${entry.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}';$`, 'm'));
});
