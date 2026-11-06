import { type Context, UsageError } from './context.ts';

export async function request<T>(
  context: Context,
  url: string,
  read: (response: Response) => Promise<T>,
  init?: RequestInit,
): Promise<T> {
  try {
    return await read(await context.fetch(url, init));
  } catch (error) {
    if (error instanceof UsageError) throw error;
    const cause = error instanceof Error ? error.cause : undefined;
    const code = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : undefined;
    const suffix = typeof code === 'string' && /^[A-Z][A-Z0-9_]+$/.exec(code)?.[0] === code ? `: ${code}` : '';
    throw new UsageError(`Could not reach ${url}${suffix}.`);
  }
}
