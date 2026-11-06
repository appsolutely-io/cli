# Link one command, asly, from the scoped package

## Decision

`@appsolutely-io/cli` links one command, `asly`, and no other package links it. `npx @appsolutely-io/cli` and a global install of the package run the same command.

## Rationale

`asly` is short to type and is the name every usage line and refusal prints, so a person reads one name whichever way they started the CLI. With a single package owning the command, a global install never collides with another package's executable, and argument parsing and command behaviour live in one implementation.

## Alternatives and costs

A separate unscoped `asly` package would let `npx asly` work without the scope, but it would link the same command as the scoped package, so installing both globally fails with an existing-file collision, and every release would need a second publication pinned to the matching CLI version. Without it, `npx` needs the scoped name, which is longer to type once; after a global install the command is `asly` either way.

## Current implementation

[`package.json`](../../package.json) links `asly` and sets public access for the scoped package. `PROGRAM` in [`src/context.ts`](../../src/context.ts) is the name the usage and refusals print. [`test/package.test.ts`](../../test/package.test.ts) pins the package name, its single command and its access; [`test/main.test.ts`](../../test/main.test.ts) holds the usage to the command the package links; `pnpm check:consumer` installs the packed tarball and runs `asly`. The [README](../../README.md) explains installation and the release steps.
