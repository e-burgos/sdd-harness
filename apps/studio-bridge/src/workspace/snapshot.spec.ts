import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixture } from '../test-utils/fixture';
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

describe('mergeSnapshot / changedAreas', () => {
  it('keeps the previous data of a failed area and flags it stale', async () => {
    const prev = mergeSnapshot(null, await loadWorkspaceSnapshot(root));
    await writeFile(tasksFile(), '{ broken');
    const next = mergeSnapshot(prev, await loadWorkspaceSnapshot(root));
    expect(next.stale).toEqual(['specs']);
    expect(next.cycles).toEqual(prev.cycles);
    expect(changedAreas(prev, next)).toEqual(['specs']);
  });

  it('detects a fixes change only', async () => {
    const prev = mergeSnapshot(null, await loadWorkspaceSnapshot(root));
    await writeFile(path.join(root, 'sdd/fixes.json'), JSON.stringify({ fixes: [] }));
    const next = mergeSnapshot(prev, await loadWorkspaceSnapshot(root));
    expect(changedAreas(prev, next)).toEqual(['fixes']);
  });
});
