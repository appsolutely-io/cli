# asly

The short name of [`@appsolutely/cli`](https://www.npmjs.com/package/@appsolutely/cli). It installs nothing of its own: `npx asly` runs the version of the CLI published with it.

```sh
npx asly init demo --self-host --template landing --industry software
cd demo
npx asly deploy
```

Installing `@appsolutely/cli` globally gives both `appsolutely` and `asly`, so there is no need to install this package as well.

See the [CLI's documentation](https://github.com/appsolutely-io/cli#readme) for every command.
