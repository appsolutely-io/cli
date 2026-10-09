#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { main } from './main.ts';
import { spawnRunner } from './process.ts';

process.exitCode = await main(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  interactive: process.stdin.isTTY === true,
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
  runner: spawnRunner,
  fetch: globalThis.fetch,
  ask: async (question) => {
    const lines = createInterface({ input: process.stdin, output: process.stderr });
    // Input that ends before a line arrives is no answer rather than an empty one.
    const ended = new Promise<null>((resolve) => lines.once('close', () => resolve(null)));
    try {
      return await Promise.race([lines.question(question), ended]);
    } finally {
      lines.close();
    }
  },
});
