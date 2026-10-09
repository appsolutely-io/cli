export interface RunOptions {
  cwd?: string;
  /** Added to the inherited environment; an undefined value removes the variable. */
  env?: Record<string, string | undefined>;
  /** Written to the command's standard input, which is otherwise the terminal's. */
  input?: string;
  /** Collect standard output and return it instead of passing it through. */
  capture?: boolean;
  /** Pass both streams through and also return what they printed, together, as `output`. */
  record?: boolean;
}

export interface RunResult {
  code: number;
  stdout: string;
  /** Both streams together, when the run was recorded. */
  output?: string;
}

/** Runs a program with arguments as given, never through a shell. */
export type Runner = (command: string, args: readonly string[], options?: RunOptions) => Promise<RunResult>;

/** Everything a command touches outside its own arguments, so a test can stand in for each. */
export interface Context {
  cwd: string;
  env: Record<string, string | undefined>;
  /** Whether a person is at the terminal to answer the questions a command it runs may ask. */
  interactive: boolean;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  runner: Runner;
  fetch: typeof fetch;
  /** One line read from standard input after printing the question, or null when input has ended. */
  ask: (question: string) => Promise<string | null>;
}

/** A refusal whose message is the whole story: printed without a stack. */
export class UsageError extends Error {}
