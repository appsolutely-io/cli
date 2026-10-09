// Removes the previous build, so a deleted source file never survives into a published package.
import { rmSync } from 'node:fs';

rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true });
