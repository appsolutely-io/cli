# asly

The short name of [`@appsolutely/cli`](https://www.npmjs.com/package/@appsolutely/cli). It installs nothing of its own: `npx asly` runs the version of the CLI published with it.

```sh
npx asly init demo --self-host --template landing --industry software
cd demo
npx asly deploy
```

`npm install -g asly` gives the `asly` command; `npm install -g @appsolutely/cli` gives `appsolutely`. Each command belongs to one package, so both can be installed, in either order.

See the [CLI's documentation](https://github.com/appsolutely-io/cli#readme) for every command.
