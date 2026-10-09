import { type Context, UsageError } from './context.ts';

/** Refuses early, in words, when there is no Docker engine to talk to. */
export async function assertDocker(context: Context, env: Record<string, string | undefined> = {}): Promise<void> {
  const { code } = await context.runner('docker', ['version', '--format', '{{.Server.Version}}'], {
    env,
    capture: true,
  });
  if (code !== 0) {
    throw new UsageError(
      env.DOCKER_HOST === undefined
        ? 'Docker is not running, or not installed. Start Docker and run this again.'
        : `Docker is not answering at ${env.DOCKER_HOST}.`,
    );
  }
}
