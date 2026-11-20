import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { VerifyResultSummary } from '@sdd-studio/protocol';

export const MAX_RESULTS_PER_CYCLE = 30;

type Json = Record<string, unknown>;

const toSummary = (raw: Json): VerifyResultSummary | null => {
  const commands = Array.isArray(raw.commands) ? raw.commands : [];
  const parsed = VerifyResultSummary.safeParse({
    app: raw.app,
    level: raw.level,
    unit: raw.unit,
    ok: raw.ok,
    commit: typeof raw.commit === 'string' ? raw.commit : null,
    startedAt: raw.started_at,
    durationMs: raw.duration_ms,
    reused: raw.reused === true,
    commands: commands.map((command: Json) => ({
      command: command?.command,
      exitCode: typeof command?.exit_code === 'number' ? command.exit_code : null,
      durationMs: command?.duration_ms,
      skipped: command?.skipped === true,
    })),
  });
  return parsed.success ? parsed.data : null;
};

async function readResult(file: string): Promise<VerifyResultSummary | null> {
  try {
    const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? toSummary(raw as Json) : null;
  } catch {
    return null;
  }
}

async function directoryNames(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isDirectory() && entry.name !== 'logs').map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function jsonFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}

export async function loadVerifyResults(cycleDir: string): Promise<VerifyResultSummary[]> {
  const base = path.join(cycleDir, 'artifacts', 'verify');
  const files = (await Promise.all((await directoryNames(base)).map((name) => jsonFiles(path.join(base, name))))).flat();
  const latest = new Map<string, VerifyResultSummary>();
  for (const result of (await Promise.all(files.map(readResult))).filter((r): r is VerifyResultSummary => r !== null)) {
    const key = `${result.app}\u0000${result.level}\u0000${result.unit}`;
    const current = latest.get(key);
    if (!current || Date.parse(result.startedAt) > Date.parse(current.startedAt) || Number.isNaN(Date.parse(current.startedAt))) {
      latest.set(key, result);
    }
  }
  return [...latest.values()]
    .sort((a, b) => (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0))
    .slice(0, MAX_RESULTS_PER_CYCLE);
}
