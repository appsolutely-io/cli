# @appsolutely/cli

One command to scaffold a self-hosted Appsolutely site, one to bring it up, and one to generate a typed client for any install.

```sh
npx @appsolutely/cli init demo --self-host --template landing --industry software
cd demo
npx @appsolutely/cli deploy
npx @appsolutely/cli generate-sdk --lang ts
```

`asly` is the CLI's short name: `npx asly init demo …` is the same command. It comes from the `asly` package, so a global install gives `asly` with `npm install -g asly`; `appsolutely` and `asly` each belong to one package, so both can be installed, in either order.

The CLI orchestrates what the platform already ships: the host application and its self-host bundle, aio's own `aio:install`, and the `@appsolutely/sdk` generator pipeline. It holds no Laravel code and no generator configuration of its own.

## Requirements

- Node.js 22.18 or newer.
- Docker, with Compose v2.24 or newer. Nothing of PHP: Composer runs in its own image, and the site runs in the image `deploy` builds.

## Commands

### `appsolutely init <directory>`

Creates a host project in `<directory>`: the `appsolutely/appsolutely` host application at its latest release, which requires `appsolutely/aio` and pins it in `composer.lock`, with the self-host bundle in `deploy/compose.yaml`. Composer runs in the `composer:2` image with `--no-install`; the image `deploy` builds installs the locked packages.

| Option                         | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--self-host`                  | The only mode: a hosted site is created by signing up, not from a laptop.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `--template <site type>`       | The site type to build, such as `landing`. Without it the industry's own default is used.                                                                                                                                                                                                                                                                                                                                                                                             |
| `--industry <key>`             | The industry whose starter content builds the site, such as `software`. Asked for when a site type is given without one; refused when nobody can answer.                                                                                                                                                                                                                                                                                                                              |
| `--domain <host>`              | The host name the site answers on. The first deploy checks it can be certified and the bundle's Caddy obtains the certificate. Without it, `localhost`.                                                                                                                                                                                                                                                                                                                               |
| `--server ssh://<user>@<host>` | A server to deploy to instead of this machine. It needs Docker with Compose and SSH access for that user; `deploy` builds the image with the server's engine and runs Compose there.                                                                                                                                                                                                                                                                                                  |
| `--server-path <directory>`    | Where the bundle lives on the server, relative to the user's home unless absolute; letters, digits, `.`, `_`, `-` and `/`, with no `..` segment. Without it, `appsolutely/<name>`, where `<name>` is the Compose project name: the directory's name in lower case, each run of characters other than letters, digits, `_` and `-` made one dash, and leading and trailing dashes and underscores trimmed (so `My Shop` gives `my-shop`, and `a - b` gives `a---b`). Needs `--server`. |
| `--host-version <constraint>`  | The host release to start from, as a Composer constraint. Without it, the latest.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--repository <url>`           | A VCS repository holding the host package, for a fork or mirror, or before the package is on Packagist.                                                                                                                                                                                                                                                                                                                                                                               |

The choices are kept in `appsolutely.json` at the project's root, which `deploy` and `generate-sdk` read:

```json
{
  "industry": "software",
  "siteType": "landing",
  "domain": null,
  "url": "https://localhost",
  "server": null,
  "serverPath": null
}
```

### `appsolutely deploy`

Run inside the project. It builds the project's own image (`appsolutely-local/<directory>:latest`), so what you changed in the host is what runs, and brings the bundle up on it:

1. Until an install has finished, it runs the bundle's setup command, `aio:install`, with the recorded industry, site type and domain; a run that fails (an address that cannot be certified, a site type aio does not know) is simply run again by the next deploy, with whatever the project file says by then, and aio itself refuses a pair the site was not built as. A finished install leaves a marker on the site's file volume. The install writes `.env` beside the bundle (`deploy/.env`, or `.env` in `serverPath` on a server), which holds the application key: back it up. With nobody at the terminal, the administrator is handed over by a one-time sign-in link the install prints.
2. `docker compose up --detach` starts every service, and deploy returns once the application reports healthy. Only the application's healthcheck says the site is serving: the worker and the scheduler run from the same image and inherit its web healthcheck, which they never pass.

Later runs rebuild the image and recreate the services; the application migrates as it boots. Before that, deploy asks aio which industry and site type the site was built as (`aio:starter-status --json`, run with the image's boot-time automations and preview-database step off, so it migrates nothing; like any one-off Compose run it starts the services the application depends on) and stops where aio would: another site type in that industry, with the `aio:apply-starter --confirm` command that changes it (it removes the old type's pages first), and another industry, which aio does not change. An industry or a site type left out of the project file asks for no change. When an unfinished install fails and aio's own output says it refused the pair because the site was built as another site type, deploy prints the same command; any other failure points at the install's output above. When the project names a `server`, the same steps run there: the image is built by the server's Docker engine over SSH, the bundle is copied to `serverPath` on every deploy, and Compose runs on the server beside it, so `.env`, the backups and the volumes all live on the server. `server` and `serverPath` go together; a project file with one and not the other is refused.

### `appsolutely generate-sdk --lang ts`

Writes a typed TypeScript client for an install as a package tarball, `./appsolutely-sdk.tgz` (`--out` to change it; `--force` to replace an existing file). Add it to an app with `npm install ./appsolutely-sdk.tgz`; it installs and is used exactly like the published `@appsolutely/sdk`. A tarball rather than a directory because npm links a directory dependency without installing its dependencies.

It reads the API document the install serves at `/api/v1/openapi.json` (from `--url`, or the project's `url`), then runs the `@appsolutely/sdk` repository's own pipeline on it: the repository at the tag of an SDK release (the registry's latest, or `--sdk-version`), installed with its own lockfile, generated and packed. Because the generator is the release's own, an install serving the document a release was generated from gets that release, byte for byte, and the command says so. An install serving a different document, an older or newer aio, or a host with routes of its own, gets a client describing what it actually serves, and the written `package.json` records which document that was.

`--sdk-source <checkout>` runs a local checkout of the SDK repository instead of a release; the checkout is copied and never written to. Only `ts` has a generator pipeline.

An install served over HTTPS with a certificate Node does not trust, such as Caddy's local authority on `https://localhost`, needs that authority's root certificate in `NODE_EXTRA_CA_CERTS`.

## Environment

| Variable                                   | Used by          | For                                                                                                                  |
| ------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `COMPOSER_AUTH`                            | `init`, `deploy` | Composer's credential, while the host package or `appsolutely/aio` is private. Passed by name, never as an argument. |
| `npm_config_registry`                      | `generate-sdk`   | The npm registry to look the SDK release up in.                                                                      |
| `NODE_EXTRA_CA_CERTS`                      | `generate-sdk`   | A certificate authority to trust for an install's HTTPS.                                                             |
| `DOCKER_HOST` and the rest of Docker's own | `init`, `deploy` | Which engine Docker talks to on this machine; a project's `server` replaces it for `deploy`.                         |

## Develop

The scripts and tests are TypeScript run directly by Node, which needs Node.js 22.18 or newer.

```sh
pnpm install
pnpm verify
```

| Script                                            | What it does                                                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify`                                     | Formatting, the type check, the tests and the consumer check.                                                                                                            |
| `pnpm test`                                       | Unit tests. Docker, Composer, the network and the SDK pipeline are stood in for.                                                                                         |
| `pnpm check:consumer`                             | Packs the CLI, installs the tarball into a fresh project and runs the bin npm links, as `npx` does.                                                                      |
| `pnpm check:sdk-pipeline --sdk-source <checkout>` | Serves an SDK checkout's pinned document the way an install does, runs the built CLI against it and compares every file with the checkout's own pack. Needs the network. |

CI runs `pnpm verify`, and on a clean runner with Node and Docker only, runs `init` for a landing site and checks the project. While the host package and `appsolutely/aio` are private, that job needs a `COMPOSER_AUTH` secret and the `APPSOLUTELY_HOST_REPOSITORY` variable set to the host repository's URL.

[docs/transcript.md](docs/transcript.md) records one run end to end from an empty Docker engine: init, deploy, generate-sdk compared byte for byte with the SDK for the same aio release, both app starters, and a deploy to a server.

## Release

The owner publishes `@appsolutely/cli` to npm from `main` with `pnpm publish`; `prepack` builds it. Its version is its own and does not follow aio's. Then `asly/`, the package that makes `npx asly` run the CLI, is published at the same version from that directory with `npm publish`; its version and its dependency on the CLI move with the CLI's, which a test holds.

## Licence

MIT
