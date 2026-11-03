import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MAX_CYCLE_DOCUMENTS, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixture } from '../test-utils/fixture';
import { diffSnapshots } from './diff';
import { computeToolsRevision } from './kit-tools';
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
      { id: 'FIX-dev-001-001', title: 'Typo en el recibo', status: 'pending', severity: 'low', specId: 'spec-dev-001-pagos', createdAt: null, closedAt: null },
    ]);
    expect(snapshot.agents).toEqual([
      { id: 'sdd-orchestrator', description: 'Orquestador SDD.', model: 'opus', source: 'sdd', path: 'sdd/agents/sdd-orchestrator.agent.md' },
      { id: 'sdd-planner', description: 'Planner SDD.', model: 'sonnet', source: 'sdd', path: 'sdd/agents/sdd-planner.agent.md' },
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
      id: 'sdd-reviewer', description: 'Reviewer.', model: 'opus', source: 'sdd', path: 'sdd/agents/sdd-reviewer.agent.md',
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

  it('I1: skips specs whose id is not a safe channel segment', async () => {
    const file = path.join(root, 'sdd/specs/index.json');
    const index = JSON.parse(await readFile(file, 'utf8'));
    index.specs.push({ id: 'x/../../escaped', title: 'evil', status: 'in-progress', folder: 'sdd/specs/spec-dev-001-pagos' });
    await writeFile(file, JSON.stringify(index));
    const { snapshot } = await loadWorkspaceSnapshot(root);
    expect(snapshot.specs.map((sp) => sp.id)).toEqual(['spec-dev-001-pagos', 'spec-dev-002-borrador']);
    expect(snapshot.cycles.every((c) => c.specId !== 'x/../../escaped')).toBe(true);
  });

  it('validates against the protocol snapshot schema', async () => {
    const { snapshot } = await loadWorkspaceSnapshot(root);
    expect(WorkspaceSnapshot.safeParse(snapshot).success).toBe(true);
    expect(snapshot.skills).toEqual([]);
  });

  it('fills snapshot.skills from the catalog and still validates against the protocol schema', async () => {
    await mkdir(path.join(root, 'sdd/skills/sdd-planner'), { recursive: true });
    await writeFile(path.join(root, 'sdd/skills/sdd-planner/SKILL.md'), '---\nname: sdd-planner\ndescription: Plans\n---\n');
    const { snapshot } = await loadWorkspaceSnapshot(root);
    expect(snapshot.skills).toEqual([{ id: 'sdd-planner', kind: 'skill', description: 'Plans', source: 'sdd', path: 'sdd/skills/sdd-planner/SKILL.md' }]);
    expect(WorkspaceSnapshot.safeParse(snapshot).success).toBe(true);
  });

  it('agents area covers the skills field', async () => {
    const prev = mergeSnapshot(null, await loadWorkspaceSnapshot(root));
    const withSkill = {
      ...prev,
      skills: [{ id: 'sdd-planner', kind: 'skill' as const, description: 'd', source: 'sdd' as const, path: 'sdd/skills/sdd-planner/SKILL.md' }],
    };
    expect(changedAreas(prev, withSkill)).toEqual(['agents']);
  });

  describe('fix dates', () => {
    const writeFixes = (fixes: unknown[]) => writeFile(path.join(root, 'sdd/fixes.json'), JSON.stringify({ fixes }));
    const loaded = async () => (await loadWorkspaceSnapshot(root)).snapshot.fixes;

    it('reads createdAt and closedAt from created_at and resolved_at', async () => {
      await writeFixes([{ id: 'FIX-1', title: 't', status: 'resolved', created_at: '2026-10-01', resolved_at: '2026-10-03', validated_at: '2026-10-05' }]);
      expect(await loaded()).toEqual([
        { id: 'FIX-1', title: 't', status: 'resolved', severity: null, specId: null, createdAt: '2026-10-01', closedAt: '2026-10-03' },
      ]);
    });

    it('falls back to validated_at when resolved_at is missing', async () => {
      await writeFixes([{ id: 'FIX-1', status: 'validated', created_at: '2026-10-01', validated_at: '2026-10-05' }]);
      expect((await loaded())[0]).toMatchObject({ createdAt: '2026-10-01', closedAt: '2026-10-05' });
    });

    it('leaves the dates null when they do not exist or are not strings', async () => {
      await writeFixes([{ id: 'FIX-1', status: 'pending' }, { id: 'FIX-2', status: 'pending', created_at: 20261001, resolved_at: null }]);
      expect(await loaded()).toEqual([
        expect.objectContaining({ id: 'FIX-1', createdAt: null, closedAt: null }),
        expect.objectContaining({ id: 'FIX-2', createdAt: null, closedAt: null }),
      ]);
    });
  });
});

describe('tools state and documents in the snapshot', () => {
  it('reports the tools state with its revision', async () => {
    const { snapshot } = await loadWorkspaceSnapshot(root);
    const raw = await readFile(path.join(root, 'sdd/tools.json'));
    expect(snapshot.tools).toEqual({
      status: 'ok', rtkEnabled: false, modEnabled: false, gate: 'block', modLinked: false, revision: computeToolsRevision(raw),
    });
  });

  it('reports modLinked when the mod plugin manifest exists', async () => {
    const manifest = path.join(root, '.claude/skills/sdd-mod/.claude-plugin/plugin.json');
    await mkdir(path.dirname(manifest), { recursive: true });
    await writeFile(manifest, '{}');
    expect((await loadWorkspaceSnapshot(root)).snapshot.tools?.modLinked).toBe(true);
  });

  it('reports missing and invalid tools.json without marking the area failed when missing', async () => {
    await rm(path.join(root, 'sdd/tools.json'));
    const missing = await loadWorkspaceSnapshot(root);
    expect(missing.snapshot.tools).toEqual({ status: 'missing', rtkEnabled: null, modEnabled: null, gate: null, modLinked: false, revision: null });
    expect(missing.failed).toEqual([]);
    await writeFile(path.join(root, 'sdd/tools.json'), '{ nope');
    const invalid = await loadWorkspaceSnapshot(root);
    expect(invalid.snapshot.tools).toMatchObject({ status: 'invalid', rtkEnabled: null, revision: null });
    expect(invalid.failed).toContain('tools');
  });

  it('does not restore the previous tools state when tools.json turns invalid', async () => {
    const prev = mergeSnapshot(null, await loadWorkspaceSnapshot(root));
    await writeFile(path.join(root, 'sdd/tools.json'), '{ nope');
    const merged = mergeSnapshot(prev, await loadWorkspaceSnapshot(root));
    expect(merged.tools?.status).toBe('invalid');
    expect(merged.gateMode).toBe(prev.gateMode);
    expect(merged.stale).toContain('tools');
    expect(changedAreas(prev, merged)).toContain('tools');
  });

  it('flags the tools area as changed when only the tools state changes', async () => {
    const prev = mergeSnapshot(null, await loadWorkspaceSnapshot(root));
    await writeFile(path.join(root, 'sdd/tools.json'), JSON.stringify({ rtk: { enabled: true }, claude_mod: { enabled: false, gate: 'block' } }));
    const next = mergeSnapshot(prev, await loadWorkspaceSnapshot(root));
    expect(changedAreas(prev, next)).toEqual(['tools']);
    expect(next.tools?.rtkEnabled).toBe(true);
  });

  it('lists the whitelisted cycle documents plus first-level artifacts only', async () => {
    const cycleDir = path.join(root, 'sdd/specs/spec-dev-001-pagos/cycles/cycle-01');
    await writeFile(path.join(cycleDir, 'functional.md'), 'x');
    await writeFile(path.join(cycleDir, 'architect.md'), 'x');
    await writeFile(path.join(cycleDir, 'notes.md'), 'x');
    await mkdir(path.join(cycleDir, 'artifacts', 'deep'), { recursive: true });
    await writeFile(path.join(cycleDir, 'artifacts', 'b.txt'), 'x');
    await writeFile(path.join(cycleDir, 'artifacts', 'a.txt'), 'x');
    await writeFile(path.join(cycleDir, 'artifacts', '.hidden'), 'x');
    await writeFile(path.join(cycleDir, 'artifacts', 'deep', 'c.txt'), 'x');
    const { snapshot } = await loadWorkspaceSnapshot(root);
    expect(snapshot.cycles[0]?.documents).toEqual(['functional.md', 'architect.md', 'cycle.json', 'tasks.json', 'artifacts/a.txt', 'artifacts/b.txt']);
  });

  it('skips over-long artifact names and keeps the rest valid against the protocol', async () => {
    const dir = path.join(root, 'sdd/specs/spec-dev-001-pagos/cycles/cycle-01/artifacts');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${'n'.repeat(250)}.txt`), 'x');
    await writeFile(path.join(dir, 'ok.txt'), 'x');
    const { snapshot } = await loadWorkspaceSnapshot(root);
    expect(snapshot.cycles[0]?.documents).toEqual(['cycle.json', 'tasks.json', 'artifacts/ok.txt']);
    expect(WorkspaceSnapshot.safeParse(snapshot).success).toBe(true);
  });

  it('reports invalid for tools.json that violates the schema', async () => {
    const file = path.join(root, 'sdd/tools.json');
    for (const doc of [{ claude_mod: { enabled: false, gate: 'block' } }, { rtk: { enabled: 'no' } }]) {
      await writeFile(file, JSON.stringify(doc));
      expect((await loadWorkspaceSnapshot(root)).snapshot.tools).toMatchObject({
        status: 'invalid', rtkEnabled: null, modEnabled: null, gate: null, revision: null,
      });
    }
  });

  it('caps the document list at MAX_CYCLE_DOCUMENTS', async () => {
    const dir = path.join(root, 'sdd/specs/spec-dev-001-pagos/cycles/cycle-01/artifacts');
    await mkdir(dir, { recursive: true });
    for (let i = 0; i < MAX_CYCLE_DOCUMENTS + 10; i++) await writeFile(path.join(dir, `f${String(i).padStart(3, '0')}.txt`), 'x');
    const { snapshot } = await loadWorkspaceSnapshot(root);
    expect(snapshot.cycles[0]?.documents).toHaveLength(MAX_CYCLE_DOCUMENTS);
  });

  it('reports the spec document when the spec file exists and omits it otherwise', async () => {
    const { snapshot } = await loadWorkspaceSnapshot(root);
    const pagos = snapshot.specs.find((s) => s.id === 'spec-dev-001-pagos');
    expect(pagos?.document).toBe(`${pagos?.folder}/spec-dev-001-pagos.spec.md`);
    expect(snapshot.specs.find((s) => s.id === 'spec-dev-002-borrador')?.document).toBeUndefined();
  });

  it('keeps fix_document only when it points inside sdd/', async () => {
    const file = path.join(root, 'sdd/fixes.json');
    const json = JSON.parse(await readFile(file, 'utf8'));
    const base = json.fixes[0];
    json.fixes = [
      { ...base, id: 'F1', fix_document: 'sdd/fixes/fix-1.md' },
      { ...base, id: 'F2', fix_document: 'sdd/../secret.md' },
      { ...base, id: 'F3', fix_document: '/etc/passwd' },
      { ...base, id: 'F4', fix_document: undefined },
    ];
    await writeFile(file, JSON.stringify(json));
    const { snapshot } = await loadWorkspaceSnapshot(root);
    expect(snapshot.fixes.map((f) => f.document)).toEqual(['sdd/fixes/fix-1.md', undefined, undefined, undefined]);
  });

  it('produces a snapshot the protocol accepts', async () => {
    const { snapshot } = await loadWorkspaceSnapshot(root);
    expect(WorkspaceSnapshot.safeParse(snapshot).success).toBe(true);
  });
});
