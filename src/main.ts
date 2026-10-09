import { readFileSync } from 'node:fs';
import { deploy, DEPLOY_USAGE } from './commands/deploy.ts';
import { generateSdk, GENERATE_SDK_USAGE } from './commands/generate-sdk.ts';
import { init, INIT_USAGE } from './commands/init.ts';
import { type Context, UsageError } from './context.ts';

interface Command {
  usage: string;
  run: (args: string[], context: Context) => Promise<void>;
}

const commands: Record<string, Command> = {
  init: { usage: INIT_USAGE, run: init },
  deploy: { usage: DEPLOY_USAGE, run: deploy },
  'generate-sdk': { usage: GENERATE_SDK_USAGE, run: generateSdk },
};

function version(): string {
  return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
}

function usage(): string {
  return ['Usage:', ...Object.values(commands).map((command) => `  ${command.usage}`), '  appsolutely --version'].join(
    '\n',
  );
}

/** Runs one invocation and returns its exit code. */
export async function main(argv: string[], context: Context): Promise<number> {
  const [name, ...args] = argv;

  if (name === '--version' || name === '-v') {
    context.stdout(version());
    return 0;
  }
  if (name === undefined || name === '--help' || name === '-h' || name === 'help') {
    context.stdout(usage());
    return 0;
  }

  const command = commands[name];
  if (command === undefined) {
    context.stderr(`Unknown command "${name}".\n${usage()}`);
    return 1;
  }

  try {
    await command.run(args, context);
    return 0;
  } catch (error) {
    if (error instanceof UsageError || (error as { code?: unknown }).code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
      context.stderr(`appsolutely ${name}: ${(error as Error).message}`);
      return 1;
    }
    throw error;
  }
}
