import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { type Context, type RunResult, UsageError } from '../context.ts';
import { assertDocker } from '../docker.ts';
import { composeProjectName, PROJECT_FILE, type Project, readProject } from '../project.ts';

export const DEPLOY_USAGE = 'appsolutely deploy';

const IMAGE_TAG = 'latest';
/** The application migrates as it boots, under the bundle's own 300-second migration limit, then answers /up. */
const WAIT_SECONDS = '600';
/**
 * The service that serves the site. Only its healthcheck means "serving": the worker and the scheduler run
 * from the same image and inherit its web healthcheck, which never passes for them.
 */
const WEB_SERVICE = 'app';
const BUNDLE_FILE = 'compose.yaml';
/** The volume that holds the site's files; deploy's state lives and goes with the site. */
export const STATE_DIRECTORY = '/var/www/html/storage/app';
/** Written once aio:install has exited 0; deploy installs until it is there. */
const INSTALLED_MARKER = `${STATE_DIRECTORY}/.appsolutely-installed`;
const INSTALLED_LINE = 'installed';
const INSTALLED_CHECK = `if test -e ${INSTALLED_MARKER}; then echo ${INSTALLED_LINE}; fi`;
const INSTALL_SCRIPT = `php artisan aio:install "$@" && date -u > ${INSTALLED_MARKER}`;

interface AppliedPair {
  industry: string;
  siteType: string;
}

/**
 * The pair aio reports having applied, from `aio:starter-status --json`, whose shape aio keeps as a contract
 * (every key present, null where nothing is applied). The image's entrypoint prints its own lines first, so
 * the report is the last line that is a JSON object.
 */
function appliedPair(output: string): AppliedPair | null | undefined {
  for (const line of output.split('\n').reverse()) {
    let report: unknown;
    try {
      report = JSON.parse(line);
    } catch {
      continue;
    }
    if (report !== null && typeof report === 'object' && 'industry' in report && 'site_type' in report) {
      const { industry, site_type: siteType } = report as { industry: unknown; site_type: unknown };
      return typeof industry === 'string' && typeof siteType === 'string' ? { industry, siteType } : null;
    }
  }
  return undefined;
}

/**
 * Refuses what aio refuses for a site that has starter content (StarterContentApplier::claimSite): another
 * site type in the same industry, which aio:apply-starter --confirm changes by removing the old type's pages
 * first, and another industry, which aio does not change at all. A value left to aio's default asks for no
 * change.
 */
function refuseStarterChange(project: Project, applied: AppliedPair, command: (args: string[]) => string): void {
  if (project.industry === null) {
    return;
  }
  const built = `${applied.industry}/${applied.siteType}`;
  if (project.industry !== applied.industry) {
    throw new UsageError(
      [
        `The site was built as ${built}, and ${PROJECT_FILE} now asks for the industry ${project.industry}.`,
        `aio does not change the industry of a site that has starter content. Set industry back to ${applied.industry} to deploy it.`,
      ].join('\n'),
    );
  }
  if (project.siteType !== null && project.siteType !== applied.siteType) {
    throw new UsageError(
      [
        `The site was built as ${built}, and ${PROJECT_FILE} now asks for ${project.industry}/${project.siteType}.`,
        `Set siteType back to ${applied.siteType} to deploy the site as it is, or change the site type, which removes the ${applied.siteType} pages first, and deploy again:`,
        `  ${command(['run', '--rm', WEB_SERVICE, 'aio:apply-starter', `--industry=${project.industry}`, `--type=${project.siteType}`, '--confirm'])}`,
      ].join('\n'),
    );
  }
}

interface ComposeCall {
  capture?: boolean;
  record?: boolean;
  /** Give the command the terminal, for the questions aio:install asks when someone is there. */
  terminal?: boolean;
}

/** One shell word, quoted only when it has to be, for a command an SSH server runs through its shell. */
function shellWord(word: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`;
}

interface ComposeRunner {
  logsHint: string;
  /** The command, as a person would type it, that runs `args` where deploy runs Compose. */
  command: (args: string[]) => string;
  prepare: () => Promise<void>;
  run: (args: string[], call?: ComposeCall) => Promise<RunResult>;
}

/** Where Compose runs: here, beside the project's bundle, or on the server, beside its copy of the bundle. */
function composeRunner(context: Context, project: Project, environment: Record<string, string>): ComposeRunner {
  const assignments = Object.entries(environment).map(([key, value]) => `${key}=${value}`);
  if (project.server === null || project.serverPath === null) {
    const bundle = join(context.cwd, 'deploy');
    const local = (args: string[]): string[] => [
      'compose',
      '--project-directory',
      bundle,
      '-f',
      join(bundle, BUNDLE_FILE),
      ...args,
    ];
    return {
      logsHint: `docker compose -p ${environment.COMPOSE_PROJECT_NAME} logs ${WEB_SERVICE}`,
      command: (args: string[]): string => [...assignments, 'docker', ...local(args)].map(shellWord).join(' '),
      prepare: async (): Promise<void> => {},
      run: (args: string[], call: ComposeCall = {}): Promise<RunResult> =>
        context.runner('docker', local(args), {
          cwd: bundle,
          env: environment,
          capture: call.capture ?? false,
          ...(call.record ? { record: true } : {}),
        }),
    };
  }

  const { server, serverPath } = project;
  const ssh = (command: string[], call: ComposeCall & { input?: string } = {}): Promise<RunResult> =>
    context.runner('ssh', [...(call.terminal ? ['-t'] : []), server, command.map(shellWord).join(' ')], {
      capture: call.capture ?? false,
      ...(call.record ? { record: true } : {}),
      ...(call.input === undefined ? {} : { input: call.input }),
    });
  const remote = (args: string[]): string[] => [
    'env',
    ...assignments,
    'docker',
    'compose',
    '--project-directory',
    serverPath,
    '-f',
    `${serverPath}/${BUNDLE_FILE}`,
    ...args,
  ];
  return {
    logsHint: `ssh ${server} docker compose -p ${environment.COMPOSE_PROJECT_NAME} logs ${WEB_SERVICE}`,
    command: (args: string[]): string => `ssh ${server} ${shellWord(remote(args).map(shellWord).join(' '))}`,
    // The server's copy of the bundle is replaced on every deploy, so the server runs what the project holds.
    prepare: async (): Promise<void> => {
      const bundle = readFileSync(join(context.cwd, 'deploy', BUNDLE_FILE), 'utf8');
      const copied = await ssh(
        ['sh', '-c', `mkdir -p ${shellWord(serverPath)} && cat > ${shellWord(`${serverPath}/${BUNDLE_FILE}`)}`],
        {
          input: bundle,
        },
      );
      if (copied.code !== 0) {
        throw new UsageError(`The bundle could not be copied to ${server}:${serverPath}.`);
      }
    },
    run: (args: string[], call: ComposeCall = {}): Promise<RunResult> => ssh(remote(args), call),
  };
}

/**
 * Entrypoint steps a one-off read must not take: the Laravel automations (migrations among them) and the
 * preview-database step, which migrates on its own when PREVIEW_DB_AUTO is on.
 */
const QUIET_BOOT = ['-e', 'AUTORUN_ENABLED=false', '-e', 'PREVIEW_DB_AUTO=false'];

/** aio's StarterSiteMismatchException for another site type in the same industry, as aio:install prints it. */
const SITE_TYPE_REFUSAL =
  /starter content is '([a-z0-9-]+)\/([a-z0-9-]+)', not '([a-z0-9-]+)\/([a-z0-9-]+)'\. Nothing was written\. Changing the site type/;

/**
 * The pair aio reports for the site. The read runs with the entrypoint's automations off: the app service
 * migrates as it boots, and a read that migrated would put the new image's schema under the old containers
 * before deploy decides whether to go on.
 */
async function readAppliedPair(compose: ComposeRunner): Promise<AppliedPair | null> {
  const status = await compose.run(['run', '--rm', '-T', ...QUIET_BOOT, WEB_SERVICE, 'aio:starter-status', '--json'], {
    capture: true,
  });
  const applied = status.code === 0 ? appliedPair(status.stdout) : undefined;
  if (applied === undefined) {
    throw new UsageError(
      [
        `deploy could not read the site's starter content: aio:starter-status ${status.code === 0 ? 'ran, but no JSON returned' : `exited ${status.code}`}. deploy did not bring the site up; the read started the services the application depends on (the database, the cache and the proxy) as Compose does for a one-off run. It printed:`,
        status.stdout.trim() === '' ? '  (nothing)' : status.stdout.trimEnd(),
      ].join('\n'),
    );
  }
  return applied;
}

/**
 * Builds the project's own image and runs the self-host bundle on it, on this machine or on the server the
 * project names, by the same steps.
 */
export async function deploy(args: string[], context: Context): Promise<void> {
  parseArgs({ args, options: {} });

  const project = readProject(context.cwd);
  const name = composeProjectName(context.cwd);
  const image = `appsolutely-local/${name}`;
  // The image is built by the engine the bundle runs on, so it is there when Compose asks for it.
  const engine = project.server === null ? {} : { DOCKER_HOST: project.server };

  await assertDocker(context, engine);

  const secret = context.env.COMPOSER_AUTH === undefined ? [] : ['--secret', 'id=composer_auth,env=COMPOSER_AUTH'];
  const built = await context.runner('docker', ['build', '--tag', `${image}:${IMAGE_TAG}`, ...secret, context.cwd], {
    env: engine,
  });
  if (built.code !== 0) {
    throw new UsageError('The image did not build; the build output is above.');
  }

  const compose = composeRunner(context, project, {
    DOCKER_IMAGE: image,
    DOCKER_TAG: IMAGE_TAG,
    COMPOSE_PROJECT_NAME: name,
  });
  await compose.prepare();

  const state = await compose.run(
    ['run', '--rm', '--no-deps', '-T', '--entrypoint', 'sh', WEB_SERVICE, '-c', INSTALLED_CHECK],
    { capture: true },
  );
  if (state.code !== 0) {
    throw new UsageError(
      `deploy could not read whether the site is installed (exit ${state.code}); the output is above. Nothing was installed.`,
    );
  }
  const installed = state.stdout.split('\n').includes(INSTALLED_LINE);

  if (installed) {
    // An unfinished install needs no such check: aio:install refuses a pair the site was not built as itself.
    const applied = await readAppliedPair(compose);
    if (applied !== null) {
      refuseStarterChange(project, applied, compose.command);
    }
  } else {
    // The image builds the front-end bundles itself, so the install has none to fetch.
    const install = ['--skip-assets'];
    if (project.industry !== null) {
      install.push(`--industry=${project.industry}`);
      if (project.siteType !== null) {
        install.push(`--type=${project.siteType}`);
      }
    }
    if (project.domain !== null) {
      install.push(`--domain=${project.domain}`);
    }
    // Through the image's own entrypoint, which links the bundle's .env for the install to write.
    const ran = await compose.run(
      [
        'run',
        '--rm',
        ...(context.interactive ? [] : ['-T']),
        WEB_SERVICE,
        'sh',
        '-c',
        INSTALL_SCRIPT,
        'aio:install',
        ...install,
      ],
      { terminal: context.interactive, record: true },
    );
    if (ran.code !== 0) {
      // aio names the pair it refused but no command to run; only when that is why, say which.
      const refused = SITE_TYPE_REFUSAL.exec(ran.output ?? '');
      if (refused !== null) {
        refuseStarterChange(project, { industry: refused[1]!, siteType: refused[2]! }, compose.command);
      }
      throw new UsageError('The install did not finish; its output is above. Fix the cause and run deploy again.');
    }
  }

  const up = await compose.run(['up', '--detach']);
  if (up.code !== 0) {
    throw new UsageError('The bundle did not start; the output is above. Fix the cause and run deploy again.');
  }
  const ready = await compose.run(['up', '--detach', '--wait', '--wait-timeout', WAIT_SECONDS, WEB_SERVICE]);
  if (ready.code !== 0) {
    throw new UsageError(`The site did not come up healthy. See ${compose.logsHint}, then run deploy again.`);
  }

  context.stdout(`Serving ${project.url}`);
}
