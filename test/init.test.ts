import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { main } from '../src/main.ts';
import { readProject } from '../src/project.ts';
import { type Call, testContext } from './support.ts';

function hostRelease(dir: string, overrides: { composer?: object; lock?: object; bundle?: boolean } = {}): void {
  mkdirSync(join(dir, 'deploy'), { recursive: true });
  writeFileSync(
    join(dir, 'composer.json'),
    JSON.stringify(overrides.composer ?? { name: 'appsolutely/appsolutely', require: { 'appsolutely/aio': '^0.6' } }),
  );
  writeFileSync(
    join(dir, 'composer.lock'),
    JSON.stringify(overrides.lock ?? { packages: [{ name: 'appsolutely/aio', version: 'v0.6.0' }] }),
  );
  writeFileSync(join(dir, 'Dockerfile'), 'FROM scratch\n');
  if (overrides.bundle !== false) {
    writeFileSync(join(dir, 'deploy', 'compose.yaml'), 'services: {}\n');
  }
}

/** Answers `docker version` and makes `docker run … composer create-project` write a host release. */
function composer(parent: string, release: Parameters<typeof hostRelease>[1] = {}) {
  return (call: Call) => {
    if (call.args[0] === 'run') {
      const target = call.args[call.args.indexOf('appsolutely/appsolutely') + 1] as string;
      hostRelease(join(parent, target), release);
    }
    return { code: 0 };
  };
}

function workspace(): string {
  return mkdtempSync(join(tmpdir(), 'cli-init-'));
}

test('init scaffolds the host release with Composer in Docker and records the choices', async () => {
  const cwd = workspace();
  const { context, calls, out } = testContext({ cwd, env: { COMPOSER_AUTH: '{"github-oauth":{}}' } }, composer(cwd));

  assert.equal(
    await main(['init', 'demo', '--self-host', '--template', 'landing', '--industry', 'software'], context),
    0,
  );

  assert.deepEqual(
    calls.map((call) => call.command),
    ['docker', 'docker'],
  );
  assert.deepEqual(calls[0]?.args, ['version', '--format', '{{.Server.Version}}']);
  const run = calls[1]!.args;
  assert.deepEqual(run.slice(0, 2), ['run', '--rm']);
  assert.ok(run.includes(`${cwd}:/app`), 'mounts the parent directory');
  assert.deepEqual(run.slice(run.indexOf('-e'), run.indexOf('-e') + 2), ['-e', 'COMPOSER_AUTH']);
  assert.ok(!run.some((arg) => arg.includes('github-oauth')), 'the credential never appears in the arguments');
  const image = run.indexOf('composer:2');
  assert.deepEqual(run.slice(image), [
    'composer:2',
    'create-project',
    '--no-install',
    '--no-scripts',
    '--no-interaction',
    'appsolutely/appsolutely',
    'demo',
  ]);
  if (process.getuid !== undefined) {
    assert.ok(run.includes(`${process.getuid()}:${process.getgid!()}`), 'files belong to the developer');
  }

  assert.deepEqual(readProject(join(cwd, 'demo')), {
    industry: 'software',
    siteType: 'landing',
    domain: null,
    url: 'https://localhost',
    server: null,
    serverPath: null,
  });
  assert.match(out.join('\n'), /appsolutely\/aio v0\.6\.0/);
  assert.match(out.join('\n'), /cd demo/);
});

test('init passes a host version, a repository and a domain through', async () => {
  const cwd = workspace();
  const { context, calls } = testContext({ cwd }, composer(cwd));

  await main(
    [
      'init',
      'shop',
      '--host-version',
      '^0.1',
      '--repository',
      'https://github.com/example/host',
      '--domain',
      'shop.example.com',
      '--server',
      'ssh://deploy@server.example.com',
    ],
    context,
  );

  const run = calls[1]!.args;
  assert.ok(!run.includes('COMPOSER_AUTH'), 'no credential to pass');
  assert.deepEqual(run.slice(-3), ['appsolutely/appsolutely', 'shop', '^0.1']);
  assert.ok(run.includes('--repository={"type":"vcs","url":"https://github.com/example/host"}'));
  const project = readProject(join(cwd, 'shop'));
  assert.equal(project.url, 'https://shop.example.com');
  assert.equal(project.domain, 'shop.example.com');
  assert.equal(project.server, 'ssh://deploy@server.example.com');
  assert.equal(project.serverPath, 'appsolutely/shop', 'a directory of its own on the server, by default');
  assert.equal(project.industry, null);
  assert.equal(project.siteType, null);
});

test('init refuses values the bundle could not use, before running anything', async () => {
  for (const [args, message] of [
    [['--template', 'Landing Page'], /--template/],
    [['--industry', 'soft ware'], /--industry/],
    [['--domain', 'https://example.com'], /--domain/],
    [['--server', 'tcp://server.example.com'], /--server/],
    [['--server', 'ssh://deploy@server.example.com', '--server-path', '/srv/site; rm -rf /'], /--server-path/],
    [['--server-path', '/srv/site'], /give --server as well/],
    [['--repository', 'not a url'], /--repository/],
    [['--cloud'], /Hosted sites are created by signing up/],
  ] as const) {
    const { context, calls, err } = testContext({ cwd: workspace() });
    assert.equal(await main(['init', 'demo', ...args], context), 1, String(args));
    assert.match(err.join('\n'), message);
    assert.equal(calls.length, 0);
  }
});

test('init needs a directory and refuses one that already holds files', async () => {
  const cwd = workspace();
  mkdirSync(join(cwd, 'demo'));
  writeFileSync(join(cwd, 'demo', 'notes.txt'), 'mine');

  const missing = testContext({ cwd });
  assert.equal(await main(['init'], missing.context), 1);
  assert.match(missing.err.join('\n'), /^appsolutely init: Name the directory/);

  const taken = testContext({ cwd });
  assert.equal(await main(['init', 'demo'], taken.context), 1);
  assert.match(taken.err.join('\n'), /demo already exists and is not empty/);
  assert.equal(readFileSync(join(cwd, 'demo', 'notes.txt'), 'utf8'), 'mine');
});

test('init says Docker is needed when the engine does not answer', async () => {
  const cwd = workspace();
  const { context, err } = testContext({ cwd }, () => ({ code: 1 }));
  assert.equal(await main(['init', 'demo'], context), 1);
  assert.match(err.join('\n'), /Docker is not running/);
});

test('a failed create-project leaves nothing behind', async () => {
  const cwd = workspace();
  const { context, err } = testContext({ cwd }, (call) => {
    if (call.args[0] === 'run') {
      mkdirSync(join(cwd, 'demo'));
      writeFileSync(join(cwd, 'demo', 'composer.json'), '{}');
      return { code: 1 };
    }
    return { code: 0 };
  });
  assert.equal(await main(['init', 'demo'], context), 1);
  assert.match(err.join('\n'), /Composer could not create the project/);
  assert.equal(existsSync(join(cwd, 'demo')), false);
});

test('a release that is not a host on appsolutely/aio with the bundle is refused and removed', async () => {
  for (const [release, message] of [
    [{ composer: { require: {} } }, /does not require appsolutely\/aio/],
    [{ lock: { packages: [] } }, /composer\.lock does not pin appsolutely\/aio/],
    [{ bundle: false }, /has no deploy\/compose\.yaml/],
  ] as const) {
    const cwd = workspace();
    const { context, err } = testContext({ cwd }, composer(cwd, release));
    assert.equal(await main(['init', 'demo'], context), 1);
    assert.match(err.join('\n'), message);
    assert.equal(existsSync(join(cwd, 'demo')), false);
  }
});

test('a site type without an industry asks for the industry, and is refused when nobody answers', async () => {
  const cwd = workspace();
  const questions: string[] = [];
  const asked = testContext(
    {
      cwd,
      ask: async (question) => {
        questions.push(question);
        return ' software ';
      },
    },
    composer(cwd),
  );
  assert.equal(await main(['init', 'demo', '--self-host', '--template', 'landing'], asked.context), 0);
  assert.match(questions.join(''), /industry/i);
  assert.equal(readProject(join(cwd, 'demo')).industry, 'software');

  for (const answer of [null, '', 'Soft Ware']) {
    const refused = testContext({ cwd: workspace(), ask: async () => answer });
    assert.equal(await main(['init', 'demo', '--template', 'landing'], refused.context), 1);
    assert.match(refused.err.join('\n'), /--industry/);
    assert.equal(refused.calls.length, 0);
  }
});
