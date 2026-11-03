import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import { logger } from './logger.js';
import {
  resolveTucuUiChoice,
  type TucuUiChoice,
  type TucuUiState,
} from './tucu-ui-offer.js';

const SCRIPT = 'sdd/scripts/sdd-tucu.mjs';
export const TUCU_UI_ENABLE_COMMAND = 'pnpm sdd:tucu -- --enable';

export interface TucuUiRunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

function runTucuScript(cwd: string, mode: '--status' | '--enable'): TucuUiRunResult {
  const result = spawnSync(process.execPath, [resolve(cwd, SCRIPT), mode], {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? result.error?.message ?? '',
  };
}

export function readTucuUiState(cwd: string): TucuUiState {
  if (!existsSync(resolve(cwd, SCRIPT))) return 'off';
  const result = runTucuScript(cwd, '--status');
  if (!result.ok) return 'off';
  try {
    const status = JSON.parse(result.stdout) as { state?: string };
    return status.state === 'complete' || status.state === 'incomplete' ? status.state : 'off';
  } catch {
    return 'off';
  }
}

const TOOLS_FILE = 'sdd/tools.json';

export function readTucuUiSection(cwd: string): Record<string, unknown> | undefined {
  try {
    const tools = JSON.parse(readFileSync(resolve(cwd, TOOLS_FILE), 'utf-8')) as Record<string, unknown>;
    const section = tools['tucu_ui'];
    return section !== null && typeof section === 'object' && !Array.isArray(section)
      ? (section as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

export function restoreTucuUiSection(cwd: string, section: Record<string, unknown>): void {
  const path = resolve(cwd, TOOLS_FILE);
  try {
    const tools = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
    writeFileSync(path, `${JSON.stringify({ ...tools, tucu_ui: section }, null, 2)}\n`, 'utf-8');
  } catch {
    return;
  }
}

export function enableTucuUi(cwd: string): TucuUiRunResult {
  if (!existsSync(resolve(cwd, SCRIPT))) {
    return { ok: false, stdout: '', stderr: `${SCRIPT} not found in ${cwd}` };
  }
  return runTucuScript(cwd, '--enable');
}

export interface TucuUiOfferInput {
  flag: boolean | undefined;
  hasFrontend: boolean;
  interactive: boolean;
  current: TucuUiState;
}

export type TucuUiOfferOutcome = 'enabled' | 'failed' | 'declined' | 'skipped';

export function describeOfferMessage(choice: TucuUiChoice): string {
  return choice === 'ask-repair'
    ? 'tucu-ui is on but incomplete. Repair it now? (installs the skill with npx — needs network)'
    : 'Turn on the tucu-ui design skill + MCP? (writes sdd/integrations/skills/, the harness skill links and the tucu-ui MCP entry — needs network)';
}

export function logTucuUiSummary(outcome: TucuUiOfferOutcome): void {
  if (outcome === 'enabled') logger.success('tucu-ui: on (skill + MCP)');
  else if (outcome === 'declined') logger.info(`tucu-ui: off — ${TUCU_UI_ENABLE_COMMAND}`);
}

export type TucuUiDecision = 'enable' | 'declined' | 'skipped';

export async function decideTucuUiOffer(input: TucuUiOfferInput): Promise<TucuUiDecision> {
  const choice = resolveTucuUiChoice(input);

  if (choice === 'enable') return 'enable';

  if (choice === 'skip') {
    const mentionOff = input.flag === undefined && input.hasFrontend && input.current === 'off';
    return mentionOff ? 'declined' : 'skipped';
  }

  const answer = await p.confirm({
    message: describeOfferMessage(choice),
    initialValue: true,
  });
  return p.isCancel(answer) || !answer ? 'declined' : 'enable';
}

export function applyTucuUi(cwd: string): 'enabled' | 'failed' {
  logger.step('Turning on tucu-ui (skill + MCP)...');
  const result = enableTucuUi(cwd);
  if (result.ok) return 'enabled';
  const detail = (result.stderr || result.stdout).trim();
  logger.warn(
    `tucu-ui could not be turned on${detail ? `:\n${detail}` : '.'}\nThe rest of the setup is done. Retry with: ${TUCU_UI_ENABLE_COMMAND}`,
  );
  return 'failed';
}

export async function runTucuUiOffer(
  cwd: string,
  input: TucuUiOfferInput,
): Promise<TucuUiOfferOutcome> {
  const decision = await decideTucuUiOffer(input);
  const outcome = decision === 'enable' ? applyTucuUi(cwd) : decision;
  logTucuUiSummary(outcome);
  return outcome;
}
