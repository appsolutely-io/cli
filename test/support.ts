import type { Context, Runner, RunOptions } from '../src/context.ts';

export interface Call {
  command: string;
  args: readonly string[];
  options: RunOptions;
}

/** A context whose output is collected and whose commands are answered by `answer`, recorded in order. */
export function testContext(
  overrides: Partial<Context> = {},
  answer: (
    call: Call,
  ) =>
    | Promise<{ code: number; stdout?: string; output?: string }>
    | { code: number; stdout?: string; output?: string } = () => ({
    code: 0,
  }),
): { context: Context; out: string[]; err: string[]; calls: Call[] } {
  const out: string[] = [];
  const err: string[] = [];
  const calls: Call[] = [];
  const runner: Runner = async (command, args, options = {}) => {
    const call = { command, args, options };
    calls.push(call);
    const result = await answer(call);
    return {
      code: result.code,
      stdout: result.stdout ?? '',
      ...(result.output === undefined ? {} : { output: result.output }),
    };
  };
  const context: Context = {
    cwd: '/nowhere',
    env: {},
    interactive: false,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    runner,
    fetch: async () => {
      throw new Error('no network in tests');
    },
    ask: async () => null,
    ...overrides,
  };
  return { context, out, err, calls };
}
