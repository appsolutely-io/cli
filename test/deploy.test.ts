import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { main } from '../src/main.ts';
import { STATE_DIRECTORY } from '../src/commands/deploy.ts';
import { type Project, readProject, writeProject } from '../src/project.ts';
import { type Call, testContext } from './support.ts';

const BUNDLE = 'services: {}\n';

function project(overrides: Partial<Project> = {}): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'cli-deploy-')), 'My Demo');
  mkdirSync(join(dir, 'deploy'), { recursive: true });
  writeFileSync(join(dir, 'deploy', 'compose.yaml'), BUNDLE);
  writeProject(dir, {
    industry: 'software',
    siteType: 'landing',
    domain: null,
    url: 'https://localhost',
    server: null,
    serverPath: null,
    ...overrides,
  });
  return dir;
}

const isInstalledCheck = (call: Call) => call.args.join(' ').includes('--no-deps');
const isStatus = (call: Call) => call.args.join(' ').includes('aio:starter-status');
const isInstall = (call: Call) => call.args.join(' ').includes('aio:install');
const isWait = (call: Call) => call.args.join(' ').includes('--wait');

/** aio:starter-status --json as aio v0.6.0 prints it, after the lines the image's entrypoint prints first. */
function starterStatus(industry: string | null, siteType: string | null): string {
  return [
    'ℹ️ NOTICE (generate-ssl): SSL mode is off.',
    '{"industry":' +
      JSON.stringify(industry) +
      ',"site_type":' +
      JSON.stringify(siteType) +
      ',"seeded":true,"applied_pages":2}',
    '',
  ].join('\n');
}

/** A target's site: whether its install finished, and the pair aio reports having applied. */
function engine(
  state: boolean | { installed: boolean; applied?: [string, string] },
  failing: (call: Call) => boolean = () => false,
) {
  const site = typeof state === 'boolean' ? { installed: state } : state;
  return (call: Call) => {
    if (failing(call)) {
      return { code: 1 };
    }
    if (isInstalledCheck(call)) {
      return { code: 0, stdout: site.installed ? 'installed\n' : '' };
    }
    if (isStatus(call)) {
      return { code: 0, stdout: starterStatus(site.applied?.[0] ?? null, site.applied?.[1] ?? null) };
    }
    return { code: 0 };
  };
}

function composeArgs(call: Call): readonly string[] {
  assert.equal(call.args[0], 'compose');
  return call.args.slice(call.args.indexOf('-f') + 2);
}

test('a first deploy builds the image, installs the site with its starter content and brings the bundle up', async () => {
  const dir = project();
  const { context, calls, out } = testContext({ cwd: dir, env: { COMPOSER_AUTH: '{}' } }, engine(false));

  assert.equal(await main(['deploy'], context), 0);

  const [version, build, check, install, up, ready] = calls;
  assert.deepEqual(version?.args.slice(0, 1), ['version']);
  assert.deepEqual(build?.args, [
    'build',
    '--tag',
    'appsolutely-local/my-demo:latest',
    '--secret',
    'id=composer_auth,env=COMPOSER_AUTH',
    dir,
  ]);

  for (const call of [check, install, up, ready]) {
    assert.deepEqual(call?.args.slice(0, 5), [
      'compose',
      '--project-directory',
      join(dir, 'deploy'),
      '-f',
      join(dir, 'deploy', 'compose.yaml'),
    ]);
    assert.deepEqual(call?.options.env, {
      DOCKER_IMAGE: 'appsolutely-local/my-demo',
      DOCKER_TAG: 'latest',
      COMPOSE_PROJECT_NAME: 'my-demo',
    });
  }
  assert.deepEqual(composeArgs(check!).slice(0, 8), [
    'run',
    '--rm',
    '--no-deps',
    '-T',
    '--entrypoint',
    'sh',
    'app',
    '-c',
  ]);
  assert.deepEqual(composeArgs(install!).slice(0, 6), ['run', '--rm', '-T', 'app', 'sh', '-c']);
  assert.deepEqual(composeArgs(install!).slice(7), [
    'aio:install',
    '--skip-assets',
    '--industry=software',
    '--type=landing',
  ]);
  assert.deepEqual(composeArgs(up!), ['up', '--detach']);
  // Only the application serves the site: the worker and the scheduler carry the image's web healthcheck.
  assert.deepEqual(composeArgs(ready!), ['up', '--detach', '--wait', '--wait-timeout', '600', 'app']);
  assert.match(out.join('\n'), /https:\/\/localhost/);
});

test('a deploy to an installed site skips the install', async () => {
  const dir = project();
  const { context, calls } = testContext({ cwd: dir, interactive: true }, engine(true));

  assert.equal(await main(['deploy'], context), 0);

  assert.equal(calls.length, 6);
  assert.ok(!calls.some(isInstall));
  assert.ok(!calls[1]!.args.includes('--secret'), 'no credential to mount');
  assert.deepEqual(composeArgs(calls[3]!), [
    'run',
    '--rm',
    '-T',
    '-e',
    'AUTORUN_ENABLED=false',
    '-e',
    'PREVIEW_DB_AUTO=false',
    'app',
    'aio:starter-status',
    '--json',
  ]);
  assert.deepEqual(composeArgs(calls[4]!), ['up', '--detach']);
});

test('a first deploy passes the domain, and the install gets the terminal when someone is there', async () => {
  const dir = project({ domain: 'shop.example.com', url: 'https://shop.example.com', industry: null, siteType: null });
  const { context, calls } = testContext({ cwd: dir, interactive: true }, engine(false));

  assert.equal(await main(['deploy'], context), 0);

  assert.deepEqual(composeArgs(calls.find(isInstall)!).slice(0, 3), ['run', '--rm', 'app']);
  assert.deepEqual(composeArgs(calls.find(isInstall)!).slice(-2), ['--skip-assets', '--domain=shop.example.com']);
});

test('on a server, the image is built by its engine and Compose runs there beside a fresh copy of the bundle', async () => {
  const dir = project({ server: 'ssh://deploy@server.example.com:2222', serverPath: 'sites/my-demo' });
  const { context, calls } = testContext({ cwd: dir, interactive: true }, engine(false));

  assert.equal(await main(['deploy'], context), 0);

  const [version, build, copy, check, install, up, ready] = calls;
  for (const call of [version, build]) {
    assert.equal(call?.command, 'docker');
    assert.equal(call?.options.env?.DOCKER_HOST, 'ssh://deploy@server.example.com:2222');
  }
  for (const call of [copy, check, install, up, ready]) {
    assert.equal(call?.command, 'ssh');
  }
  // What the server's shell does with the copy command, run here by a local shell in a stand-in home.
  assert.equal(copy?.args[0], 'ssh://deploy@server.example.com:2222');
  const home = mkdtempSync(join(tmpdir(), 'cli-server-home-'));
  const copied = spawnSync('sh', ['-c', copy!.args[1]!], { cwd: home, input: copy?.options.input });
  assert.equal(copied.status, 0, String(copied.stderr));
  assert.equal(readFileSync(join(home, 'sites', 'my-demo', 'compose.yaml'), 'utf8'), BUNDLE);
  const compose =
    'env DOCKER_IMAGE=appsolutely-local/my-demo DOCKER_TAG=latest COMPOSE_PROJECT_NAME=my-demo docker compose --project-directory sites/my-demo -f sites/my-demo/compose.yaml';
  // The words the server's shell hands Compose are the ones a local deploy passes.
  const words = (remote: string) =>
    spawnSync('sh', ['-c', `printf '%s\\n' ${remote}`], { encoding: 'utf8' })
      .stdout.trimEnd()
      .split('\n');
  const prefix = compose.split(' ');
  const local = project();
  const here = testContext({ cwd: local, interactive: true }, engine(false));
  await main(['deploy'], here.context);
  assert.deepEqual(words(check!.args[1]!), [...prefix, ...composeArgs(here.calls.find(isInstalledCheck)!)]);
  assert.deepEqual(install?.args.slice(0, 2), ['-t', 'ssh://deploy@server.example.com:2222']);
  assert.deepEqual(words(install!.args[2]!), [...prefix, ...composeArgs(here.calls.find(isInstall)!)]);
  assert.deepEqual(ready?.args, [
    'ssh://deploy@server.example.com:2222',
    `${compose} up --detach --wait --wait-timeout 600 app`,
  ]);
});

test('each failing step stops the deploy and says which one', async () => {
  for (const [step, message] of [
    [(call: Call) => call.args[0] === 'build', /The image did not build/],
    [isInstall, /The install did not finish/],
    [(call: Call) => call.args.includes('up') && !isWait(call), /did not start/],
    [isWait, /did not come up healthy\. See docker compose -p my-demo logs app/],
  ] as const) {
    const { context, err, calls } = testContext({ cwd: project() }, engine(false, step));
    assert.equal(await main(['deploy'], context), 1);
    assert.match(err.join('\n'), message);
    // After a failed install, only the read that asks aio whether it refused a changed starter choice.
    const after = calls.slice(calls.findIndex(step) + 1);
    assert.ok(
      after.every(isStatus),
      `nothing but a status read ran after the failing step: ${after.map((c) => c.args.join(' '))}`,
    );
  }
});

test('a bundle that cannot be copied to the server stops the deploy before Compose runs', async () => {
  const dir = project({ server: 'ssh://deploy@server.example.com', serverPath: 'appsolutely/my-demo' });
  const { context, err, calls } = testContext({ cwd: dir }, (call) => ({ code: call.command === 'ssh' ? 255 : 0 }));
  assert.equal(await main(['deploy'], context), 1);
  assert.match(err.join('\n'), /could not be copied to ssh:\/\/deploy@server\.example\.com:appsolutely\/my-demo/);
  assert.equal(calls.filter((call) => call.command === 'ssh').length, 1);
});

test('deploy outside a project says how to make one', async () => {
  const { context, err, calls } = testContext({ cwd: mkdtempSync(join(tmpdir(), 'cli-deploy-')) });
  assert.equal(await main(['deploy'], context), 1);
  assert.match(err.join('\n'), /appsolutely init/);
  assert.equal(calls.length, 0);
});

test('a target whose install state cannot be read stops the deploy instead of installing', async () => {
  const dir = project();
  const { context, calls, err } = testContext({ cwd: dir }, (call) => ({ code: isInstalledCheck(call) ? 255 : 0 }));
  assert.equal(await main(['deploy'], context), 1);
  assert.match(err.join('\n'), /could not read whether the site is installed/);
  assert.ok(!calls.some(isInstall));
});

/**
 * A target that runs deploy's install-state check and install script in a local shell against a stand-in
 * for the site's file volume, with `php` exiting as `phpExit` says and aio reporting `applied`.
 */
function shellSite() {
  const storage = mkdtempSync(join(tmpdir(), 'cli-storage-'));
  const bin = mkdtempSync(join(tmpdir(), 'cli-bin-'));
  writeFileSync(join(bin, 'php'), '#!/bin/sh\nexit ${PHP_EXIT:-0}\n', { mode: 0o755 });
  const site = {
    phpExit: 0,
    applied: null as [string, string] | null,
    answer(call: Call) {
      if (isStatus(call)) {
        return { code: 0, stdout: starterStatus(site.applied?.[0] ?? null, site.applied?.[1] ?? null) };
      }
      if (isInstalledCheck(call) || isInstall(call)) {
        const args = composeArgs(call);
        const at = args.indexOf('-c');
        const result = spawnSync(
          'sh',
          ['-c', args[at + 1]!.replaceAll(STATE_DIRECTORY, storage), ...args.slice(at + 2)],
          {
            encoding: 'utf8',
            env: { PATH: `${bin}:/usr/bin:/bin`, PHP_EXIT: String(site.phpExit) },
          },
        );
        return { code: result.status ?? 1, stdout: result.stdout };
      }
      return { code: 0 };
    },
  };
  return site;
}

/** Deploys with one project file, has aio fail, then deploys again with another against the same site. */
async function deployTwice(first: Partial<Project>, second: Partial<Project>) {
  const dir = project(first);
  const site = shellSite();
  site.phpExit = 1;
  const one = testContext({ cwd: dir }, (call) => site.answer(call));
  assert.equal(await main(['deploy'], one.context), 1, 'the first install fails');
  writeProject(dir, { ...readProject(dir), ...second });
  site.phpExit = 0;
  const two = testContext({ cwd: dir }, (call) => site.answer(call));
  return { code: await main(['deploy'], two.context), ...two };
}

test('a misspelled site type that failed inside aio is corrected by editing the project file', async () => {
  const { code, calls, err } = await deployTwice({ siteType: 'landng' }, { siteType: 'landing' });
  assert.equal(code, 0, err.join('\n'));
  assert.ok(composeArgs(calls.find(isInstall)!).includes('--type=landing'));
});

test('an install that failed before seeding takes another site type on the next deploy', async () => {
  const { code, calls, err } = await deployTwice(
    { siteType: 'landing', domain: 'shop.example.com' },
    { siteType: 'portfolio' },
  );
  assert.equal(code, 0, err.join('\n'));
  assert.deepEqual(err, []);
  assert.ok(composeArgs(calls.find(isInstall)!).includes('--type=portfolio'));
});

test('another site type in the same industry is refused on an installed site, with the command that changes it', async () => {
  const dir = project({ siteType: 'portfolio' });
  const { context, calls, err } = testContext(
    { cwd: dir },
    engine({ installed: true, applied: ['software', 'landing'] }),
  );
  assert.equal(await main(['deploy'], context), 1);
  const message = err.join('\n');
  assert.match(message, /built as software\/landing/);
  assert.match(message, /run --rm app aio:apply-starter --industry=software --type=portfolio --confirm/);
  assert.doesNotMatch(message, /<[a-z]+>/, 'real values, no placeholders');
  assert.ok(!calls.some(isInstall));
  assert.ok(!calls.some(isWait), 'nothing is brought up under a choice the site does not have');
});

test('another industry is refused on an installed site, as aio refuses it, with no command that cannot run', async () => {
  const dir = project({ industry: 'restaurant', siteType: 'menu' });
  const { context, calls, err } = testContext(
    { cwd: dir },
    engine({ installed: true, applied: ['software', 'landing'] }),
  );
  assert.equal(await main(['deploy'], context), 1);
  const message = err.join('\n');
  assert.match(message, /built as software\/landing/);
  assert.match(message, /does not change the industry of a site/);
  assert.match(message, /industry back to software/);
  assert.doesNotMatch(message, /--confirm/);
  assert.ok(!calls.some(isInstall));
  assert.ok(!calls.some(isWait));
});

test('a site type left to the industry default does not conflict with the type aio applied', async () => {
  const dir = project({ siteType: null });
  const { context, err } = testContext({ cwd: dir }, engine({ installed: true, applied: ['software', 'landing'] }));
  assert.equal(await main(['deploy'], context), 0);
  assert.deepEqual(err, []);
});

test('the default type aio applied is what a type named afterwards is compared with', async () => {
  // Installed with siteType left out: aio applied software's default, landing; naming portfolio is a change.
  const dir = project({ siteType: 'portfolio' });
  const { context, err } = testContext({ cwd: dir }, engine({ installed: true, applied: ['software', 'landing'] }));
  assert.equal(await main(['deploy'], context), 1);
  assert.match(err.join('\n'), /built as software\/landing/);
});

test('a project that names no industry asks for no starter change', async () => {
  const dir = project({ industry: null, siteType: null });
  const { context, err } = testContext({ cwd: dir }, engine({ installed: true, applied: ['software', 'landing'] }));
  assert.equal(await main(['deploy'], context), 0);
  assert.deepEqual(err, []);
});

test('an installed site whose starter content aio cannot report stops the deploy', async () => {
  const dir = project();
  const { context, calls, err } = testContext({ cwd: dir }, (call) =>
    isInstalledCheck(call) ? { code: 0, stdout: 'installed\n' } : { code: isStatus(call) ? 1 : 0 },
  );
  assert.equal(await main(['deploy'], context), 1);
  assert.match(err.join('\n'), /could not read the site's starter content/);
  assert.ok(!calls.some(isWait));
});

test('the marker is written only when aio:install succeeds, and nothing else is', async () => {
  const site = shellSite();
  const dir = project();
  site.phpExit = 1;
  await main(['deploy'], testContext({ cwd: dir }, (call) => site.answer(call)).context);
  const check = testContext({ cwd: dir }, (call) => site.answer(call));
  site.phpExit = 0;
  await main(['deploy'], check.context);
  assert.ok(check.calls.some(isInstall), 'a failed install is run again');
  const third = testContext({ cwd: dir }, (call) => site.answer(call));
  await main(['deploy'], third.context);
  assert.ok(!third.calls.some(isInstall), 'a finished install is not');
});

test('the commands printed for a server run there as printed', async () => {
  const dir = project({
    siteType: 'portfolio',
    server: 'ssh://deploy@server.example.com:2222',
    serverPath: 'sites/my-demo',
  });
  const { context, err } = testContext({ cwd: dir }, (call) => {
    const words = call.command === 'ssh' ? call.args.at(-1)! : '';
    if (words.includes('--no-deps')) {
      return { code: 0, stdout: 'installed\n' };
    }
    if (words.includes('aio:starter-status')) {
      return { code: 0, stdout: starterStatus('software', 'landing') };
    }
    return { code: 0 };
  });
  assert.equal(await main(['deploy'], context), 1);
  const printed = err
    .join('\n')
    .split('\n')
    .find((line) => line.trim().startsWith('ssh '))!
    .trim();
  // What a local shell hands ssh, then what the server's shell hands Compose.
  const local = spawnSync('sh', ['-c', `printf '%s\\n' ${printed}`], { encoding: 'utf8' })
    .stdout.trimEnd()
    .split('\n');
  assert.deepEqual(local.slice(0, 2), ['ssh', 'ssh://deploy@server.example.com:2222']);
  const remote = spawnSync('sh', ['-c', `printf '%s\\n' ${local[2]}`], { encoding: 'utf8' })
    .stdout.trimEnd()
    .split('\n');
  assert.deepEqual(remote, [
    'env',
    'DOCKER_IMAGE=appsolutely-local/my-demo',
    'DOCKER_TAG=latest',
    'COMPOSE_PROJECT_NAME=my-demo',
    'docker',
    'compose',
    '--project-directory',
    'sites/my-demo',
    '-f',
    'sites/my-demo/compose.yaml',
    'run',
    '--rm',
    'app',
    'aio:apply-starter',
    '--industry=software',
    '--type=portfolio',
    '--confirm',
  ]);
});

test('the command printed for this machine runs from anywhere', async () => {
  const dir = project({ siteType: 'portfolio' });
  const { context, err } = testContext({ cwd: dir }, engine({ installed: true, applied: ['software', 'landing'] }));
  await main(['deploy'], context);
  assert.match(
    err.join('\n'),
    new RegExp(`-f '?${join(dir, 'deploy', 'compose.yaml').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  );
});

test('a status read that returns no JSON says so and shows what came back', async () => {
  const dir = project();
  const { context, calls, err } = testContext({ cwd: dir }, (call) =>
    isInstalledCheck(call)
      ? { code: 0, stdout: 'installed\n' }
      : isStatus(call)
        ? { code: 0, stdout: 'SQLSTATE[08006] could not connect\n' }
        : { code: 0 },
  );
  assert.equal(await main(['deploy'], context), 1);
  const message = err.join('\n');
  assert.match(message, /no JSON returned/);
  assert.doesNotMatch(message, /exit 0/);
  assert.match(message, /SQLSTATE\[08006\] could not connect/);
  assert.ok(!calls.some(isWait));
});

test('the report is the last JSON object, after JSON-looking log lines', async () => {
  const dir = project({ siteType: 'portfolio' });
  const { context, err } = testContext({ cwd: dir }, (call) =>
    isInstalledCheck(call)
      ? { code: 0, stdout: 'installed\n' }
      : isStatus(call)
        ? { code: 0, stdout: `{"level":"info","message":"booted"}\n${starterStatus('software', 'landing')}` }
        : { code: 0 },
  );
  assert.equal(await main(['deploy'], context), 1);
  assert.match(err.join('\n'), /built as software\/landing/);
});

test('the command printed for this machine names the bundle directory absolutely', async () => {
  const dir = project({ siteType: 'portfolio' });
  const { context, err } = testContext({ cwd: dir }, engine({ installed: true, applied: ['software', 'landing'] }));
  await main(['deploy'], context);
  const line = err
    .join('\n')
    .split('\n')
    .find((text) => text.includes('aio:apply-starter'))!;
  const words = spawnSync('sh', ['-c', `printf '%s\\n' ${line.trim()}`], { encoding: 'utf8' }).stdout.split('\n');
  assert.equal(words[words.indexOf('--project-directory') + 1], join(dir, 'deploy'));
});

/** aio v0.6.0's StarterSiteMismatchException text for a same-industry change, as aio:install prints it. */
const SITE_TYPE_REFUSAL =
  "This site's starter content is 'software/landing', not 'software/portfolio'. Nothing was written. Changing the site type removes the current one first; see aio:apply-starter --confirm.";

test('an unfinished install that aio refuses for another site type gets the command that changes it', async () => {
  const dir = project({ siteType: 'portfolio' });
  const { context, err } = testContext({ cwd: dir }, (call) =>
    isInstalledCheck(call)
      ? { code: 0, stdout: '' }
      : isInstall(call)
        ? { code: 1, output: `Seeding admin tables...\n${SITE_TYPE_REFUSAL}\n` }
        : { code: 0 },
  );
  assert.equal(await main(['deploy'], context), 1);
  const message = err.join('\n');
  assert.match(message, /built as software\/landing/);
  assert.match(message, /aio:apply-starter --industry=software --type=portfolio --confirm/);
});

test('an install that failed for another reason points at its output, even when aio reports another pair', async () => {
  const dir = project({ siteType: 'portfolio', domain: 'shop.example.com' });
  const { context, err, calls } = testContext({ cwd: dir }, (call) =>
    isInstalledCheck(call)
      ? { code: 0, stdout: '' }
      : isInstall(call)
        ? { code: 1, output: 'shop.example.com does not resolve to this server.\n' }
        : isStatus(call)
          ? { code: 0, stdout: starterStatus('software', 'landing') }
          : { code: 0 },
  );
  assert.equal(await main(['deploy'], context), 1);
  const message = err.join('\n');
  assert.match(message, /The install did not finish; its output is above/);
  assert.doesNotMatch(message, /apply-starter/);
  assert.ok(!calls.some(isStatus), 'no status read after a failed install');
});

test('the install output is recorded, so its reason can be read', async () => {
  const dir = project();
  const { context, calls } = testContext({ cwd: dir }, engine(false));
  await main(['deploy'], context);
  assert.equal(calls.find(isInstall)?.options.record, true);
});

test('every status read switches the image entrypoint migrations and the preview database step off', async () => {
  for (const state of [
    { installed: true, applied: ['software', 'landing'] as [string, string] },
    { installed: true },
  ]) {
    const dir = project();
    const { context, calls } = testContext({ cwd: dir }, engine(state));
    await main(['deploy'], context);
    const reads = calls.filter(isStatus);
    assert.ok(reads.length > 0);
    for (const read of reads) {
      const args = composeArgs(read);
      const before = args.slice(0, args.indexOf('app'));
      assert.ok(before.join(' ').includes('-e AUTORUN_ENABLED=false'), args.join(' '));
      assert.ok(before.join(' ').includes('-e PREVIEW_DB_AUTO=false'), args.join(' '));
    }
  }
});

test('an unreadable status says the read started the services the application needs, not that nothing ran', async () => {
  const dir = project();
  const { context, err } = testContext({ cwd: dir }, (call) =>
    isInstalledCheck(call) ? { code: 0, stdout: 'installed\n' } : isStatus(call) ? { code: 3 } : { code: 0 },
  );
  assert.equal(await main(['deploy'], context), 1);
  const message = err.join('\n');
  assert.doesNotMatch(message, /nothing was brought up/);
  assert.match(message, /started the services the application depends on/);
  assert.match(message, /did not bring the site up/);
});
