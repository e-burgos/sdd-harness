import { execFile } from 'node:child_process';
import path from 'node:path';
import { KitGateResult } from '@sdd-studio/protocol';

export const GATE_TIMEOUT_MS = 20_000;
const GATE_MAX_BUFFER = 1024 * 1024;
const GATE_SCRIPT = 'sdd/scripts/spec-gate.mjs';
const GATE_USAGE_EXIT = 2;

export interface GateRunResult {
  code: number;
  stdout: string;
}

export type GateRunner = (args: string[], timeoutMs: number) => Promise<GateRunResult>;

export class GateCheckError extends Error {
  constructor(
    readonly code: 'bad-request' | 'internal',
    message: string,
  ) {
    super(message);
  }
}

export function createGateRunner(root: string): GateRunner {
  return (args, timeoutMs) =>
    new Promise((resolve) => {
      execFile(
        process.execPath,
        [path.join(root, GATE_SCRIPT), ...args],
        { cwd: root, timeout: timeoutMs, maxBuffer: GATE_MAX_BUFFER, encoding: 'utf8', windowsHide: true },
        (error, stdout) => {
          if (!error) return resolve({ code: 0, stdout });
          const code = (error as { code?: unknown }).code;
          resolve({ code: typeof code === 'number' ? code : -1, stdout: typeof stdout === 'string' ? stdout : '' });
        },
      );
    });
}

function usageMessage(stdout: string): string {
  try {
    const error = (JSON.parse(stdout) as { error?: unknown }).error;
    if (typeof error === 'string' && error.length > 0) return error.slice(0, 256);
  } catch {
    return 'spec-gate rejected the arguments';
  }
  return 'spec-gate rejected the arguments';
}

export async function readGateCheck(
  root: string,
  spec: string,
  cycle: string | undefined,
  run: GateRunner = createGateRunner(root),
): Promise<KitGateResult> {
  const result = await run([spec, ...(cycle ? [cycle] : []), '--json'], GATE_TIMEOUT_MS);
  if (result.code === GATE_USAGE_EXIT) throw new GateCheckError('bad-request', usageMessage(result.stdout));
  if (result.code !== 0 && result.code !== 1) throw new GateCheckError('internal', `spec-gate failed (${result.code})`);
  let raw: unknown;
  try {
    raw = JSON.parse(result.stdout);
  } catch {
    throw new GateCheckError('internal', 'spec-gate returned an unreadable result');
  }
  const parsed = KitGateResult.safeParse(raw);
  if (!parsed.success) throw new GateCheckError('internal', 'spec-gate returned an unreadable result');
  return parsed.data;
}
