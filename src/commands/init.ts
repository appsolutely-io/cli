import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { type Context, UsageError } from '../context.ts';
import { assertDocker } from '../docker.ts';
import { composeProjectName, DOMAIN, KEY, SERVER, SERVER_PATH, siteUrl, writeProject } from '../project.ts';

export const INIT_USAGE =
  'appsolutely init <directory> [--self-host] [--template <site type>] [--industry <key>] [--domain <host>] [--server ssh://<user>@<host> [--server-path <directory>]] [--host-version <constraint>] [--repository <url>]';

/** The host application package: a thin Laravel app on appsolutely/aio that carries the self-host bundle. */
const HOST_PACKAGE = 'appsolutely/appsolutely';
const AIO_PACKAGE = 'appsolutely/aio';
const BUNDLE = join('deploy', 'compose.yaml');
/** Composer runs in its own image, so the machine needs Docker and nothing of PHP. */
const COMPOSER_IMAGE = 'composer:2';

function option(value: string | undefined, pattern: RegExp, flag: string, what: string): string | null {
  if (value === undefined) {
    return null;
  }
  if (!pattern.test(value)) {
    throw new UsageError(`${flag} ${JSON.stringify(value)} is not ${what}.`);
  }
  return value;
}

function repositoryOption(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  try {
    new URL(value);
  } catch {
    throw new UsageError(`--repository ${JSON.stringify(value)} is not a URL.`);
  }
  return JSON.stringify({ type: 'vcs', url: value });
}

function isEmptyDirectory(path: string): boolean {
  return readdirSync(path).length === 0;
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** The aio release the host's lock pins, or the reason the scaffold is not a host this CLI can deploy. */
function checkHostShape(dir: string): string {
  const manifest = readJson(join(dir, 'composer.json'));
  const require = manifest?.require as Record<string, unknown> | undefined;
  if (typeof require?.[AIO_PACKAGE] !== 'string') {
    throw new UsageError(`The created project's composer.json does not require ${AIO_PACKAGE}.`);
  }

  const packages = (readJson(join(dir, 'composer.lock'))?.packages ?? []) as { name?: unknown; version?: unknown }[];
  const aio = packages.find((entry) => entry.name === AIO_PACKAGE);
  if (aio === undefined || typeof aio.version !== 'string') {
    throw new UsageError(`The created project's composer.lock does not pin ${AIO_PACKAGE}.`);
  }

  for (const required of [BUNDLE, 'Dockerfile']) {
    if (!existsSync(join(dir, required))) {
      throw new UsageError(`The created project has no ${required}, so it cannot be deployed self-hosted.`);
    }
  }
  return aio.version;
}

export async function init(args: string[], context: Context): Promise<void> {
  if (args.includes('--cloud')) {
    throw new UsageError(
      'Hosted sites are created by signing up, not from this command; init scaffolds a self-hosted site.',
    );
  }

  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      'self-host': { type: 'boolean' },
      template: { type: 'string' },
      industry: { type: 'string' },
      domain: { type: 'string' },
      server: { type: 'string' },
      'server-path': { type: 'string' },
      'host-version': { type: 'string' },
      repository: { type: 'string' },
    },
  });

  const [directory, extra] = positionals;
  if (directory === undefined || extra !== undefined) {
    throw new UsageError(`Name the directory to create.\nUsage: ${INIT_USAGE}`);
  }

  const siteType = option(values.template, KEY, '--template', 'a site type key such as landing');
  let industry = option(values.industry, KEY, '--industry', 'an industry key such as software');
  // aio builds a site type out of one industry's starter content, and refuses a type named without one.
  if (siteType !== null && industry === null) {
    const answer = (
      await context.ask(`Industry whose starter content builds the ${siteType} site (such as software): `)
    )?.trim();
    if (answer === undefined || !KEY.test(answer)) {
      throw new UsageError(`--template needs --industry: a site type is built from one industry's starter content.`);
    }
    industry = answer;
  }
  const domain = option(values.domain, DOMAIN, '--domain', 'a host name such as www.example.com');
  const server = option(
    values.server,
    SERVER,
    '--server',
    'an SSH destination such as ssh://deploy@server.example.com',
  );
  const serverPath = option(
    values['server-path'],
    SERVER_PATH,
    '--server-path',
    'a directory path without spaces or ..',
  );
  if (serverPath !== null && server === null) {
    throw new UsageError('--server-path names a directory on the server; give --server as well.');
  }
  const repository = repositoryOption(values.repository);

  const target = resolve(context.cwd, directory);
  const existed = existsSync(target);
  if (existed && !isEmptyDirectory(target)) {
    throw new UsageError(`${directory} already exists and is not empty.`);
  }

  await assertDocker(context);

  const user = process.getuid === undefined ? [] : ['--user', `${process.getuid()}:${process.getgid!()}`];
  const credential = context.env.COMPOSER_AUTH === undefined ? [] : ['-e', 'COMPOSER_AUTH'];
  const { code } = await context.runner('docker', [
    'run',
    '--rm',
    ...user,
    ...credential,
    '-e',
    'COMPOSER_HOME=/tmp/composer',
    '-v',
    `${dirname(target)}:/app`,
    '-w',
    '/app',
    COMPOSER_IMAGE,
    'create-project',
    '--no-install',
    '--no-scripts',
    '--no-interaction',
    ...(repository === null ? [] : [`--repository=${repository}`]),
    HOST_PACKAGE,
    basename(target),
    ...(values['host-version'] === undefined ? [] : [values['host-version']]),
  ]);

  // A half-made project would read as a finished one on the next run, so it goes.
  const discard = (): void => {
    if (!existsSync(target)) {
      return;
    }
    if (existed) {
      for (const entry of readdirSync(target)) {
        rmSync(join(target, entry), { recursive: true, force: true });
      }
    } else {
      rmSync(target, { recursive: true, force: true });
    }
  };

  if (code !== 0) {
    discard();
    throw new UsageError(`Composer could not create the project (exit ${code}); its output is above.`);
  }

  let aioVersion: string;
  try {
    aioVersion = checkHostShape(target);
  } catch (error) {
    discard();
    throw error;
  }

  writeProject(target, {
    industry,
    siteType,
    domain,
    url: siteUrl(domain),
    server,
    serverPath: server === null ? null : (serverPath ?? `appsolutely/${composeProjectName(target)}`),
  });

  context.stdout(
    [
      `Created ${directory}: a host project on ${AIO_PACKAGE} ${aioVersion}, with the self-host bundle in ${dirname(BUNDLE)}/.`,
      'Bring it up with:',
      `  cd ${directory}`,
      '  npx @appsolutely/cli deploy',
    ].join('\n'),
  );
}
