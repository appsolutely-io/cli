import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { main } from '../src/main.ts';
import { spawnRunner } from '../src/process.ts';
import { writeProject } from '../src/project.ts';
import { type Call, testContext } from './support.ts';

const PINNED = JSON.stringify({ openapi: '3.1.0', info: { title: 'pinned', version: 'v1' }, paths: {} });
const OTHER = JSON.stringify({ openapi: '3.1.0', info: { title: 'other', version: 'v1' }, paths: { '/api/v1/x': {} } });
const INSTALL = 'https://shop.example.com';
const DOCUMENT_URL = `${INSTALL}/api/v1/openapi.json`;

const manifest = {
  name: '@appsolutely/sdk',
  version: '0.1.0',
  packageManager: 'pnpm@12.8.1+sha512.deadbeef',
  files: ['dist'],
  appsolutely: { spec: { path: 'docs/api/openapi.yaml', tag: 'v0.6.0', commit: 'c0ffee', sha256: 'abc' } },
};

/** A stand-in SDK checkout: its pipeline "generates" dist/client.txt from spec/openapi.yaml. */
function sdkSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cli-sdk-source-'));
  mkdirSync(join(dir, 'spec'));
  mkdirSync(join(dir, 'node_modules', 'junk'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(dir, 'spec', 'openapi.yaml'), 'pinned: yaml\n');
  writeFileSync(join(dir, 'committed-document'), PINNED);
  return dir;
}

function tar(args: string[], cwd: string): void {
  execFileSync('tar', args, { cwd });
}

/** Plays the SDK's package scripts; tar runs for real so the CLI's extraction is exercised. */
async function pipeline(call: Call) {
  const cwd = call.options.cwd ?? '';
  if (call.command === 'tar') {
    return spawnRunner(call.command, call.args, call.options);
  }
  assert.equal(call.command, 'npx');
  assert.deepEqual(call.args.slice(0, 2), ['--yes', 'pnpm@12.8.1']);
  const [verb, ...rest] = call.args.slice(2);
  const document = readFileSync(join(cwd, 'spec', 'openapi.yaml'), 'utf8');
  if (verb === 'install') {
    assert.deepEqual(rest, ['--frozen-lockfile']);
    assert.ok(!existsSync(join(cwd, 'node_modules', 'junk')), 'the source tree is copied without node_modules');
  } else if (verb === 'run' && rest[0] === 'check:generated') {
    return { code: document === readFileSync(join(cwd, 'committed-document'), 'utf8') ? 0 : 1 };
  } else if (verb === 'run' && rest[0] === 'generate') {
    mkdirSync(join(cwd, 'dist'), { recursive: true });
    writeFileSync(join(cwd, 'dist', 'client.txt'), document);
  } else if (verb === 'pack') {
    const destination = rest[rest.indexOf('--pack-destination') + 1] as string;
    const stage = mkdtempSync(join(tmpdir(), 'cli-pack-'));
    mkdirSync(join(stage, 'package', 'dist'), { recursive: true });
    writeFileSync(join(stage, 'package', 'package.json'), readFileSync(join(cwd, 'package.json')));
    writeFileSync(join(stage, 'package', 'dist', 'client.txt'), readFileSync(join(cwd, 'dist', 'client.txt')));
    tar(['-czf', join(destination, 'appsolutely-sdk-0.1.0.tgz'), 'package'], stage);
  } else {
    assert.fail(`unexpected pnpm ${call.args.join(' ')}`);
  }
  return { code: 0 };
}

function serving(document: string, status = 200): typeof fetch {
  return (async (input: string | URL | Request) => {
    assert.equal(String(input), DOCUMENT_URL);
    return new Response(document, { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

/** The files of a written package, unpacked the way npm reads them. */
function unpack(tarball: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'cli-unpacked-'));
  tar(['-xzf', tarball, '-C', dir, '--strip-components=1'], dir);
  return dir;
}

function workspace(): string {
  return mkdtempSync(join(tmpdir(), 'cli-generate-'));
}

test('the install serving the pinned document gets that SDK release, byte for byte', async () => {
  const cwd = workspace();
  const source = sdkSource();
  const { context, out } = testContext({ cwd, fetch: serving(PINNED) }, pipeline);

  const code = await main(['generate-sdk', '--lang', 'ts', '--url', INSTALL, '--sdk-source', source], context);
  assert.equal(code, 0);

  assert.deepEqual(readdirSync(cwd), ['appsolutely-sdk.tgz']);
  const written = unpack(join(cwd, 'appsolutely-sdk.tgz'));
  assert.deepEqual(readdirSync(written).sort(), ['dist', 'package.json']);
  assert.equal(readFileSync(join(written, 'package.json'), 'utf8'), `${JSON.stringify(manifest, null, 2)}\n`);
  assert.equal(readFileSync(join(written, 'dist', 'client.txt'), 'utf8'), PINNED);
  assert.match(out.join('\n'), /@appsolutely\/sdk 0\.1\.0, byte for byte, generated from aio v0\.6\.0/);
  assert.equal(readFileSync(join(source, 'spec', 'openapi.yaml'), 'utf8'), 'pinned: yaml\n', 'the source is untouched');
});

test('an install serving another document gets a client for it, recording where the document came from', async () => {
  const cwd = workspace();
  writeProject(cwd, {
    industry: null,
    siteType: null,
    domain: 'shop.example.com',
    url: INSTALL,
    server: null,
    serverPath: null,
  });
  const { context, out } = testContext({ cwd, fetch: serving(OTHER) }, pipeline);

  assert.equal(
    await main(['generate-sdk', '--lang', 'ts', '--sdk-source', sdkSource(), '--out', 'client.tgz'], context),
    0,
  );

  const unpacked = unpack(join(cwd, 'client.tgz'));
  const written = JSON.parse(readFileSync(join(unpacked, 'package.json'), 'utf8'));
  assert.deepEqual(written.appsolutely.spec, {
    source: DOCUMENT_URL,
    sha256: createHash('sha256').update(OTHER).digest('hex'),
  });
  assert.equal(readFileSync(join(unpacked, 'dist', 'client.txt'), 'utf8'), OTHER);
  assert.match(out.join('\n'), /differs from the one @appsolutely\/sdk 0\.1\.0 was generated from/);
  assert.match(out.join('\n'), /npm install \.\/client\.tgz$/);
});

test('without a source the SDK release is taken from the registry and its repository at the release tag', async () => {
  const cwd = workspace();
  const source = sdkSource();
  const archive = mkdtempSync(join(tmpdir(), 'cli-archive-'));
  // GitHub's archives hold the tree under one top-level directory named for the repository and ref.
  cpSync(source, join(archive, 'sdk-ts-0.1.0'), {
    recursive: true,
    filter: (path) => !path.includes('node_modules'),
  });
  tar(['-czf', 'sdk.tgz', 'sdk-ts-0.1.0'], archive);
  const seen: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    seen.push(url);
    if (url === DOCUMENT_URL) {
      return new Response(PINNED);
    }
    if (url === 'https://registry.example.com/@appsolutely%2fsdk') {
      return Response.json({
        'dist-tags': { latest: '0.1.0' },
        versions: { '0.1.0': { repository: { url: 'git+https://github.com/appsolutely-io/sdk-ts.git' } } },
      });
    }
    if (url === 'https://codeload.github.com/appsolutely-io/sdk-ts/tar.gz/refs/tags/v0.1.0') {
      return new Response(readFileSync(join(archive, 'sdk.tgz')));
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  const { context } = testContext(
    { cwd, fetch: fetcher, env: { npm_config_registry: 'https://registry.example.com/' } },
    pipeline,
  );

  assert.equal(await main(['generate-sdk', '--lang', 'ts', '--url', INSTALL], context), 0);
  assert.deepEqual(seen.slice(1), [
    'https://registry.example.com/@appsolutely%2fsdk',
    'https://codeload.github.com/appsolutely-io/sdk-ts/tar.gz/refs/tags/v0.1.0',
  ]);
  assert.equal(readFileSync(join(unpack(join(cwd, 'appsolutely-sdk.tgz')), 'dist', 'client.txt'), 'utf8'), PINNED);
});

test('a version the registry does not have is refused', async () => {
  const fetcher = (async (input: string | URL | Request) =>
    String(input) === DOCUMENT_URL
      ? new Response(PINNED)
      : Response.json({ 'dist-tags': { latest: '0.1.0' }, versions: { '0.1.0': {} } })) as typeof fetch;
  const { context, err } = testContext({ cwd: workspace(), fetch: fetcher }, pipeline);
  assert.equal(await main(['generate-sdk', '--lang', 'ts', '--url', INSTALL, '--sdk-version', '9.9.9'], context), 1);
  assert.match(err.join('\n'), /has no version 9\.9\.9/);
});

test('generate-sdk refuses what it cannot generate from, before touching anything', async () => {
  const cases: [string[], typeof fetch, RegExp][] = [
    [['--url', INSTALL], serving(PINNED), /Pass --lang ts/],
    [['--lang', 'swift', '--url', INSTALL], serving(PINNED), /only ts/],
    [['--lang', 'ts'], serving(PINNED), /--url/],
    [['--lang', 'ts', '--url', 'shop.example.com'], serving(PINNED), /--url/],
    [['--lang', 'ts', '--url', INSTALL], serving('nope', 404), /answered 404/],
    [['--lang', 'ts', '--url', INSTALL], serving('<html>'), /not an OpenAPI document/],
    [['--lang', 'ts', '--url', INSTALL], serving('{"openapi":"3.0.3"}'), /OpenAPI 3\.1/],
  ];
  for (const [args, fetcher, message] of cases) {
    const cwd = workspace();
    const { context, err, calls } = testContext({ cwd, fetch: fetcher }, pipeline);
    assert.equal(await main(['generate-sdk', ...args, '--sdk-source', sdkSource()], context), 1, args.join(' '));
    assert.match(err.join('\n'), message);
    assert.equal(calls.length, 0);
    assert.deepEqual(readdirSync(cwd), []);
  }
});

test('an existing output file is replaced only with --force', async () => {
  const cwd = workspace();
  writeFileSync(join(cwd, 'appsolutely-sdk.tgz'), 'old');
  const args = ['generate-sdk', '--lang', 'ts', '--url', INSTALL, '--sdk-source', sdkSource()];

  const refused = testContext({ cwd, fetch: serving(PINNED) }, pipeline);
  assert.equal(await main(args, refused.context), 1);
  assert.match(refused.err.join('\n'), /appsolutely-sdk\.tgz exists; pass --force/);
  assert.equal(readFileSync(join(cwd, 'appsolutely-sdk.tgz'), 'utf8'), 'old');

  const forced = testContext({ cwd, fetch: serving(PINNED) }, pipeline);
  assert.equal(await main([...args, '--force'], forced.context), 0);
  assert.deepEqual(readdirSync(unpack(join(cwd, 'appsolutely-sdk.tgz'))).sort(), ['dist', 'package.json']);
});

test('a failing pipeline step is reported by name and leaves no output', async () => {
  const cwd = workspace();
  const { context, err } = testContext({ cwd, fetch: serving(PINNED) }, (call) =>
    call.args.includes('pack') ? { code: 1 } : pipeline(call),
  );
  assert.equal(await main(['generate-sdk', '--lang', 'ts', '--url', INSTALL, '--sdk-source', sdkSource()], context), 1);
  assert.match(err.join('\n'), /pnpm pack failed/);
  assert.deepEqual(readdirSync(cwd), []);
});

test('the pipeline does not inherit the npm exec that started the CLI', async () => {
  const cwd = workspace();
  const env = {
    npm_config_package: '@appsolutely/cli',
    npm_config_call: 'appsolutely generate-sdk',
    npm_config_local_prefix: cwd,
    npm_package_json: join(cwd, 'package.json'),
    npm_lifecycle_event: 'npx',
    INIT_CWD: cwd,
    npm_config_registry: 'https://registry.example.com/',
    npm_config_https_proxy: 'http://proxy.example.com:3128',
    npm_config_cafile: '/etc/ssl/company.pem',
    PATH: '/usr/bin',
  };
  const { context, calls } = testContext({ cwd, env, fetch: serving(PINNED) }, pipeline);

  assert.equal(await main(['generate-sdk', '--lang', 'ts', '--url', INSTALL, '--sdk-source', sdkSource()], context), 0);

  const pnpmCalls = calls.filter((call) => call.command === 'npx');
  assert.ok(pnpmCalls.length > 0);
  for (const call of pnpmCalls) {
    const passed = call.options.env ?? {};
    for (const name of [
      'npm_config_package',
      'npm_config_call',
      'npm_config_local_prefix',
      'npm_package_json',
      'npm_lifecycle_event',
      'INIT_CWD',
    ]) {
      assert.ok(name in passed && passed[name] === undefined, `${name} is removed`);
    }
    for (const name of ['npm_config_registry', 'npm_config_https_proxy', 'npm_config_cafile']) {
      assert.ok(!(name in passed), `${name}, a setting of the person running it, is kept`);
    }
    assert.ok(!('PATH' in passed), 'everything else is inherited untouched');
  }
});
