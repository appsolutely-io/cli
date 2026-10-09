import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { UsageError } from './context.ts';

export const PROJECT_FILE = 'appsolutely.json';

/** What `init` decided about a project, read back by `deploy` and `generate-sdk`. */
export interface Project {
  /** Industry key whose starter content the first deploy applies, or null to be asked then. */
  industry: string | null;
  /** Site type key to build the site as, or null for the industry's own default. */
  siteType: string | null;
  /** Host name the site answers on, or null for localhost. */
  domain: string | null;
  /** The install's address, which `generate-sdk` reads the API document from. */
  url: string;
  /**
   * The server `deploy` brings the bundle up on, as an SSH destination, or null for this machine. Compose
   * runs there, beside the bundle and the .env its install writes, because the bundle's bind mounts and
   * its .env are read where Compose runs.
   */
  server: string | null;
  /** The directory on the server holding the bundle; relative to the SSH user's home unless absolute. */
  serverPath: string | null;
}

/** Industry and site type keys as aio registers them. */
export const KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const DOMAIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export const SERVER = /^ssh:\/\/[A-Za-z0-9._-]+@[A-Za-z0-9.-]+(:\d{1,5})?$/;
export const SERVER_PATH = /^(?!.*(^|\/)\.\.(\/|$))[A-Za-z0-9._/-]+$/;

export function siteUrl(domain: string | null): string {
  return `https://${domain ?? 'localhost'}`;
}

function nullable(value: unknown, pattern: RegExp, field: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new UsageError(`${PROJECT_FILE}: ${field} is ${JSON.stringify(value)}, which is not valid here.`);
  }
  return value;
}

export function readProject(dir: string): Project {
  let text: string;
  try {
    text = readFileSync(join(dir, PROJECT_FILE), 'utf8');
  } catch {
    throw new UsageError(`No ${PROJECT_FILE} in ${dir}; run this inside a project appsolutely init made.`);
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new UsageError(`${PROJECT_FILE} is not JSON.`);
  }

  const url = raw.url;
  if (typeof url !== 'string' || !/^https?:\/\/[^/?#]+$/.test(url)) {
    throw new UsageError(`${PROJECT_FILE}: url is ${JSON.stringify(url)}; it must be an http(s) origin.`);
  }

  const server = nullable(raw.server, SERVER, 'server');
  const serverPath = nullable(raw.serverPath, SERVER_PATH, 'serverPath');
  // deploy builds on the server's engine when server is set and runs Compose there only with both, so half
  // a pair would build in one place and run in another.
  if ((server === null) !== (serverPath === null)) {
    throw new UsageError(
      server === null
        ? `${PROJECT_FILE}: serverPath is set but server is not; add the server (ssh://user@host) or remove serverPath.`
        : `${PROJECT_FILE}: server is set but serverPath is not; add the directory on the server or remove server.`,
    );
  }

  return {
    industry: nullable(raw.industry, KEY, 'industry'),
    siteType: nullable(raw.siteType, KEY, 'siteType'),
    domain: nullable(raw.domain, DOMAIN, 'domain'),
    url,
    server,
    serverPath,
  };
}

export function writeProject(dir: string, project: Project): void {
  writeFileSync(join(dir, PROJECT_FILE), `${JSON.stringify(project, null, 2)}\n`);
}

/** Compose accepts lower-case letters, digits, dashes and underscores, starting with a letter or digit. */
export function composeProjectName(dir: string): string {
  const name = basename(dir)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  if (name === '') {
    throw new UsageError(`The directory name "${basename(dir)}" cannot name a Compose project; rename it.`);
  }
  return name;
}
