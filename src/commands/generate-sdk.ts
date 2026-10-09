import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { type Context, UsageError } from '../context.ts';
import { readProject } from '../project.ts';
import { copySource, downloadSource, SDK_PACKAGE } from '../sdk-source.ts';

export const GENERATE_SDK_USAGE =
  'appsolutely generate-sdk --lang ts [--url <install>] [--out <file.tgz>] [--sdk-version <version> | --sdk-source <checkout>] [--force]';

/** The only language with a published generator pipeline to run. */
const LANGUAGES = ['ts'];
/** The public API version whose document the TypeScript SDK describes. */
const API_VERSION = 'v1';
/** Where the SDK pipeline reads the document it generates from. */
const PIPELINE_DOCUMENT = join('spec', 'openapi.yaml');

function installUrl(flag: string | undefined, context: Context): string {
  const raw = flag ?? (existsSync(join(context.cwd, 'appsolutely.json')) ? readProject(context.cwd).url : undefined);
  if (raw === undefined) {
    throw new UsageError('Pass --url <install>, or run this inside a project appsolutely init made.');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UsageError(`--url ${JSON.stringify(raw)} is not an absolute URL.`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || /[?#]/.test(raw)) {
    throw new UsageError(`--url ${JSON.stringify(raw)} must be an http(s) address with no query or fragment.`);
  }
  return raw.replace(/\/+$/, '');
}

/** The install's own description of its API, which is what a client for it has to match. */
async function fetchDocument(context: Context, url: string): Promise<string> {
  const response = await context.fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new UsageError(`The install answered ${response.status} at ${url}.`);
  }
  const text = await response.text();
  let document: { openapi?: unknown };
  try {
    document = JSON.parse(text);
  } catch {
    throw new UsageError(`${url} is not an OpenAPI document.`);
  }
  if (typeof document?.openapi !== 'string' || !document.openapi.startsWith('3.1.')) {
    throw new UsageError(`${url} serves OpenAPI ${String(document?.openapi)}; the SDK is generated from OpenAPI 3.1.`);
  }
  return text;
}

/**
 * What the npm exec that started this CLI hands down about itself. npx passes its own flags on as
 * npm_config_* (the package to run, the command, the project root) and the npx below would obey them
 * and run that package instead of pnpm. Settings a person exported (registry, proxy, certificates,
 * credentials) are not among them and reach the pipeline untouched.
 */
const NPM_EXEC_VARIABLES = new Set([
  'npm_config_package',
  'npm_config_call',
  'npm_config_yes',
  'npm_config_local_prefix',
  'npm_command',
  'npm_execpath',
  'npm_node_execpath',
  'init_cwd',
]);

function withoutNpmExec(env: Record<string, string | undefined>): Record<string, undefined> {
  return Object.fromEntries(
    Object.keys(env)
      .filter((name) => {
        const lower = name.toLowerCase();
        return NPM_EXEC_VARIABLES.has(lower) || lower.startsWith('npm_package_') || lower.startsWith('npm_lifecycle_');
      })
      .map((name) => [name, undefined]),
  );
}

function prepareOutput(out: string, force: boolean): void {
  if (existsSync(out) && !force) {
    throw new UsageError(`${out} exists; pass --force to replace it.`);
  }
}

/**
 * Generates the TypeScript client by running the SDK repository's own pipeline, with its own
 * lockfile, on the document the install serves: nothing about generating lives in this CLI, so
 * a document the SDK release was generated from comes out as that release, byte for byte.
 */
export async function generateSdk(args: string[], context: Context): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      lang: { type: 'string' },
      url: { type: 'string' },
      out: { type: 'string' },
      'sdk-version': { type: 'string' },
      'sdk-source': { type: 'string' },
      force: { type: 'boolean', default: false },
    },
  });

  if (values.lang === undefined) {
    throw new UsageError(`Pass --lang ts.\nUsage: ${GENERATE_SDK_USAGE}`);
  }
  if (!LANGUAGES.includes(values.lang)) {
    throw new UsageError(`--lang ${values.lang}: only ts has a generator pipeline.`);
  }
  if (values['sdk-version'] !== undefined && values['sdk-source'] !== undefined) {
    throw new UsageError('Pass --sdk-version or --sdk-source, not both.');
  }

  const install = installUrl(values.url, context);
  // A packed package rather than a directory: npm installs a tarball's dependencies with it, and links
  // a directory without them.
  const out = resolve(context.cwd, values.out ?? 'appsolutely-sdk.tgz');
  prepareOutput(out, values.force);

  const documentUrl = `${install}/api/${API_VERSION}/openapi.json`;
  const document = await fetchDocument(context, documentUrl);

  const work = mkdtempSync(join(tmpdir(), 'appsolutely-generate-sdk-'));
  try {
    const source = join(work, 'source');
    if (values['sdk-source'] === undefined) {
      mkdirSync(source);
      await downloadSource(context, values['sdk-version'], source);
    } else {
      copySource(resolve(context.cwd, values['sdk-source']), source);
    }

    const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
    if (manifest.name !== SDK_PACKAGE) {
      throw new UsageError(`The SDK source is ${String(manifest.name)}, not ${SDK_PACKAGE}.`);
    }
    // pnpm's own version, without the integrity hash corepack appends, so npx can fetch it.
    const packageManager = /^pnpm@\d+\.\d+\.\d+/.exec(String(manifest.packageManager))?.[0];
    if (packageManager === undefined) {
      throw new UsageError(`The SDK source declares no pnpm version to build with.`);
    }

    const pipelineEnv = withoutNpmExec(context.env);
    const pnpm = async (step: string[], capture = false): Promise<number> => {
      const { code } = await context.runner('npx', ['--yes', packageManager, ...step], {
        cwd: source,
        env: pipelineEnv,
        capture,
      });
      return code;
    };
    const required = async (step: string[]): Promise<void> => {
      if ((await pnpm(step)) !== 0) {
        throw new UsageError(
          `pnpm ${step[0] === 'run' ? step[1] : step[0]} failed in the SDK pipeline; its output is above.`,
        );
      }
    };

    await required(['install', '--frozen-lockfile']);
    writeFileSync(join(source, PIPELINE_DOCUMENT), document);
    // The pipeline's own drift check: it passes only when this document generates the committed client.
    const sameRevision = (await pnpm(['run', 'check:generated'], true)) === 0;
    const pin = manifest.appsolutely?.spec ?? {};
    if (!sameRevision) {
      // The release's pin names a document this client is not generated from; record the one it is.
      manifest.appsolutely = {
        ...manifest.appsolutely,
        spec: { source: documentUrl, sha256: createHash('sha256').update(document).digest('hex') },
      };
      writeFileSync(join(source, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    }
    await required(['run', 'generate']);
    const packed = join(work, 'packed');
    mkdirSync(packed);
    await required(['pack', '--pack-destination', packed]);

    const [tarball] = readdirSync(packed).filter((name) => name.endsWith('.tgz'));
    if (tarball === undefined) {
      throw new UsageError('pnpm pack wrote no package.');
    }
    mkdirSync(dirname(out), { recursive: true });
    copyFileSync(join(packed, tarball), out);

    context.stdout(
      sameRevision
        ? `Wrote ${out}: ${SDK_PACKAGE} ${manifest.version}, byte for byte, generated from aio ${pin.tag ?? pin.commit} — the document ${install} serves.`
        : `Wrote ${out}: a client for the document ${install} serves, which differs from the one ${SDK_PACKAGE} ${manifest.version} was generated from.`,
    );
    // A bare name would be looked up on the registry, so a relative path keeps its ./ prefix.
    const local = relative(context.cwd, out);
    context.stdout(`Install it with: npm install ${isAbsolute(local) || local.startsWith('..') ? out : `./${local}`}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
