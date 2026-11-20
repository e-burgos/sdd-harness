import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { query as sdkQuery, type Options, type Query } from '@anthropic-ai/claude-agent-sdk';
import { ClaudeInventory } from '@sdd-studio/protocol';
import { deriveInitInfo } from '../engine/claude-init';
import { MODEL_IDS } from '../engine/claude-sdk-engine';
import type { SdkMessageLike } from '../engine/sdk-mapper';
import type { EngineInitInfo } from '../engine/types';
import { KitToolsError } from './kit-tools';

export type ProbeQueryFn = (params: { prompt: string; options?: Options }) => Query;

export interface ClaudeInventoryService {
  current(): ClaudeInventory | null;
  load(): Promise<void>;
  refresh(): Promise<ClaudeInventory>;
  applyInit(info: EngineInitInfo): void;
}

export const PROBE_TIMEOUT_MS = 30_000;

const inventoryFile = (root: string) => path.join(root, '.sdd-studio', 'claude-inventory.json');

async function probeInit(root: string, queryFn: ProbeQueryFn, sources: NonNullable<Options['settingSources']>, timeoutMs: number): Promise<EngineInitInfo> {
  const abort = new AbortController();
  const q = queryFn({
    prompt: 'ping',
    options: { cwd: root, abortController: abort, settingSources: sources, model: MODEL_IDS.haiku, permissionMode: 'plan' },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new KitToolsError('internal', 'the Claude inventory probe timed out')), timeoutMs);
  });
  const firstInit = (async (): Promise<EngineInitInfo> => {
    for await (const message of q) {
      const msg = message as unknown as SdkMessageLike;
      if (msg.type === 'system' && msg.subtype === 'init') return deriveInitInfo(msg);
    }
    throw new KitToolsError('internal', 'the Claude engine closed before reporting its inventory');
  })();
  try {
    return await Promise.race([firstInit, timeout]);
  } catch (error) {
    if (error instanceof KitToolsError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new KitToolsError('internal', `the Claude inventory probe failed: ${detail}`.slice(0, 300));
  } finally {
    clearTimeout(timer);
    abort.abort();
    try {
      q.close();
    } catch {
      // The probe is already finished; closing a dead query is harmless.
    }
    firstInit.catch(() => undefined);
  }
}

async function persist(root: string, inventory: ClaudeInventory): Promise<void> {
  const file = inventoryFile(root);
  const temp = `${file}.${process.pid}.tmp`;
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(temp, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
    await rename(temp, file);
  } catch {
    await rm(temp, { force: true }).catch(() => undefined);
  }
}

export function createClaudeInventory(opts: { root: string; queryFn?: ProbeQueryFn; now?: () => Date; timeoutMs?: number }): ClaudeInventoryService {
  const queryFn = opts.queryFn ?? (sdkQuery as ProbeQueryFn);
  const now = opts.now ?? (() => new Date());
  const timeoutMs = opts.timeoutMs ?? PROBE_TIMEOUT_MS;
  let cached: ClaudeInventory | null = null;
  let inflight: Promise<ClaudeInventory> | null = null;

  const run = async (): Promise<ClaudeInventory> => {
    const [project, all] = await Promise.all([
      probeInit(opts.root, queryFn, ['project'], timeoutMs),
      probeInit(opts.root, queryFn, ['user', 'project', 'local'], timeoutMs),
    ]);
    const parsed = ClaudeInventory.parse({
      capturedAt: now().toISOString(),
      plugins: all.plugins,
      mcpServers: all.mcpServers,
      counts: { project: project.counts, all: all.counts },
    });
    cached = parsed;
    await persist(opts.root, parsed);
    return parsed;
  };

  return {
    current: () => cached,
    load: async () => {
      const raw = await readFile(inventoryFile(opts.root), 'utf8').catch(() => null);
      if (raw === null) return;
      try {
        const parsed = ClaudeInventory.safeParse(JSON.parse(raw));
        if (parsed.success) cached = parsed.data;
      } catch {
        cached = null;
      }
    },
    refresh: () => {
      inflight ??= run().finally(() => {
        inflight = null;
      });
      return inflight;
    },
    applyInit: (info) => {
      if (!cached) return;
      const live = new Map(info.mcpServers.map((server) => [server.name, server.status]));
      const next = ClaudeInventory.parse({
        ...cached,
        capturedAt: now().toISOString(),
        mcpServers: cached.mcpServers.map((server) => ({ ...server, status: live.get(server.name) ?? server.status })),
      });
      cached = next;
      void persist(opts.root, next);
    },
  };
}
