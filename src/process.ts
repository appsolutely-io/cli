import { spawn } from 'node:child_process';
import type { Runner } from './context.ts';

/** The runner the CLI uses: the program's output reaches the terminal unless it is captured. */
export const spawnRunner: Runner = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const env: Record<string, string | undefined> = { ...process.env, ...options.env };
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete env[key];
      }
    }

    const child = spawn(command, args, {
      cwd: options.cwd,
      env,
      stdio: [
        options.input === undefined ? 'inherit' : 'pipe',
        options.capture || options.record ? 'pipe' : 'inherit',
        options.record ? 'pipe' : 'inherit',
      ],
    });

    let stdout = '';
    let output = '';
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
      if (options.record) {
        output += chunk;
        process.stdout.write(chunk);
      }
    });
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk;
      process.stderr.write(chunk);
    });
    child.on('error', (error: NodeJS.ErrnoException) =>
      reject(error.code === 'ENOENT' ? new Error(`${command} is not installed or not on PATH.`) : error),
    );
    child.on('close', (code, signal) =>
      resolve({ code: code ?? (signal === null ? 1 : 128), stdout, ...(options.record ? { output } : {}) }),
    );
    child.stdin?.end(options.input);
  });
