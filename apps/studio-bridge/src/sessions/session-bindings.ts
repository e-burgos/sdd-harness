import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SessionBinding as ProtocolBinding } from '@sdd-studio/protocol';
import type { Verdict } from '../gate/judge';

export type RegistryUnit = { kind: 'cycle'; spec: string; cycle: string } | { kind: 'fix'; fix: string };

interface RegistryBinding {
  session_id: string;
  unit: RegistryUnit;
  worktree: string;
  harness: string;
  source: string;
  bound_at: string;
  updated_at: string;
  ended_at: string | null;
}

interface RegistryFs {
  read(file: string): Promise<string>;
  write(file: string, text: string): Promise<void>;
  list(dir: string): Promise<Array<{ name: string }>>;
}

interface RegistryLib {
  resolveRegistryDir(fs: RegistryFs, root: string): Promise<string>;
  writeBinding(
    fs: RegistryFs,
    dir: string,
    input: { sessionId: string; unit: RegistryUnit; worktree: string; harness: string; source: string; now: number },
  ): Promise<RegistryBinding>;
  touchBinding(fs: RegistryFs, dir: string, sessionId: string, now: number): Promise<RegistryBinding | null>;
  endBinding(fs: RegistryFs, dir: string, sessionId: string, now: number): Promise<RegistryBinding | null>;
  listLiveBindings(fs: RegistryFs, dir: string, now: number): Promise<RegistryBinding[]>;
  judgeSessionEdit(input: {
    gate: 'block' | 'warn';
    binding: RegistryBinding | null;
    openUnits: RegistryUnit[];
    rel: string;
    now: number;
  }): { kind: 'allow' } | { kind: 'warn' | 'deny'; code?: string; reason: string };
  unitKey(unit: RegistryUnit): string;
}

export const REGISTRY_MODULE = ['sdd', 'scripts', 'lib', 'session-registry.mjs'];
export const STUDIO_HARNESS = 'studio';
export const TOUCH_INTERVAL_MS = 60_000;

const nodeFs: RegistryFs = {
  read: (file) => readFile(file, 'utf8'),
  write: async (file, text) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text, 'utf8');
  },
  list: async (dir) => (await readdir(dir, { withFileTypes: true })).map((entry) => ({ name: entry.name })),
};

const isRegistryLib = (value: unknown): value is RegistryLib => {
  const lib = value as Partial<Record<keyof RegistryLib, unknown>> | null;
  return (
    !!lib &&
    ['resolveRegistryDir', 'writeBinding', 'touchBinding', 'endBinding', 'listLiveBindings', 'judgeSessionEdit', 'unitKey'].every(
      (name) => typeof lib[name as keyof RegistryLib] === 'function',
    )
  );
};

export const sessionIdOfThread = (threadId: string): string => `studio-${threadId.replace(/[^A-Za-z0-9._-]/g, '-')}`;

const toProtocol = (binding: RegistryBinding): ProtocolBinding => ({
  sessionId: binding.session_id,
  unit:
    binding.unit.kind === 'fix'
      ? { kind: 'fix', fixId: binding.unit.fix }
      : { kind: 'cycle', specId: binding.unit.spec, cycle: binding.unit.cycle },
  harness: binding.harness,
  source: binding.source,
  worktree: binding.worktree,
  boundAt: binding.bound_at,
  updatedAt: binding.updated_at,
});

export interface ThreadBindings {
  sync(threadId: string, unit: RegistryUnit | null): void;
  touch(threadId: string): void;
  end(threadId: string): void;
  has(threadId: string): boolean;
  judge(input: {
    threadId: string;
    unit: RegistryUnit | null;
    gate: 'block' | 'warn';
    openUnits: RegistryUnit[];
    rel: string;
  }): Verdict | null;
  endAll(): Promise<void>;
  listLive(): Promise<ProtocolBinding[]>;
}

export class SessionBindings implements ThreadBindings {
  private readonly active = new Map<string, { key: string; touchedAt: number }>();
  private chain: Promise<void> = Promise.resolve();

  private constructor(
    private readonly lib: RegistryLib,
    private readonly dir: string,
    private readonly root: string,
    private readonly now: () => number,
    private readonly onChange: () => void,
  ) {}

  static async load(
    root: string,
    options: { now?: () => number; onChange?: () => void; onError?: (error: unknown) => void } = {},
  ): Promise<SessionBindings | null> {
    try {
      const module: unknown = await import(/* @vite-ignore */ pathToFileURL(path.join(root, ...REGISTRY_MODULE)).href);
      if (!isRegistryLib(module)) return null;
      const dir = await module.resolveRegistryDir(nodeFs, root.replace(/\\/g, '/'));
      return new SessionBindings(module, dir, root.replace(/\\/g, '/'), options.now ?? Date.now, options.onChange ?? (() => undefined));
    } catch {
      return null;
    }
  }

  private enqueue(job: () => Promise<void>): void {
    this.chain = this.chain.then(job).catch((error) => console.error('[sdd-studio] session registry:', error));
  }

  has(threadId: string): boolean {
    return this.active.has(threadId);
  }

  sync(threadId: string, unit: RegistryUnit | null): void {
    if (unit === null) return this.end(threadId);
    const key = this.lib.unitKey(unit);
    const previous = this.active.get(threadId);
    if (previous?.key === key && this.now() - previous.touchedAt < TOUCH_INTERVAL_MS) return;
    this.active.set(threadId, { key, touchedAt: this.now() });
    this.enqueue(async () => {
      await this.lib.writeBinding(nodeFs, this.dir, {
        sessionId: sessionIdOfThread(threadId),
        unit,
        worktree: this.root,
        harness: STUDIO_HARNESS,
        source: 'studio',
        now: this.now(),
      });
      this.onChange();
    });
  }

  touch(threadId: string): void {
    const entry = this.active.get(threadId);
    if (!entry || this.now() - entry.touchedAt < TOUCH_INTERVAL_MS) return;
    entry.touchedAt = this.now();
    this.enqueue(async () => {
      await this.lib.touchBinding(nodeFs, this.dir, sessionIdOfThread(threadId), this.now());
    });
  }

  end(threadId: string): void {
    if (!this.active.delete(threadId)) return;
    this.enqueue(async () => {
      await this.lib.endBinding(nodeFs, this.dir, sessionIdOfThread(threadId), this.now());
      this.onChange();
    });
  }

  judge(input: { threadId: string; unit: RegistryUnit | null; gate: 'block' | 'warn'; openUnits: RegistryUnit[]; rel: string }): Verdict | null {
    const now = this.now();
    const stamp = new Date(now).toISOString();
    const binding: RegistryBinding | null = input.unit
      ? {
          session_id: sessionIdOfThread(input.threadId),
          unit: input.unit,
          worktree: this.root,
          harness: STUDIO_HARNESS,
          source: 'studio',
          bound_at: stamp,
          updated_at: stamp,
          ended_at: null,
        }
      : null;
    try {
      const verdict = this.lib.judgeSessionEdit({ gate: input.gate, binding, openUnits: input.openUnits, rel: input.rel, now });
      if (verdict.kind === 'allow') return { kind: 'allow' };
      return { kind: verdict.kind, reason: studioReasonOf(verdict, input.unit, input.openUnits, input.rel, this.lib) };
    } catch {
      return null;
    }
  }

  async endAll(): Promise<void> {
    for (const threadId of [...this.active.keys()]) this.end(threadId);
    await this.chain;
  }

  async listLive(): Promise<ProtocolBinding[]> {
    await this.chain;
    try {
      return (await this.lib.listLiveBindings(nodeFs, this.dir, this.now())).map(toProtocol);
    } catch {
      return [];
    }
  }
}

function studioReasonOf(
  verdict: { code?: string; reason: string },
  bound: RegistryUnit | null,
  openUnits: RegistryUnit[],
  rel: string,
  lib: Pick<RegistryLib, 'unitKey'>,
): string {
  const units = openUnits.map((unit) => lib.unitKey(unit)).join(', ');
  if (verdict.code === 'unbound') {
    return `SPEC GATE: ${openUnits.length} units are open and this conversation is linked to none of them, so it does not write code (${rel}). Link the conversation to its cycle or fix (${units}) and retry.`;
  }
  if (verdict.code === 'closed') {
    return `SPEC GATE: this conversation is linked to ${bound ? lib.unitKey(bound) : 'a unit'}, which is no longer open, so it does not write code (${rel}). Link it to an open cycle or fix (${units}) and retry.`;
  }
  return verdict.reason;
}
