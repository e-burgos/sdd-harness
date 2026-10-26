import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ChannelId,
  DEFAULT_PROVIDER,
  MAX_PENDING_PER_THREAD,
  ProviderId,
  ThreadLinkEntry,
  ThreadLinkTarget,
  type AttachmentRef,
  type BotEvent,
  type PromptRefs,
  ThreadEvent,
  type ThreadInfo,
  type ThreadLink,
} from '@sdd-studio/protocol';
import { activeEntries, MAX_STORED_LINK_ENTRIES, type StoredLinkEntry } from './thread-link';

export interface PendingMessage {
  id: string;
  text: string;
  attachments?: AttachmentRef[];
  refs?: PromptRefs;
  createdAt: string;
}

export interface StoredLink {
  target: ThreadLinkTarget;
  source: ThreadLink['source'];
  targets: StoredLinkEntry[];
}

export interface StoredThread extends Omit<ThreadInfo, 'pendingCount' | 'engineSessionId' | 'provider' | 'link' | 'sessionTitle'> {
  engineSessionId: string | null;
  provider: ProviderId;
  link: StoredLink;
  sessionTitle: string | null;
  pending: PendingMessage[];
}

export const toThreadInfo = ({ pending, link, ...info }: StoredThread): ThreadInfo => ({
  ...info,
  link: { target: link.target, source: link.source, targets: activeEntries(link.targets) },
  pendingCount: Math.min(pending.length, MAX_PENDING_PER_THREAD),
});

const NO_TARGET: ThreadLinkTarget = { kind: 'none' };

export function storedLinkOf(link: Pick<ThreadLink, 'target' | 'source'>): StoredLink {
  const { target, source } = link;
  const origin = source === 'manual' ? 'manual' : 'detected';
  const targets: StoredLinkEntry[] = target.kind === 'none' ? [] : [{ ...target, origin }];
  return { target, source, targets };
}

function migrateStoredEntries(raw: unknown): StoredLinkEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: StoredLinkEntry[] = [];
  for (const candidate of raw) {
    const { dismissed, ...rest } = (candidate ?? {}) as { dismissed?: unknown };
    const parsed = ThreadLinkEntry.safeParse(rest);
    if (parsed.success) entries.push(dismissed === true ? { ...parsed.data, dismissed: true } : parsed.data);
  }
  return entries.slice(-MAX_STORED_LINK_ENTRIES);
}

export function migrateStoredLink(raw: unknown): StoredLink {
  const link = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<'target' | 'source' | 'targets', unknown>>;
  const target = ThreadLinkTarget.safeParse(link.target);
  const source = (['auto', 'manual', 'legacy'] as const).find((candidate) => candidate === link.source) ?? 'legacy';
  const base = { target: target.success ? target.data : NO_TARGET, source };
  return Array.isArray(link.targets) ? { ...base, targets: migrateStoredEntries(link.targets) } : storedLinkOf(base);
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

const serializeBotEvent = (event: BotEvent): string => JSON.stringify(event);

function collapseConsecutiveDuplicates(lines: string[]): string[] {
  return lines.filter((line, i) => i === 0 || line !== lines[i - 1]);
}

async function lastBotLine(file: string): Promise<string | null> {
  const lines = await readLines(file);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return serializeBotEvent(JSON.parse(lines[i] as string) as BotEvent);
    } catch {
      continue;
    }
  }
  return null;
}

async function nextSeqFromFile(file: string): Promise<number> {
  let maxSeq = -1;
  for (const line of await readLines(file)) {
    try {
      const entry = JSON.parse(line) as { seq?: number };
      if (typeof entry.seq === 'number' && entry.seq > maxSeq) maxSeq = entry.seq;
    } catch {
      // ignore truncated lines
    }
  }
  return maxSeq + 1;
}

async function ensureTrailingNewline(file: string): Promise<void> {
  const raw = await readFile(file, 'utf8').catch(() => '');
  if (raw && !raw.endsWith('\n')) await appendFile(file, '\n');
}

export class ThreadStore {
  private readonly threads = new Map<string, StoredThread>();
  private readonly seqs = new Map<string, number>();
  private readonly recovered: string[] = [];
  private readonly repairedFiles = new Set<string>();
  private readonly lastBotLines = new Map<string, string | null>();
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly root: string,
    private readonly onError: (error: unknown) => void = (e) => console.error('[sdd-studio] store write failed:', e),
  ) {}

  private get dir(): string {
    return path.join(this.root, '.sdd-studio');
  }

  private threadFile(id: string): string {
    return path.join(this.dir, 'threads', `${id}.jsonl`);
  }

  /** null if the id does not satisfy ChannelId (a path is never built from an unvalidated id). */
  private channelFile(channelId: string): string | null {
    if (!ChannelId.safeParse(channelId).success) return null;
    return path.join(this.dir, 'channels', `${channelId.replace(':', '__')}.jsonl`);
  }

  async init(): Promise<void> {
    await mkdir(path.join(this.dir, 'threads'), { recursive: true });
    await mkdir(path.join(this.dir, 'channels'), { recursive: true });
    await writeFile(path.join(this.dir, '.gitignore'), '*\n');
    const stored = await this.readStoredThreads();
    for (const t of stored) {
      if (BUSY.has(t.status)) {
        this.recovered.push(t.id);
        t.status = 'interrupted';
      }
      t.link = migrateStoredLink(t.link);
      t.sessionTitle = typeof t.sessionTitle === 'string' && t.sessionTitle.length > 0 ? t.sessionTitle : null;
      t.engineSessionId = typeof t.engineSessionId === 'string' && t.engineSessionId.length > 0 ? t.engineSessionId : null;
      t.provider = ProviderId.safeParse(t.provider).success ? t.provider : DEFAULT_PROVIDER;
      t.pending = Array.isArray(t.pending) ? t.pending : [];
      delete (t as { pendingCount?: number }).pendingCount;
      this.threads.set(t.id, t);
      const threadFile = this.threadFile(t.id);
      const nextSeq = await nextSeqFromFile(threadFile);
      await ensureTrailingNewline(threadFile);
      this.seqs.set(t.id, nextSeq);
    }
    await this.persist();
  }

  private async readStoredThreads(): Promise<StoredThread[]> {
    const file = path.join(this.dir, 'threads.json');
    const raw = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('threads.json is not an array');
      return parsed.filter((t): t is StoredThread => typeof t?.id === 'string' && t.id.length > 0);
    } catch (error) {
      const quarantined = `${file}.corrupt-${Date.now()}`;
      await rename(file, quarantined);
      this.onError(new Error(`threads.json is unreadable and was moved to ${quarantined}: ${String(error)}`));
      return [];
    }
  }

  /** Threads that were busy before the restart (already marked as interrupted). */
  recoveredThreadIds(): string[] {
    return [...this.recovered];
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

  /** Assigns seq synchronously (guaranteed order) and queues the write. */
  append(threadId: string, event: ThreadEvent): number {
    const seq = this.seqs.get(threadId) ?? 0;
    this.seqs.set(threadId, seq + 1);
    void this.enqueue(async () => {
      // Thread files are repaired only in init(): the file is not re-read here.
      await appendFile(this.threadFile(threadId), `${JSON.stringify({ seq, event })}\n`);
    });
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
        // Line truncated by a crash: ignored.
      }
    }
    return out;
  }

  appendBot(event: BotEvent): void {
    void this.enqueue(async () => {
      const file = this.channelFile(event.channelId);
      if (!file) throw new Error(`invalid channelId: ${event.channelId}`);
      if (!this.repairedFiles.has(file)) {
        await ensureTrailingNewline(file);
        this.repairedFiles.add(file);
      }
      const line = serializeBotEvent(event);
      if (!this.lastBotLines.has(file)) this.lastBotLines.set(file, await lastBotLine(file));
      if (this.lastBotLines.get(file) === line) return;
      await appendFile(file, `${line}\n`);
      this.lastBotLines.set(file, line);
    });
  }

  async botHistory(channelId: string, limit: number): Promise<BotEvent[]> {
    await this.flush();
    const file = this.channelFile(channelId);
    if (!file) return [];
    const lines = await readLines(file);
    const out: BotEvent[] = [];
    for (const line of collapseConsecutiveDuplicates(lines).slice(-limit)) {
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
    const next = this.chain.then(fn).catch((error) => {
      this.onError(error);
    });
    this.chain = next.catch(() => undefined);
    return next;
  }
}
