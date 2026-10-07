import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BotEvent, ThreadEvent, ThreadInfo } from '@sdd-studio/protocol';

export interface StoredThread extends ThreadInfo {
  engineSessionId: string | null;
}

export interface HistoryEntry {
  seq: number;
  event: ThreadEvent;
}

const BUSY = new Set(['running', 'waiting-approval', 'queued']);

async function readLines(file: string): Promise<string[]> {
  const raw = await readFile(file, 'utf8').catch(() => '');
  return raw.split('\n').filter((line) => line.trim() !== '');
}

export class ThreadStore {
  private readonly threads = new Map<string, StoredThread>();
  private readonly seqs = new Map<string, number>();
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly root: string) {}

  private get dir(): string {
    return path.join(this.root, '.sdd-studio');
  }

  private threadFile(id: string): string {
    return path.join(this.dir, 'threads', `${id}.jsonl`);
  }

  // ChannelId ya está validado por el protocolo: sólo letras, dígitos, `.`, `_`, `-` y un `:`.
  private channelFile(channelId: string): string {
    return path.join(this.dir, 'channels', `${channelId.replace(':', '__')}.jsonl`);
  }

  async init(): Promise<void> {
    await mkdir(path.join(this.dir, 'threads'), { recursive: true });
    await mkdir(path.join(this.dir, 'channels'), { recursive: true });
    await writeFile(path.join(this.dir, '.gitignore'), '*\n');
    let stored: unknown = [];
    try {
      stored = JSON.parse(await readFile(path.join(this.dir, 'threads.json'), 'utf8'));
    } catch {
      stored = [];
    }
    for (const t of Array.isArray(stored) ? (stored as StoredThread[]) : []) {
      if (BUSY.has(t.status)) t.status = 'interrupted';
      this.threads.set(t.id, t);
      this.seqs.set(t.id, (await readLines(this.threadFile(t.id))).length);
    }
    await this.persist();
  }

  list(channelId?: string): StoredThread[] {
    return [...this.threads.values()]
      .filter((t) => !channelId || t.channelId === channelId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  get(id: string): StoredThread | undefined {
    return this.threads.get(id);
  }

  upsert(thread: StoredThread): Promise<void> {
    this.threads.set(thread.id, thread);
    if (!this.seqs.has(thread.id)) this.seqs.set(thread.id, 0);
    return this.persist();
  }

  /** Asigna el seq de forma síncrona (orden garantizado) y encola la escritura. */
  append(threadId: string, event: ThreadEvent): number {
    const seq = this.seqs.get(threadId) ?? 0;
    this.seqs.set(threadId, seq + 1);
    void this.enqueue(() => appendFile(this.threadFile(threadId), `${JSON.stringify({ seq, event })}\n`));
    return seq;
  }

  async history(threadId: string, sinceSeq: number): Promise<HistoryEntry[]> {
    if (!this.threads.has(threadId)) return [];
    await this.flush();
    const out: HistoryEntry[] = [];
    for (const line of await readLines(this.threadFile(threadId))) {
      try {
        const entry = JSON.parse(line) as HistoryEntry;
        if (entry.seq >= sinceSeq) out.push(entry);
      } catch {
        // Línea truncada por un corte: se ignora.
      }
    }
    return out;
  }

  appendBot(event: BotEvent): void {
    void this.enqueue(() => appendFile(this.channelFile(event.channelId), `${JSON.stringify(event)}\n`));
  }

  async botHistory(channelId: string, limit: number): Promise<BotEvent[]> {
    await this.flush();
    const lines = await readLines(this.channelFile(channelId));
    const out: BotEvent[] = [];
    for (const line of lines.slice(-limit)) {
      try {
        out.push(JSON.parse(line) as BotEvent);
      } catch {
        // idem
      }
    }
    return out;
  }

  flush(): Promise<void> {
    return this.chain;
  }

  private persist(): Promise<void> {
    return this.enqueue(async () => {
      const tmp = path.join(this.dir, 'threads.json.tmp');
      await writeFile(tmp, JSON.stringify([...this.threads.values()], null, 2));
      await rename(tmp, path.join(this.dir, 'threads.json'));
    });
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    const next = this.chain.then(fn);
    this.chain = next.catch(() => undefined);
    return next;
  }
}
