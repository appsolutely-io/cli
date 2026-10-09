import { cpSync, writeFileSync } from 'node:fs';
import { type Context, UsageError } from './context.ts';

export const SDK_PACKAGE = '@appsolutely/sdk';
const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

/** A checkout copied without what its own install and build recreate, so the original is never written. */
export function copySource(from: string, to: string): void {
  cpSync(from, to, {
    recursive: true,
    filter: (path) => !/[/\\](node_modules|dist|\.git)$/.test(path),
  });
}

async function json(context: Context, url: string, what: string): Promise<Record<string, unknown>> {
  const response = await context.fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new UsageError(`${what} answered ${response.status} at ${url}.`);
  }
  return (await response.json()) as Record<string, unknown>;
}

/** owner/name of a GitHub repository URL as npm records it, or null for any other host. */
function githubRepository(url: unknown): string | null {
  const match = typeof url === 'string' ? /github\.com[/:]([^/]+)\/([^/#]+?)(\.git)?(#.*)?$/.exec(url) : null;
  return match === null ? null : `${match[1]}/${match[2]}`;
}

/**
 * Places the SDK repository at the tag of a release in `to`: the version is the registry's latest
 * unless named, and the repository is the one that release's manifest names, so neither is
 * written down here.
 */
export async function downloadSource(context: Context, version: string | undefined, to: string): Promise<void> {
  const registry = (context.env.npm_config_registry ?? DEFAULT_REGISTRY).replace(/\/?$/, '/');
  const metadata = await json(context, `${registry}${SDK_PACKAGE.replace('/', '%2f')}`, 'The npm registry');
  const versions = (metadata.versions ?? {}) as Record<string, { repository?: { url?: unknown } }>;
  const wanted = version ?? (metadata['dist-tags'] as Record<string, string> | undefined)?.latest ?? '';
  const release = versions[wanted];
  if (release === undefined) {
    throw new UsageError(`${SDK_PACKAGE} has no version ${wanted === '' ? '(none is published)' : wanted}.`);
  }

  const repository = githubRepository(release.repository?.url);
  if (repository === null) {
    throw new UsageError(`${SDK_PACKAGE} ${wanted} does not name a GitHub repository to generate from.`);
  }

  const url = `https://codeload.github.com/${repository}/tar.gz/refs/tags/v${wanted}`;
  const response = await context.fetch(url);
  if (!response.ok) {
    throw new UsageError(`GitHub answered ${response.status} for the source of ${SDK_PACKAGE} ${wanted} at ${url}.`);
  }
  const archive = `${to}.tgz`;
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));

  const extracted = await context.runner('tar', ['-xzf', archive, '-C', to, '--strip-components=1']);
  if (extracted.code !== 0) {
    throw new UsageError(`The source archive of ${SDK_PACKAGE} ${wanted} did not extract.`);
  }
}
