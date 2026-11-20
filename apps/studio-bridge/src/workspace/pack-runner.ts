import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { KitPackStats, MAX_PACK_STATS_ROWS } from '@sdd-studio/protocol';

export const PACK_TIMEOUT_MS = 15_000;
export const PACK_STATS_TIMEOUT_MS = 30_000;
const PACK_MAX_BUFFER = 1024 * 1024;
const PACK_SCRIPT = 'sdd/scripts/sdd-pack.mjs';

export interface PackRunResult {
  code: number;
  stdout: string;
}

export type PackRunner = (args: string[], timeoutMs: number) => Promise<PackRunResult>;

export const PACK_NO_PACKS_EXIT = 3;
export const PACK_USAGE_EXIT = 2;

export function createPackRunner(root: string): PackRunner {
  return (args, timeoutMs) =>
    new Promise((resolve) => {
      execFile(
        process.execPath,
        [path.join(root, PACK_SCRIPT), ...args],
        { cwd: root, timeout: timeoutMs, maxBuffer: PACK_MAX_BUFFER, encoding: 'utf8', windowsHide: true },
        (error, stdout) => {
          if (!error) return resolve({ code: 0, stdout });
          const code = (error as { code?: unknown }).code;
          resolve({ code: typeof code === 'number' ? code : -1, stdout: '' });
        },
      );
    });
}

export class PackStatsError extends Error {
  constructor(
    readonly code: 'not-found' | 'conflict',
    message: string,
  ) {
    super(message);
  }
}

const EMPTY_STATS: KitPackStats = { rows: [], total: { packBytes: 0, sourceBytes: 0 }, packMisses: 0 };

const bytesOf = (value: unknown): number => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0);

function mapStats(raw: unknown): KitPackStats {
  const source = (raw ?? {}) as { rows?: unknown; total?: Record<string, unknown>; pack_misses?: unknown };
  const rows = (Array.isArray(source.rows) ? source.rows : []).slice(0, MAX_PACK_STATS_ROWS).map((row: Record<string, unknown>) => ({
    unit: String(row.unit ?? ''),
    role: String(row.role ?? ''),
    packBytes: bytesOf(row.pack_bytes),
    sourceBytes: bytesOf(row.source_bytes),
  }));
  return KitPackStats.parse({
    rows,
    total: { packBytes: bytesOf(source.total?.pack_bytes), sourceBytes: bytesOf(source.total?.source_bytes) },
    packMisses: Array.isArray(source.pack_misses) ? source.pack_misses.length : 0,
  });
}

async function cycleApps(root: string, spec: string, cycle: string): Promise<string[]> {
  try {
    const raw = await readFile(path.join(root, 'sdd', 'specs', spec, 'cycles', cycle, 'cycle.json'), 'utf8');
    const apps = (JSON.parse(raw) as { apps?: unknown }).apps;
    return Array.isArray(apps) ? apps.filter((app): app is string => typeof app === 'string' && app.length > 0) : [];
  } catch {
    return [];
  }
}

interface StatsRaw {
  rows?: unknown;
  total?: Record<string, unknown>;
  pack_misses?: unknown;
}

function mergeRaw(parts: StatsRaw[]): StatsRaw {
  const seen = new Set<string>();
  const rows: unknown[] = [];
  let pack = 0;
  let source = 0;
  const misses: unknown[] = [];
  for (const part of parts) {
    for (const row of Array.isArray(part.rows) ? (part.rows as Array<Record<string, unknown>>) : []) {
      const key = `${String(row.role)}|${String(row.unit)}`;
      if (row.unit !== 'cycle' && seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
      pack += bytesOf(row.pack_bytes);
      source += bytesOf(row.source_bytes);
    }
    if (Array.isArray(part.pack_misses)) misses.push(...part.pack_misses);
  }
  return { rows, total: { pack_bytes: pack, source_bytes: source }, pack_misses: misses };
}

export async function readPackStats(root: string, spec: string, cycle: string, run: PackRunner = createPackRunner(root)): Promise<KitPackStats> {
  const apps = await cycleApps(root, spec, cycle);
  const targets: Array<string | null> = apps.length > 0 ? apps : [null];
  const parts: StatsRaw[] = [];
  for (const app of targets) {
    const args = [spec, cycle, '--stats', '--json', ...(app ? ['--app', app] : [])];
    const result = await run(args, PACK_STATS_TIMEOUT_MS);
    if (result.code === PACK_NO_PACKS_EXIT) return EMPTY_STATS;
    if (result.code === PACK_USAGE_EXIT) throw new PackStatsError('not-found', `no pack stats for ${spec} ${cycle}`);
    if (result.code !== 0) throw new PackStatsError('conflict', `sdd-pack --stats failed (${result.code})`);
    try {
      parts.push(JSON.parse(result.stdout) as StatsRaw);
    } catch {
      throw new PackStatsError('conflict', 'sdd-pack --stats returned an unreadable result');
    }
  }
  return mapStats(parts.length === 1 ? parts[0] : mergeRaw(parts));
}
