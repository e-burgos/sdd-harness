import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from './logger.js';

const SCRIPT = 'sdd/scripts/sdd-video.mjs';
const TOOLS_FILE = 'sdd/tools.json';
export const VIDEO_MAKER_ENABLE_COMMAND = 'pnpm sdd:video -- --enable';

export type VideoMakerState = 'off' | 'complete' | 'incomplete';

export interface VideoMakerRunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

function runVideoMakerScript(cwd: string, mode: '--status' | '--enable'): VideoMakerRunResult {
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

export function readVideoMakerState(cwd: string): VideoMakerState {
  if (!existsSync(resolve(cwd, SCRIPT))) return 'off';
  const result = runVideoMakerScript(cwd, '--status');
  if (!result.ok) return 'off';
  try {
    const status = JSON.parse(result.stdout) as { state?: string };
    return status.state === 'complete' || status.state === 'incomplete' ? status.state : 'off';
  } catch {
    return 'off';
  }
}

export function readVideoMakerSection(cwd: string): Record<string, unknown> | undefined {
  try {
    const tools = JSON.parse(readFileSync(resolve(cwd, TOOLS_FILE), 'utf-8')) as Record<string, unknown>;
    const section = tools['video_maker'];
    return section !== null && typeof section === 'object' && !Array.isArray(section)
      ? (section as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

export function restoreVideoMakerSection(cwd: string, section: Record<string, unknown>): void {
  const path = resolve(cwd, TOOLS_FILE);
  try {
    const tools = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
    writeFileSync(path, `${JSON.stringify({ ...tools, video_maker: section }, null, 2)}\n`, 'utf-8');
  } catch {
    return;
  }
}

export function enableVideoMaker(cwd: string): VideoMakerRunResult {
  if (!existsSync(resolve(cwd, SCRIPT))) {
    return { ok: false, stdout: '', stderr: `${SCRIPT} not found in ${cwd}` };
  }
  return runVideoMakerScript(cwd, '--enable');
}

export type VideoMakerOutcome = 'enabled' | 'failed' | 'skipped';

export function applyVideoMaker(cwd: string): 'enabled' | 'failed' {
  logger.step('Turning on video-maker (Claude Code plugin + MCP)...');
  const result = enableVideoMaker(cwd);
  if (result.ok) return 'enabled';
  const detail = (result.stderr || result.stdout).trim();
  logger.warn(
    `video-maker could not be turned on${detail ? `:\n${detail}` : '.'}\nThe rest of the setup is done. Retry with: ${VIDEO_MAKER_ENABLE_COMMAND}`,
  );
  return 'failed';
}

export function logVideoMakerSummary(outcome: VideoMakerOutcome): void {
  if (outcome === 'enabled') logger.success('video-maker: on (plugin + MCP)');
}

export function hasConflictingVideoMakerFlags(rawArgs: readonly string[]): boolean {
  const names = new Set(rawArgs.filter((arg) => arg.startsWith('--')).map((arg) => arg.split('=')[0]));
  return names.has('--video-maker') && names.has('--no-video-maker');
}

export const VIDEO_MAKER_CONFLICT_MESSAGE =
  '--video-maker and --no-video-maker cannot be used together — pass only one.';

export interface VideoMakerPlan {
  beforeGate?: (root: string) => void;
  report: () => void;
}

export function planVideoMaker(flag: boolean | undefined): VideoMakerPlan {
  if (flag !== true) return { report: () => undefined };
  let outcome: VideoMakerOutcome = 'failed';
  return {
    beforeGate: (root) => {
      outcome = applyVideoMaker(root);
    },
    report: () => logVideoMakerSummary(outcome),
  };
}

export function chainBeforeGate(
  ...hooks: Array<((root: string) => void | Promise<void>) | undefined>
): ((root: string) => Promise<void>) | undefined {
  const present = hooks.filter((hook): hook is (root: string) => void | Promise<void> => hook !== undefined);
  if (present.length === 0) return undefined;
  return async (root) => {
    for (const hook of present) await hook(root);
  };
}
