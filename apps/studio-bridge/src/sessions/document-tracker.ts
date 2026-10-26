import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { specIdOfChannel, type Author } from '@sdd-studio/protocol';

export const SNAPSHOT_MAX_ENTRIES = 20_000;
export const SNAPSHOT_BUDGET_MS = 250;
export const MAX_TOUCHED_PER_TOOL = 50;
export const MAX_EXACT_TOUCHES = 200;

export type TouchOp = 'created' | 'modified' | 'deleted';

export interface TouchedDocument {
  path: string;
  op: TouchOp;
}

export interface AttributedTouch extends TouchedDocument {
  author: Author;
}

export interface WindowOwner {
  threadId: string;
  channelId: string;
  threadAgent: string;
  author: Author;
}

export interface TrackerOptions {
  now?: () => number;
  maxEntries?: number;
  budgetMs?: number;
  report?: (threadId: string, message: string) => void;
}

type Signatures = Map<string, string>;

interface Window {
  owner: WindowOwner;
  before: Promise<Signatures | null>;
  openedTick: number;
  overlaps: Map<string, WindowOwner>;
}

const SDD_DIR = 'sdd';
const SKIPPED_DIRECTORY = (name: string): boolean => name === 'node_modules' || name.startsWith('.');

export async function takeSnapshot(
  root: string,
  limits: { maxEntries: number; budgetMs: number; now: () => number },
): Promise<Signatures | null> {
  const signatures: Signatures = new Map();
  const deadline = limits.now() + limits.budgetMs;
  const exceeded = (): boolean => signatures.size > limits.maxEntries || limits.now() > deadline;

  const fileSignature = async (file: string): Promise<string | null> => {
    const stats = await lstat(file, { bigint: true }).catch(() => null);
    if (!stats || !stats.isFile()) return null;
    return `${stats.mtimeNs}:${stats.size}${stats.ino === 0n ? '' : `:${stats.ino}`}`;
  };

  const walk = async (relative: string): Promise<boolean> => {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true }).catch(() => []);
    const files = entries.filter((entry) => entry.isFile());
    const signed = await Promise.all(files.map((entry) => fileSignature(path.join(root, relative, entry.name))));
    files.forEach((entry, index) => {
      const signature = signed[index];
      if (signature) signatures.set(`${relative}/${entry.name}`, signature);
    });
    if (exceeded()) return false;
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIPPED_DIRECTORY(entry.name)) continue;
      if (!(await walk(`${relative}/${entry.name}`))) return false;
    }
    return true;
  };

  return (await walk(SDD_DIR)) ? signatures : null;
}

export function diffSnapshots(before: Signatures, after: Signatures): TouchedDocument[] {
  const touched: TouchedDocument[] = [];
  for (const [file, signature] of after) {
    const previous = before.get(file);
    if (previous === undefined) touched.push({ path: file, op: 'created' });
    else if (previous !== signature) touched.push({ path: file, op: 'modified' });
  }
  for (const file of before.keys()) if (!after.has(file)) touched.push({ path: file, op: 'deleted' });
  return touched.sort((a, b) => a.path.localeCompare(b.path));
}

const isUnderSpecOfChannel = (file: string, channelId: string): boolean => {
  const specId = specIdOfChannel(channelId);
  return specId !== null && file.startsWith(`${SDD_DIR}/specs/${specId}/`);
};

export class DocumentChangeTracker {
  private readonly windows = new Map<string, Window>();
  private readonly exactTouches: Array<{ path: string; tick: number }> = [];
  private readonly budgetReported = new Set<string>();
  private tick = 0;
  private readonly now: () => number;
  private readonly maxEntries: number;
  private readonly budgetMs: number;
  private readonly report: (threadId: string, message: string) => void;

  constructor(
    private readonly root: string,
    options: TrackerOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.maxEntries = options.maxEntries ?? SNAPSHOT_MAX_ENTRIES;
    this.budgetMs = options.budgetMs ?? SNAPSHOT_BUDGET_MS;
    this.report = options.report ?? ((threadId, message) => console.warn(`[sdd-studio] document tracker (${threadId}): ${message}`));
  }

  openWindowIds(): string[] {
    return [...this.windows.keys()];
  }

  open(toolUseId: string, owner: WindowOwner): Promise<void> {
    this.windows.delete(toolUseId);
    const window: Window = { owner, before: this.snapshot(), openedTick: ++this.tick, overlaps: new Map() };
    this.windows.set(toolUseId, window);
    this.linkOverlaps(toolUseId, window);
    return window.before.then(() => undefined);
  }

  rebase(toolUseId: string): Promise<void> {
    const window = this.windows.get(toolUseId);
    if (!window) return Promise.resolve();
    this.unlinkOverlaps(toolUseId, window);
    window.overlaps.clear();
    window.openedTick = ++this.tick;
    window.before = this.snapshot();
    this.linkOverlaps(toolUseId, window);
    return window.before.then(() => undefined);
  }

  cancel(toolUseId: string): void {
    const window = this.windows.get(toolUseId);
    if (!window) return;
    this.unlinkOverlaps(toolUseId, window);
    this.windows.delete(toolUseId);
  }

  recordExactTouch(file: string): void {
    this.exactTouches.push({ path: file, tick: ++this.tick });
    if (this.exactTouches.length > MAX_EXACT_TOUCHES) this.exactTouches.shift();
  }

  async close(toolUseId: string): Promise<AttributedTouch[]> {
    const window = this.windows.get(toolUseId);
    if (!window) return [];
    const touches = await this.diffWindow(toolUseId, window);
    this.windows.delete(toolUseId);
    return touches;
  }

  async closeThread(threadId: string): Promise<AttributedTouch[]> {
    const ids = [...this.windows].filter(([, window]) => window.owner.threadId === threadId).map(([id]) => id);
    const closed = [];
    for (const id of ids) closed.push(...(await this.close(id)));
    return closed;
  }

  private snapshot(): Promise<Signatures | null> {
    return takeSnapshot(this.root, { maxEntries: this.maxEntries, budgetMs: this.budgetMs, now: this.now });
  }

  private linkOverlaps(toolUseId: string, window: Window): void {
    for (const [otherId, other] of this.windows) {
      if (otherId === toolUseId) continue;
      window.overlaps.set(otherId, other.owner);
      other.overlaps.set(toolUseId, window.owner);
    }
  }

  private unlinkOverlaps(toolUseId: string, window: Window): void {
    for (const otherId of window.overlaps.keys()) this.windows.get(otherId)?.overlaps.delete(toolUseId);
  }

  private async diffWindow(toolUseId: string, window: Window): Promise<AttributedTouch[]> {
    const [before, after] = await Promise.all([window.before, this.snapshot()]);
    if (before === null || after === null) {
      this.reportBudgetOnce(window.owner.threadId);
      return [];
    }
    const exact = new Set(this.exactTouches.filter((touch) => touch.tick > window.openedTick).map((touch) => touch.path));
    const changed = diffSnapshots(before, after).filter((touch) => !exact.has(touch.path));
    const attributed = changed.flatMap((touch) => this.attribute(toolUseId, window, touch));
    if (attributed.length > MAX_TOUCHED_PER_TOOL) {
      this.report(window.owner.threadId, `${attributed.length} documents changed in one tool run; only the first ${MAX_TOUCHED_PER_TOOL} were recorded`);
    }
    return attributed.slice(0, MAX_TOUCHED_PER_TOOL);
  }

  private attribute(toolUseId: string, window: Window, touch: TouchedDocument): AttributedTouch[] {
    const { owner } = window;
    const overlaps = [...window.overlaps.values()];
    if (overlaps.length === 0) return [{ ...touch, author: owner.author }];
    const threadLevel: Author = { agent: owner.threadAgent, parentToolUseId: null };
    if (overlaps.every((other) => other.threadId === owner.threadId)) return [{ ...touch, author: threadLevel }];
    const involved = [owner, ...overlaps];
    const claimantThreads = new Set(involved.filter((c) => isUnderSpecOfChannel(touch.path, c.channelId)).map((c) => c.threadId));
    const claimedByUs = claimantThreads.size === 1 && claimantThreads.has(owner.threadId);
    if (!claimedByUs) {
      this.report(owner.threadId, `${touch.path} changed while tools of different threads ran; not attributed (${toolUseId})`);
      return [];
    }
    const sameThreadOverlap = overlaps.some((other) => other.threadId === owner.threadId);
    return [{ ...touch, author: sameThreadOverlap ? threadLevel : owner.author }];
  }

  private reportBudgetOnce(threadId: string): void {
    if (this.budgetReported.has(threadId)) return;
    this.budgetReported.add(threadId);
    this.report(threadId, 'sdd/ snapshot exceeded its budget; document changes of this tool run were not detected');
  }
}
