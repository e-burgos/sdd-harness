import { mkdir, mkdtemp, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DocumentChangeTracker,
  MAX_EXACT_TOUCHES,
  MAX_TOUCHED_PER_TOOL,
  diffSnapshots,
  takeSnapshot,
  type WindowOwner,
} from './document-tracker';

let root: string;
let reports: Array<{ threadId: string; message: string }>;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'doc tracker '));
  reports = [];
  await mkdir(path.join(root, 'sdd/specs/spec-a/cycles/cycle-01'), { recursive: true });
  await mkdir(path.join(root, 'sdd/specs/spec-b'), { recursive: true });
  await writeFile(path.join(root, 'sdd/specs/spec-a/brief.yaml'), 'a');
  await writeFile(path.join(root, 'sdd/specs/spec-b/brief.yaml'), 'b');
});
afterEach(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

const write = (file: string, content = 'x') => writeFile(path.join(root, file), content);
const tracker = (options: ConstructorParameters<typeof DocumentChangeTracker>[1] = {}) =>
  new DocumentChangeTracker(root, { report: (threadId, message) => reports.push({ threadId, message }), ...options });
const owner = (threadId: string, channelId = 'general', agent = 'sdd-orchestrator', parentToolUseId: string | null = null): WindowOwner => ({
  threadId,
  channelId,
  threadAgent: 'sdd-orchestrator',
  author: { agent, parentToolUseId },
});
const bumpMtime = (file: string, seconds: number) => utimes(path.join(root, file), new Date(Date.now() + seconds * 1000), new Date(Date.now() + seconds * 1000));

describe('takeSnapshot and diffSnapshots', () => {
  const limits = { maxEntries: 100, budgetMs: 1000, now: Date.now };

  it('lists files under sdd/ with relative slash paths', async () => {
    const snapshot = await takeSnapshot(root, limits);
    expect([...(snapshot ?? []).keys()].sort()).toEqual(['sdd/specs/spec-a/brief.yaml', 'sdd/specs/spec-b/brief.yaml']);
  });

  it('returns an empty snapshot when sdd/ does not exist', async () => {
    const empty = await mkdtemp(path.join(tmpdir(), 'no sdd '));
    try {
      expect((await takeSnapshot(empty, limits))?.size).toBe(0);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });

  it('skips node_modules, hidden directories and symlinks', async () => {
    await mkdir(path.join(root, 'sdd/node_modules/pkg'), { recursive: true });
    await mkdir(path.join(root, 'sdd/.cache'), { recursive: true });
    await write('sdd/node_modules/pkg/index.js');
    await write('sdd/.cache/blob');
    await symlink(path.join(root, 'sdd/specs'), path.join(root, 'sdd/linked'));
    await symlink(path.join(root, 'sdd/specs/spec-a/brief.yaml'), path.join(root, 'sdd/link.yaml'));
    const snapshot = await takeSnapshot(root, limits);
    expect([...(snapshot ?? []).keys()].sort()).toEqual(['sdd/specs/spec-a/brief.yaml', 'sdd/specs/spec-b/brief.yaml']);
  });

  it('gives up when the entry budget is exceeded', async () => {
    expect(await takeSnapshot(root, { ...limits, maxEntries: 1 })).toBeNull();
  });

  it('gives up when the time budget is exceeded', async () => {
    let clock = 0;
    const snapshot = await takeSnapshot(root, { maxEntries: 100, budgetMs: 250, now: () => (clock += 200) });
    expect(snapshot).toBeNull();
  });

  it('classifies created, modified and deleted files sorted by path', () => {
    const before = new Map([['sdd/a', '1:1'], ['sdd/b', '1:1'], ['sdd/c', '1:1']]);
    const after = new Map([['sdd/a', '1:1'], ['sdd/b', '2:1'], ['sdd/d', '1:1']]);
    expect(diffSnapshots(before, after)).toEqual([
      { path: 'sdd/b', op: 'modified' },
      { path: 'sdd/c', op: 'deleted' },
      { path: 'sdd/d', op: 'created' },
    ]);
  });
});

describe('DocumentChangeTracker without overlap', () => {
  it('detects created, modified and deleted documents attributed to the tool author', async () => {
    const t = tracker();
    const author = owner('t1', 'spec:spec-a', 'sdd-planner', 'toolu_P');
    await t.open('tool-1', author);
    await write('sdd/specs/spec-a/cycles/cycle-01/plan.md', 'new');
    await write('sdd/specs/spec-a/brief.yaml', 'changed content');
    await bumpMtime('sdd/specs/spec-a/brief.yaml', 5);
    await rm(path.join(root, 'sdd/specs/spec-b/brief.yaml'));
    const touches = await t.close('tool-1');
    expect(touches).toEqual([
      { path: 'sdd/specs/spec-a/brief.yaml', op: 'modified', author: author.author },
      { path: 'sdd/specs/spec-a/cycles/cycle-01/plan.md', op: 'created', author: author.author },
      { path: 'sdd/specs/spec-b/brief.yaml', op: 'deleted', author: author.author },
    ]);
  });

  it('produces nothing when the command does not touch sdd/', async () => {
    const t = tracker();
    await t.open('tool-1', owner('t1'));
    await write('outside.txt');
    expect(await t.close('tool-1')).toEqual([]);
    expect(t.openWindowIds()).toEqual([]);
  });

  it('answers empty for a window that was never opened', async () => {
    expect(await tracker().close('ghost')).toEqual([]);
  });

  it('caps the documents of one tool run and reports the overflow', async () => {
    const t = tracker();
    await t.open('tool-1', owner('t1'));
    for (let i = 0; i < MAX_TOUCHED_PER_TOOL + 5; i += 1) await write(`sdd/specs/spec-a/file-${String(i).padStart(3, '0')}.md`);
    const touches = await t.close('tool-1');
    expect(touches).toHaveLength(MAX_TOUCHED_PER_TOOL);
    expect(touches[0]?.path).toBe('sdd/specs/spec-a/file-000.md');
    expect(reports).toHaveLength(1);
  });

  it('omits detection and invents nothing when the budget is exceeded, reporting once per thread', async () => {
    const t = tracker({ maxEntries: 1 });
    await t.open('tool-1', owner('t1'));
    await write('sdd/specs/spec-a/new.md');
    expect(await t.close('tool-1')).toEqual([]);
    await t.open('tool-2', owner('t1'));
    expect(await t.close('tool-2')).toEqual([]);
    expect(reports.filter((r) => r.threadId === 't1')).toHaveLength(1);
    await t.open('tool-3', owner('t2'));
    await t.close('tool-3');
    expect(reports.filter((r) => r.threadId === 't2')).toHaveLength(1);
  });

  it('excludes documents already reported by an exact Write or Edit during the window', async () => {
    const t = tracker();
    await t.open('tool-1', owner('t1'));
    await write('sdd/specs/spec-a/exact.md');
    await write('sdd/specs/spec-a/by-shell.md');
    t.recordExactTouch('sdd/specs/spec-a/exact.md');
    expect(await t.close('tool-1')).toEqual([expect.objectContaining({ path: 'sdd/specs/spec-a/by-shell.md' })]);
  });

  it('does not exclude an exact touch recorded before the window opened', async () => {
    const t = tracker();
    t.recordExactTouch('sdd/specs/spec-a/early.md');
    await t.open('tool-1', owner('t1'));
    await write('sdd/specs/spec-a/early.md');
    expect(await t.close('tool-1')).toEqual([expect.objectContaining({ path: 'sdd/specs/spec-a/early.md', op: 'created' })]);
  });

  it('keeps a bounded ring of exact touches', () => {
    const t = tracker();
    for (let i = 0; i < MAX_EXACT_TOUCHES + 10; i += 1) t.recordExactTouch(`sdd/f-${i}.md`);
    expect(t.openWindowIds()).toEqual([]);
  });

  it('does not count the approval wait after rebase', async () => {
    const t = tracker();
    await t.open('tool-1', owner('t1'));
    await write('sdd/specs/spec-a/while-waiting.md');
    await t.rebase('tool-1');
    await write('sdd/specs/spec-a/while-running.md');
    expect((await t.close('tool-1')).map((touch) => touch.path)).toEqual(['sdd/specs/spec-a/while-running.md']);
  });

  it('closes a cancelled window without records', async () => {
    const t = tracker();
    await t.open('tool-1', owner('t1'));
    await write('sdd/specs/spec-a/denied.md');
    t.cancel('tool-1');
    expect(t.openWindowIds()).toEqual([]);
    expect(await t.close('tool-1')).toEqual([]);
  });
});

describe('DocumentChangeTracker overlapping windows', () => {
  it('attributes to the thread without a specific author when parallel tools belong to the same thread', async () => {
    const t = tracker();
    await t.open('tool-1', owner('t1', 'general', 'sdd-planner', 'toolu_1'));
    await t.open('tool-2', owner('t1', 'general', 'sdd-architect', 'toolu_2'));
    await write('sdd/specs/spec-a/shared.md');
    const first = await t.close('tool-1');
    const second = await t.close('tool-2');
    const threadLevel = { agent: 'sdd-orchestrator', parentToolUseId: null };
    expect(first).toEqual([{ path: 'sdd/specs/spec-a/shared.md', op: 'created', author: threadLevel }]);
    expect(second).toEqual(first);
  });

  it('keeps the thread-level author when an overlapping window of the same thread already closed', async () => {
    const t = tracker();
    await t.open('tool-1', owner('t1', 'general', 'sdd-planner', 'toolu_1'));
    await t.open('tool-2', owner('t1', 'general', 'sdd-architect', 'toolu_2'));
    await t.close('tool-2');
    await write('sdd/specs/spec-a/late.md');
    const [touch] = await t.close('tool-1');
    expect(touch?.author).toEqual({ agent: 'sdd-orchestrator', parentToolUseId: null });
  });

  it('attributes a spec document to the only thread whose channel owns that spec', async () => {
    const t = tracker();
    await t.open('tool-a', owner('ta', 'spec:spec-a', 'sdd-planner', 'toolu_a'));
    await t.open('tool-b', owner('tb', 'spec:spec-b', 'sdd-architect', 'toolu_b'));
    await write('sdd/specs/spec-a/cycles/cycle-01/plan.md');
    const forA = await t.close('tool-a');
    const forB = await t.close('tool-b');
    expect(forA).toEqual([{ path: 'sdd/specs/spec-a/cycles/cycle-01/plan.md', op: 'created', author: { agent: 'sdd-planner', parentToolUseId: 'toolu_a' } }]);
    expect(forB).toEqual([]);
  });

  it('omits a document that no involved channel owns instead of guessing', async () => {
    const t = tracker();
    await t.open('tool-a', owner('ta', 'general'));
    await t.open('tool-b', owner('tb', 'fixes'));
    await write('sdd/specs/spec-a/orphan.md');
    expect(await t.close('tool-a')).toEqual([]);
    expect(await t.close('tool-b')).toEqual([]);
    expect(reports.length).toBeGreaterThan(0);
  });

  it('omits a document owned by two different threads on the same spec', async () => {
    const t = tracker();
    await t.open('tool-a', owner('ta', 'spec:spec-a'));
    await t.open('tool-b', owner('tb', 'spec:spec-a'));
    await write('sdd/specs/spec-a/both.md');
    expect(await t.close('tool-a')).toEqual([]);
    expect(await t.close('tool-b')).toEqual([]);
  });

  it('forgets overlaps with a cancelled window', async () => {
    const t = tracker();
    const author = owner('ta', 'general', 'sdd-planner', 'toolu_a');
    await t.open('tool-a', author);
    await t.open('tool-b', owner('tb', 'general'));
    t.cancel('tool-b');
    await write('sdd/specs/spec-a/solo.md');
    expect(await t.close('tool-a')).toEqual([expect.objectContaining({ author: author.author })]);
  });
});

describe('DocumentChangeTracker.closeThread', () => {
  it('closes every open window of the thread with a final diff and leaves other threads open', async () => {
    const t = tracker();
    await t.open('tool-1', owner('t1'));
    await t.open('tool-2', owner('t1'));
    await t.open('tool-3', owner('t2'));
    await write('sdd/specs/spec-a/pending.md');
    const touches = await t.closeThread('t1');
    expect(touches.every((touch) => touch.path === 'sdd/specs/spec-a/pending.md')).toBe(true);
    expect(t.openWindowIds()).toEqual(['tool-3']);
    expect(await t.closeThread('t1')).toEqual([]);
  });
});
