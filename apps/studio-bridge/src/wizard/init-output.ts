export type InitMode = 'nx' | 'standalone';

export type StageSignal =
  | { type: 'stage'; stage: 'install' | 'generate' | 'validate' }
  | { type: 'gate'; check: 'validate' | 'build'; result: 'pass' | 'fail' }
  | { type: 'problem'; problem: 'network' | 'pnpm-missing' };

const ANSI = /\u001B\[[0-9;?]*[ -/]*[@-~]/g;
const CLACK_PREFIX = /^[\s│◇●◆└┌├╮╯]+/;

const INSTALL = [/Installing .*\(pnpm install/, /Initializing Nx workspace/];
const GENERATE = [/Generating Docker Compose/, /Configuring SDD/, /Generating lib:/, /Generating app:/, /Seeding \d+ module/];
const VALIDATE = /FASE 3 gate/;
const NETWORK = [/ERR_PNPM_META_FETCH_FAIL/, /ENOTFOUND/, /EAI_AGAIN/, /ECONNREFUSED/, /ETIMEDOUT/, /getaddrinfo/];
const PNPM_MISSING = [/pnpm: command not found/, /'pnpm' is not recognized/, /spawn pnpm ENOENT/];
const VALIDATE_PASS = /\[x\] sdd:validate/;
const VALIDATE_FAIL = /\[ \] sdd:validate — FAILED/;
const BUILD_BY_MODE: Record<InitMode, { pass: RegExp; fail: RegExp }> = {
  nx: { pass: /\[x\] nx run-many -t lint test build/, fail: /\[ \] nx run-many -t lint test build — FAILED/ },
  standalone: { pass: /\[x\] pnpm (lint|test|build)\b/, fail: /\[ \] pnpm (lint|test|build) — FAILED/ },
};

export const stripTerminalNoise = (line: string): string => line.replace(ANSI, '').replace(CLACK_PREFIX, '').trimEnd();

const matchesAny = (patterns: RegExp[], text: string) => patterns.some((pattern) => pattern.test(text));

export function classifyInitLine(rawLine: string, mode: InitMode): StageSignal | null {
  const line = stripTerminalNoise(rawLine);
  if (line === '') return null;
  const build = BUILD_BY_MODE[mode];
  if (VALIDATE_PASS.test(line)) return { type: 'gate', check: 'validate', result: 'pass' };
  if (VALIDATE_FAIL.test(line)) return { type: 'gate', check: 'validate', result: 'fail' };
  if (build.pass.test(line)) return { type: 'gate', check: 'build', result: 'pass' };
  if (build.fail.test(line)) return { type: 'gate', check: 'build', result: 'fail' };
  if (VALIDATE.test(line)) return { type: 'stage', stage: 'validate' };
  if (matchesAny(INSTALL, line)) return { type: 'stage', stage: 'install' };
  if (matchesAny(GENERATE, line)) return { type: 'stage', stage: 'generate' };
  if (matchesAny(PNPM_MISSING, line)) return { type: 'problem', problem: 'pnpm-missing' };
  if (matchesAny(NETWORK, line)) return { type: 'problem', problem: 'network' };
  return null;
}
