import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import chokidar from 'chokidar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyFixture, FIXTURE_ROOT, waitFor } from '../test-utils/fixture';
import { isClaudeCatalogPath, startWorkspaceWatcher, type WorkspaceUpdate, type WorkspaceWatcher } from './watcher';

let root: string;
let cleanup: () => Promise<void>;
let watcher: WorkspaceWatcher | undefined;
const updates: WorkspaceUpdate[] = [];

beforeEach(async () => {
  ({ root, cleanup } = await copyFixture());
  updates.length = 0;
  watcher = await startWorkspaceWatcher({ root, debounceMs: 50, onUpdate: (u) => updates.push(u) });
});
afterEach(async () => {
  await watcher?.close();
  await cleanup();
});

const tasksFile = () => path.join(root, 'sdd/specs/spec-dev-001-pagos/cycles/cycle-01/tasks.json');

describe('startWorkspaceWatcher', () => {
  it('exposes the initial snapshot', () => {
    expect(watcher!.current().project).toBe('studio fixture');
  });

  it('emits a task.status bot event when a task changes', async () => {
    const json = JSON.parse(await readFile(tasksFile(), 'utf8'));
    json.tasks[1].status = 'done';
    await writeFile(tasksFile(), JSON.stringify(json));
    const update = await waitFor(() => updates.find((u) => u.events.some((e) => e.botKind === 'task.status')));
    expect(update.areas).toContain('specs');
    expect(watcher!.current().cycles[0]?.tasksDone).toBe(2);
  });

  it('keeps the last good state while a file is half-written, then recovers', async () => {
    const good = await readFile(tasksFile(), 'utf8');
    await writeFile(tasksFile(), '{ "tasks": [');
    await waitFor(() => watcher!.current().stale.includes('specs'));
    expect(watcher!.current().cycles[0]?.tasksDone).toBe(1);
    expect(updates.flatMap((u) => u.events)).toEqual([]);
    await writeFile(tasksFile(), good);
    await waitFor(() => watcher!.current().stale.length === 0);
    expect(updates.flatMap((u) => u.events)).toEqual([]);
  });

  it('stops after close', async () => {
    await watcher!.close();
    watcher = undefined;
    await writeFile(path.join(root, 'sdd/fixes.json'), JSON.stringify({ fixes: [] }));
    await new Promise((r) => setTimeout(r, 300));
    expect(updates).toEqual([]);
  });

  it('serializes concurrent refreshes: one task.status event total', async () => {
    const json = JSON.parse(await readFile(tasksFile(), 'utf8'));
    json.tasks[1].status = 'done';
    await writeFile(tasksFile(), JSON.stringify(json));
    const results = await Promise.all([watcher!.refresh(), watcher!.refresh()]);
    await new Promise((r) => setTimeout(r, 300));
    const events = [...updates.flatMap((u) => u.events), ...results.flatMap((u) => u?.events ?? [])];
    // onUpdate fires once per applied update; results mirror the same updates
    expect(updates.flatMap((u) => u.events).filter((e) => e.botKind === 'task.status')).toHaveLength(1);
    expect(events.length).toBeGreaterThan(0);
  });

  it('still emits when an ancestor path contains sdd/docs', async () => {
    await watcher!.close();
    const outer = await mkdtemp(path.join(tmpdir(), 'outer-'));
    const nested = path.join(outer, 'sdd', 'docs', 'copy');
    await mkdir(nested, { recursive: true });
    await cp(FIXTURE_ROOT, nested, { recursive: true });
    updates.length = 0;
    watcher = await startWorkspaceWatcher({ root: nested, debounceMs: 50, onUpdate: (u) => updates.push(u) });
    const file = path.join(nested, 'sdd/specs/spec-dev-001-pagos/cycles/cycle-01/tasks.json');
    const json = JSON.parse(await readFile(file, 'utf8'));
    json.tasks[1].status = 'done';
    await writeFile(file, JSON.stringify(json));
    await waitFor(() => updates.find((u) => u.events.some((e) => e.botKind === 'task.status')));
    await watcher.close();
    watcher = undefined;
    await rm(outer, { recursive: true, force: true });
  });

  it('close waits for an in-flight refresh', async () => {
    const json = JSON.parse(await readFile(tasksFile(), 'utf8'));
    json.tasks[1].status = 'done';
    await writeFile(tasksFile(), JSON.stringify(json));
    const pending = watcher!.refresh();
    await watcher!.close();
    watcher = undefined;
    let settled = false;
    await pending.then(() => (settled = true));
    expect(settled).toBe(true);
  });
});

describe('.claude catalog watching', () => {
  const restart = async () => {
    await watcher!.close();
    updates.length = 0;
    // chokidar can miss a moved directory on Windows; the periodic rescan is the documented recovery.
    const rescanIntervalMs = process.platform === 'win32' ? 300 : undefined;
    watcher = await startWorkspaceWatcher({ root, debounceMs: 50, rescanIntervalMs, onUpdate: (u) => updates.push(u) });
  };
  const addSkill = async (name: string) => {
    const staged = await mkdtemp(path.join(root, '.staged-skill-'));
    await writeFile(path.join(staged, 'SKILL.md'), `---\nname: ${name}\ndescription: d\n---\n`);
    await mkdir(path.join(root, '.claude/skills'), { recursive: true });
    await rename(staged, path.join(root, '.claude/skills', name));
  };

  afterEach(() => vi.restoreAllMocks());

  it('refreshes the catalog when a skill appears under .claude/skills', { retry: 2 }, async () => {
    await addSkill('first');
    await restart();
    expect(watcher!.current().skills.map((s) => s.id)).toEqual(['first']);
    await addSkill('second');
    await waitFor(() => watcher!.current().skills.some((s) => s.id === 'second'));
    expect(updates.some((u) => u.areas.includes('agents'))).toBe(true);
  });

  it('only admits agents/ and skills/ below .claude, never worktrees', () => {
    const claude = path.join(root, '.claude');
    for (const watched of [claude, path.join(claude, 'agents'), path.join(claude, 'agents/x.md'), path.join(claude, 'skills/a/SKILL.md')]) {
      expect(isClaudeCatalogPath(claude, watched), watched).toBe(true);
    }
    for (const skipped of [path.join(claude, 'worktrees'), path.join(claude, 'worktrees/wt/agents/x.md'), path.join(claude, 'settings.json'), path.join(claude, 'commands'), path.join(root, 'other'), path.join(root, '.claude-evil/agents')]) {
      expect(isClaudeCatalogPath(claude, skipped), skipped).toBe(false);
    }
  });

  it('starts a second watcher on .claude only when it exists, with a bounded depth and the catalog filter', async () => {
    const spy = vi.spyOn(chokidar, 'watch');
    await restart();
    expect(spy).toHaveBeenCalledTimes(1);
    await mkdir(path.join(root, '.claude/worktrees/wt'), { recursive: true });
    spy.mockClear();
    await restart();
    expect(spy).toHaveBeenCalledTimes(2);
    const [target, options] = spy.mock.calls[1] as [string, { depth: number; ignored: (p: string) => boolean }];
    expect(target).toBe(path.join(root, '.claude'));
    expect(options.depth).toBe(3);
    expect(options.ignored(path.join(root, '.claude/worktrees/wt'))).toBe(true);
    expect(options.ignored(path.join(root, '.claude/skills'))).toBe(false);
  });

  it('rescans on an interval to recover fs events the OS dropped', async () => {
    await watcher?.close();
    const silent = Object.assign(new EventEmitter(), { close: async () => undefined });
    vi.spyOn(chokidar, 'watch').mockImplementation(() => {
      setTimeout(() => silent.emit('ready'), 0);
      return silent as never;
    });
    updates.length = 0;
    watcher = await startWorkspaceWatcher({ root, debounceMs: 50, rescanIntervalMs: 40, onUpdate: (u) => updates.push(u) });
    const json = JSON.parse(await readFile(tasksFile(), 'utf8'));
    json.tasks[1].status = 'done';
    await writeFile(tasksFile(), JSON.stringify(json));
    const update = await waitFor(() => updates.find((u) => u.events.some((e) => e.botKind === 'task.status')));
    expect(update.areas).toContain('specs');
    vi.restoreAllMocks();
  });

  it('stops rescanning once closed', async () => {
    await watcher?.close();
    watcher = await startWorkspaceWatcher({ root, debounceMs: 50, rescanIntervalMs: 30, onUpdate: (u) => updates.push(u) });
    await watcher.close();
    updates.length = 0;
    const json = JSON.parse(await readFile(tasksFile(), 'utf8'));
    json.tasks[1].status = 'done';
    await writeFile(tasksFile(), JSON.stringify(json));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(updates).toEqual([]);
  });
});
