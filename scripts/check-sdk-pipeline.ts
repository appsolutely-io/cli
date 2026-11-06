// Proves generate-sdk reproduces an SDK release byte for byte: serves an SDK checkout's own pinned
// document as an install would (JSON at /api/v1/openapi.json), runs the built CLI against it with
// that checkout as the source, and compares every file with the checkout's own `pnpm pack`.
// Not part of verify: it needs an SDK checkout and the network for the pipeline's install.
//   pnpm build && pnpm check:sdk-pipeline --sdk-source <sdk-ts checkout>
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { copySource } from '../src/sdk-source.ts';

const { values } = parseArgs({ options: { 'sdk-source': { type: 'string' } } });
if (values['sdk-source'] === undefined) {
  throw new Error('Pass --sdk-source <sdk-ts checkout>.');
}
const source = resolve(values['sdk-source']);
const work = mkdtempSync(join(tmpdir(), 'cli-sdk-pipeline-'));

function files(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();
}

try {
  const reference = join(work, 'reference');
  copySource(source, reference);
  execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: reference, stdio: 'ignore' });
  execFileSync('pnpm', ['pack', '--pack-destination', work], { cwd: reference, stdio: 'ignore' });
  const tarball = readdirSync(work).find((name) => name.endsWith('.tgz'))!;
  const expected = join(work, 'expected');
  mkdirSync(expected);
  execFileSync('tar', ['-xzf', join(work, tarball), '-C', expected, '--strip-components=1']);

  const { parse } = createRequire(join(reference, 'package.json'))('yaml') as { parse: (text: string) => unknown };
  const document = JSON.stringify(parse(readFileSync(join(reference, 'spec', 'openapi.yaml'), 'utf8')));
  const server = createServer((request, response) => {
    response.writeHead(request.url === '/api/v1/openapi.json' ? 200 : 404, { 'Content-Type': 'application/json' });
    response.end(request.url === '/api/v1/openapi.json' ? document : '{}');
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as { port: number };

  const written = join(work, 'generated.tgz');
  try {
    const cli = new URL('../dist/cli.js', import.meta.url).pathname;
    const args = ['generate-sdk', '--lang', 'ts', '--url', `http://127.0.0.1:${port}`, '--sdk-source', source];
    // Asynchronous, so this process keeps serving the document while the CLI fetches it.
    const { stdout } = await promisify(execFile)(process.execPath, [cli, ...args, '--out', written]);
    process.stdout.write(stdout);
  } finally {
    server.close();
  }

  const generated = join(work, 'generated');
  mkdirSync(generated);
  execFileSync('tar', ['-xzf', written, '-C', generated, '--strip-components=1']);

  const want = files(expected);
  const got = files(generated);
  if (JSON.stringify(want) !== JSON.stringify(got)) {
    throw new Error(`Different files:\nexpected ${want.join(', ')}\ngot ${got.join(', ')}`);
  }
  const differing = want.filter(
    (file) => !readFileSync(join(expected, file)).equals(readFileSync(join(generated, file))),
  );
  if (differing.length > 0) {
    throw new Error(`Different bytes in ${differing.join(', ')}`);
  }
  const sameArchive = readFileSync(join(work, tarball)).equals(readFileSync(written));
  console.log(
    `generate-sdk reproduced ${tarball}: ${want.length} files, byte for byte` +
      (sameArchive ? ', in an identical archive.' : '; the archives differ only in packing.'),
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
