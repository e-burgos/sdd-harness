import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixture, FIXTURE_ROOT, waitFor } from '../test-utils/fixture';
import { startWorkspaceWatcher, type WorkspaceUpdate, type WorkspaceWatcher } from './watcher';

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
