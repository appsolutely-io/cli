// Packs this package and runs it the way npx does: installed from the tarball into a fresh
// project, through the bins npm links, on compiled JavaScript alone. Then packs asly/ and runs
// it beside that tarball, as `npx asly` runs it beside the CLI release it depends on.
//   pnpm check:consumer
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const work = mkdtempSync(join(tmpdir(), 'cli-consumer-'));

function npx(cwd: string, ...args: string[]) {
  return spawnSync('npx', ['--no-install', 'appsolutely', ...args], { cwd, encoding: 'utf8' });
}

function assertVersion(printed: ReturnType<typeof spawnSync>, how: string): void {
  if (printed.status !== 0 || String(printed.stdout).trim() !== version) {
    throw new Error(
      `${how} --version printed ${JSON.stringify(printed.stdout)} (${printed.status}): ${printed.stderr}`,
    );
  }
}

try {
  execFileSync('pnpm', ['pack', '--pack-destination', work], { cwd: root, stdio: 'ignore' });
  const tarball = readdirSync(work).find((name) => name.endsWith('.tgz'))!;
  const listed = execFileSync('tar', ['-tzf', join(work, tarball)], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .sort();
  const stray = listed.filter((path) => !/^package\/(dist\/.+\.js|package\.json|LICENSE|README\.md)$/.test(path));
  if (stray.length > 0) {
    throw new Error(`The package carries files a consumer never runs: ${stray.join(', ')}`);
  }

  const consumer = join(work, 'consumer');
  mkdirSync(consumer);
  execFileSync('npm', ['init', '-y'], { cwd: consumer, stdio: 'ignore' });
  execFileSync('npm', ['install', '--no-audit', '--no-fund', join(work, tarball)], { cwd: consumer, stdio: 'ignore' });

  assertVersion(npx(consumer, '--version'), 'appsolutely');
  assertVersion(spawnSync('npx', ['--no-install', 'asly', '--version'], { cwd: consumer, encoding: 'utf8' }), 'asly');
  const usage = npx(consumer, '--help');
  for (const command of ['init', 'deploy', 'generate-sdk']) {
    if (!usage.stdout.includes(`appsolutely ${command}`)) {
      throw new Error(`The installed usage does not list ${command}:\n${usage.stdout}`);
    }
  }
  const refused = npx(consumer, 'generate-sdk', '--lang', 'swift');
  if (refused.status !== 1 || !refused.stderr.includes('only ts')) {
    throw new Error(`A refusal did not exit 1 with its reason: ${refused.status} ${refused.stderr}`);
  }

  execFileSync('npm', ['pack', '--pack-destination', work], { cwd: join(root, 'asly'), stdio: 'ignore' });
  const shim = readdirSync(work).find((name) => name.startsWith('asly-') && name.endsWith('.tgz'))!;
  const shimConsumer = join(work, 'shim-consumer');
  mkdirSync(shimConsumer);
  execFileSync('npm', ['init', '-y'], { cwd: shimConsumer, stdio: 'ignore' });
  execFileSync('npm', ['install', '--no-audit', '--no-fund', join(work, tarball), join(work, shim)], {
    cwd: shimConsumer,
    stdio: 'ignore',
  });
  // Both packages link `asly`, so the shim's own file is run to prove it reaches the CLI.
  assertVersion(
    spawnSync('node', [join(shimConsumer, 'node_modules', 'asly', 'bin.js'), '--version'], { encoding: 'utf8' }),
    'the asly package',
  );
  console.log(
    `The installed ${tarball} runs as appsolutely and asly: ${version}, usage, and a refusal with its reason; ${shim} runs it.`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
