import { resolve } from 'node:path';
import { confirm, isCancel } from '@clack/prompts';

export const dirArg = {
  type: 'string',
  description: 'Project directory (default: current directory)',
  default: '.',
} as const;

export function resolveDir(dir: unknown): string {
  return resolve(process.cwd(), typeof dir === 'string' && dir ? dir : '.');
}

export function printJson(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

export function printLine(text: string): void {
  process.stdout.write(`${text}\n`);
}

export function printError(text: string): void {
  process.stderr.write(`${text}\n`);
}

export const GH_INSTALL_HELP =
  'GitHub CLI (gh) is not installed. Install it with `brew install gh` or from https://cli.github.com.';
export const GH_AUTH_HELP = 'GitHub CLI is not authenticated. Run `gh auth login` and try again.';

export type ConfirmDecision = 'confirmed' | 'declined' | 'needs-confirmation';

export async function decideConfirmation(opts: {
  yes: boolean;
  json: boolean;
  message: string;
}): Promise<ConfirmDecision> {
  if (opts.yes) return 'confirmed';
  if (opts.json || !process.stdin.isTTY) return 'needs-confirmation';
  const answer = await confirm({ message: opts.message });
  return isCancel(answer) || answer !== true ? 'declined' : 'confirmed';
}
