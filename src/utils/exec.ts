import { execSync } from 'node:child_process';

export function exec(
  command: string,
  options?: { cwd?: string; silent?: boolean },
): string {
  try {
    const result = execSync(command, {
      cwd: options?.cwd ?? process.cwd(),
      stdio: options?.silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
    });
    return result?.toString().trim() ?? '';
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${(error as Error).message}`);
  }
}

export function execSilent(command: string, cwd?: string): string {
  return exec(command, { cwd, silent: true });
}
