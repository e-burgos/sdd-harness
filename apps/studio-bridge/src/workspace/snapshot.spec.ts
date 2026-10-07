import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixture } from '../test-utils/fixture';
import { diffSnapshots } from './diff';
import { changedAreas, loadWorkspaceSnapshot, mergeSnapshot } from './snapshot';

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await copyFixture()));
afterEach(() => cleanup());

const tasksFile = () => path.join(root, 'sdd/specs/spec-dev-001-pagos/cycles/cycle-01/tasks.json');

describe('loadWorkspaceSnapshot', () => {
  it('summarizes the fixture', async () => {
    const { snapshot, failed } = await loadWorkspaceSnapshot(root);
    expect(failed).toEqual([]);
    expect(snapshot.project).toBe('studio fixture');
    expect(snapshot.profile).toBe('team');
    expect(snapshot.kitVersion).toBe('0.16.0');
    expect(snapshot.gateMode).toBe('block');
    expect(snapshot.specs.map((s) => s.id)).toEqual(['spec-dev-001-pagos', 'spec-dev-002-borrador']);
    expect(snapshot.specs[1]?.dependsOn).toEqual(['spec-dev-001-pagos']);
    expect(snapshot.cycles).toHaveLength(1);
    expect(snapshot.cycles[0]).toMatchObject({
      specId: 'spec-dev-001-pagos', cycle: 'cycle-01', status: 'in-progress', flow: 'full',
      apps: ['apps/api'], tasksTotal: 2, tasksDone: 1,
    });
    expect(snapshot.fixes).toEqual([
      { id: 'FIX-dev-001-001', title: 'Typo en el recibo', status: 'pending', severity: 'low', specId: 'spec-dev-001-pagos' },
    ]);
    expect(snapshot.agents).toEqual([
      { id: 'sdd-orchestrator', description: 'Orquestador SDD.', model: 'opus' },
      { id: 'sdd-planner', description: 'Planner SDD.', model: 'sonnet' },
    ]);
  });

  it('defaults gateMode to block and project to the folder name when files are missing', async () => {
    await rm(path.join(root, 'sdd/tools.json'));
    await rm(path.join(root, 'sdd/global.json'));
    const { snapshot, failed } = await loadWorkspaceSnapshot(root);
    expect(failed).toEqual([]);
    expect(snapshot.gateMode).toBe('block');
    expect(snapshot.project).toBe(path.basename(root));
  });

  it('marks specs as failed when a cycle file is invalid JSON', async () => {
    await writeFile(tasksFile(), '{ "tasks": [');
    const { failed } = await loadWorkspaceSnapshot(root);
    expect(failed).toContain('specs');
  });

  it('parses agent frontmatter with CRLF line endings', async () => {
    await writeFile(
      path.join(root, 'sdd/agents/sdd-reviewer.agent.md'),
      '---\r\nname: sdd-reviewer\r\ndescription: Reviewer.\r\nmodel: opus\r\n---\r\nx',
    );
    const { snapshot } = await loadWorkspaceSnapshot(root);
    expect(snapshot.agents.find((a) => a.id === 'sdd-reviewer')).toEqual({
      id: 'sdd-reviewer', description: 'Reviewer.', model: 'opus',
    });
  });
});

describe('loadWorkspaceSnapshot read failures and edge cases', () => {
  const specDir = () => path.join(root, 'sdd/specs/spec-dev-001-pagos');

  // Portable non-ENOENT failure: an agent file replaced by a directory -> readFile gives EISDIR.
  it('marks agents as failed when an agent file cannot be read', async () => {
    await mkdir(path.join(root, 'sdd/agents/broken.agent.md'));
    const { failed } = await loadWorkspaceSnapshot(root);
    expect(failed).toEqual(['agents']);
  });

  it('marks agents as failed when the agents path is a file (readdir ENOTDIR)', async () => {
    await rm(path.join(root, 'sdd/agents'), { recursive: true });
    await writeFile(path.join(root, 'sdd/agents'), 'x');
    const { failed } = await loadWorkspaceSnapshot(root);
    expect(failed).toEqual(['agents']);
  });

  it('marks specs as failed when the cycles dir is unreadable (EACCES)', async (ctx) => {
    if (process.platform === 'win32' || process.getuid?.() === 0) ctx.skip();
    const cycles = path.join(specDir(), 'cycles');
    await chmod(cycles, 0o000);
    try {
      const { failed } = await loadWorkspaceSnapshot(root);
      expect(failed).toContain('specs');
    } finally {
      await chmod(cycles, 0o755);
    }
  });

  it('treats a cycles path that is a file (ENOTDIR) as no cycles, not a failure', async () => {
    await rm(path.join(specDir(), 'cycles'), { recursive: true });
    await writeFile(path.join(specDir(), 'cycles'), 'x');
    const { snapshot, failed } = await loadWorkspaceSnapshot(root);
    expect(failed).toEqual([]);
    expect(snapshot.cycles).toEqual([]);
  });

  it('reports a missing fixes.json as missing, empty and not stale on first load', async () => {
    await rm(path.join(root, 'sdd/fixes.json'));
    const result = await loadWorkspaceSnapshot(root);
    expect(result.failed).toEqual([]);
    expect(result.missing).toEqual(['fixes']);
    const merged = mergeSnapshot(null, result);
    expect(merged.fixes).toEqual([]);
    expect(merged.stale).toEqual([]);
  });

  it('keeps previous fixes and flags stale when fixes.json disappears', async () => {
    const prev = mergeSnapshot(null, await loadWorkspaceSnapshot(root));
    await rm(path.join(root, 'sdd/fixes.json'));
    const merged = mergeSnapshot(prev, await loadWorkspaceSnapshot(root));
    expect(merged.stale).toEqual(['fixes']);
    expect(merged.fixes).toEqual(prev.fixes);
    expect(diffSnapshots(prev, merged)).toEqual([]);
  });

  it('keeps previous specs and flags stale when specs/index.json disappears', async () => {
    const prev = mergeSnapshot(null, await loadWorkspaceSnapshot(root));
    await rm(path.join(root, 'sdd/specs/index.json'));
    const merged = mergeSnapshot(prev, await loadWorkspaceSnapshot(root));
    expect(merged.stale).toEqual(['specs']);
    expect(merged.specs).toEqual(prev.specs);
    expect(merged.cycles).toEqual(prev.cycles);
    expect(diffSnapshots(prev, merged)).toEqual([]);
  });

  it('lists a spec with an out-of-tree folder but skips its cycles', async () => {
    const file = path.join(root, 'sdd/specs/index.json');
    const index = JSON.parse(await readFile(file, 'utf8'));
    index.specs[0].folder = '../outside';
    await writeFile(file, JSON.stringify(index));
    const { snapshot, failed } = await loadWorkspaceSnapshot(root);
    expect(failed).toEqual([]);
    expect(snapshot.specs.map((s) => s.id)).toContain('spec-dev-001-pagos');
    expect(snapshot.cycles).toEqual([]);
  });

  it('skips a cycle directory with neither cycle.json nor tasks.json', async () => {
    await mkdir(path.join(specDir(), 'cycles/cycle-02'));
    const { snapshot } = await loadWorkspaceSnapshot(root);
    expect(snapshot.cycles.map((c) => c.cycle)).toEqual(['cycle-01']);
  });
});

describe('mergeSnapshot / changedAreas', () => {
  it('keeps the previous data of a failed area and flags it stale', async () => {
    const prev = mergeSnapshot(null, await loadWorkspaceSnapshot(root));
    await writeFile(tasksFile(), '{ broken');
    const next = mergeSnapshot(prev, await loadWorkspaceSnapshot(root));
    expect(next.stale).toEqual(['specs']);
    expect(next.cycles).toEqual(prev.cycles);
    expect(next.specs).toEqual(prev.specs);
    expect(diffSnapshots(prev, next)).toEqual([]);
    expect(changedAreas(prev, next)).toEqual(['specs']);
  });

  it('detects a fixes change only', async () => {
    const prev = mergeSnapshot(null, await loadWorkspaceSnapshot(root));
    await writeFile(path.join(root, 'sdd/fixes.json'), JSON.stringify({ fixes: [] }));
    const next = mergeSnapshot(prev, await loadWorkspaceSnapshot(root));
    expect(changedAreas(prev, next)).toEqual(['fixes']);
  });
});
