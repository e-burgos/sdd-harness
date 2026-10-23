import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadCatalog } from './catalog';

let root: string;
let outside: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'sdd-catalog-'));
  outside = await mkdtemp(path.join(tmpdir(), 'sdd-catalog-out-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

const write = async (rel: string, content: string, base = root) => {
  await mkdir(path.dirname(path.join(base, rel)), { recursive: true });
  await writeFile(path.join(base, rel), content);
};
const fm = (fields: Record<string, string>) => `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\nbody`;
const skill = (dir: string, name: string | null, description = 'd') =>
  write(`${dir}/${name ?? 'x'}/SKILL.md`, fm({ ...(name ? { name } : {}), description }));

describe('loadCatalog', () => {
  it('is empty and healthy when no source exists', async () => {
    expect(await loadCatalog(root)).toEqual({ ok: true, agents: [], skills: [] });
  });

  it('reads the five sources with their ids, kinds and sources', async () => {
    await write('.claude/agents/local.md', fm({ name: 'local-agent', description: 'L', model: 'haiku' }));
    await write('sdd/agents/planner.agent.md', fm({ description: 'P' }));
    await skill('.claude/skills', 'commit', 'C');
    await skill('sdd/skills', 'sdd-planner', 'S');
    await write('sdd/prompts/review-cycle.prompt.md', '# no frontmatter');
    const catalog = await loadCatalog(root);
    expect(catalog.ok).toBe(true);
    expect(catalog.agents).toEqual([
      { id: 'local-agent', description: 'L', model: 'haiku', source: 'claude', path: '.claude/agents/local.md' },
      { id: 'planner', description: 'P', model: null, source: 'sdd', path: 'sdd/agents/planner.agent.md' },
    ]);
    expect(catalog.skills).toEqual([
      { id: 'commit', kind: 'skill', description: 'C', source: 'claude', path: '.claude/skills/commit/SKILL.md' },
      { id: 'review-cycle', kind: 'prompt', description: '', source: 'sdd', path: 'sdd/prompts/review-cycle.prompt.md' },
      { id: 'sdd-planner', kind: 'skill', description: 'S', source: 'sdd', path: 'sdd/skills/sdd-planner/SKILL.md' },
    ]);
  });

  it('dedupes .claude symlinks onto sdd/ keeping the canonical real path and sdd source', async () => {
    await write('sdd/agents/planner.agent.md', fm({ description: 'P' }));
    await skill('sdd/skills', 'sdd-planner');
    await mkdir(path.join(root, '.claude'), { recursive: true });
    await symlink('../sdd/agents', path.join(root, '.claude', 'agents'));
    await symlink('../sdd/skills', path.join(root, '.claude', 'skills'));
    const catalog = await loadCatalog(root);
    expect(catalog.agents).toEqual([expect.objectContaining({ id: 'planner', source: 'sdd', path: 'sdd/agents/planner.agent.md' })]);
    expect(catalog.skills).toEqual([expect.objectContaining({ id: 'sdd-planner', source: 'sdd', path: 'sdd/skills/sdd-planner/SKILL.md' })]);
  });

  it('gives the earlier source precedence when different files share an id', async () => {
    await write('.claude/agents/planner.md', fm({ description: 'claude copy' }));
    await write('sdd/agents/planner.agent.md', fm({ description: 'sdd copy' }));
    await skill('.claude/skills', 'shared', 'claude skill');
    await skill('sdd/skills', 'shared', 'sdd skill');
    const catalog = await loadCatalog(root);
    expect(catalog.agents).toEqual([expect.objectContaining({ description: 'claude copy', source: 'claude' })]);
    expect(catalog.skills).toEqual([expect.objectContaining({ description: 'claude skill', source: 'claude' })]);
  });

  it('lets a skill win over a prompt with the same id and names prompts by basename', async () => {
    await skill('sdd/skills', 'review-cycle', 'the skill');
    await write('sdd/prompts/review-cycle.prompt.md', fm({ name: 'other', description: 'the prompt' }));
    await write('sdd/prompts/start.prompt.md', fm({ name: 'ignored-name' }));
    const catalog = await loadCatalog(root);
    expect(catalog.skills.map((s) => [s.id, s.kind])).toEqual([['review-cycle', 'skill'], ['start', 'prompt']]);
  });

  it('omits entries whose id cannot be referenced', async () => {
    await write('sdd/agents/dotted.agent.md', fm({ name: 'bad.id' }));
    await write('sdd/agents/ok.agent.md', fm({}));
    await skill('sdd/skills', 'has space');
    await skill('sdd/skills', 'ns:ok.v1');
    const catalog = await loadCatalog(root);
    expect(catalog.agents.map((a) => a.id)).toEqual(['ok']);
    expect(catalog.skills.map((s) => s.id)).toEqual(['ns:ok.v1']);
  });

  it('ignores sources and files that resolve outside the root', async () => {
    await write('evil/SKILL.md', fm({ name: 'evil' }), outside);
    await write('stolen.agent.md', fm({ name: 'stolen' }), outside);
    await mkdir(path.join(root, 'sdd', 'agents'), { recursive: true });
    await symlink(path.join(outside, 'stolen.agent.md'), path.join(root, 'sdd', 'agents', 'stolen.agent.md'));
    await mkdir(path.join(root, '.claude'), { recursive: true });
    await symlink(outside, path.join(root, '.claude', 'skills'));
    expect(await loadCatalog(root)).toEqual({ ok: true, agents: [], skills: [] });
  });

  it('caps each kind at 200, trims descriptions to 300 and reads only the head of each file', async () => {
    for (let i = 0; i < 205; i++) await skill('sdd/skills', `s${String(i).padStart(3, '0')}`);
    await write('sdd/agents/long.agent.md', fm({ description: 'x'.repeat(400) }));
    await write('sdd/agents/late.agent.md', `${'#'.repeat(9000)}\n${fm({ name: 'late-agent' })}`);
    await write('sdd/agents/huge-fm.agent.md', `---\ndescription: ${'y'.repeat(9000)}\nname: after-limit\n---\n`);
    const catalog = await loadCatalog(root);
    expect(catalog.skills).toHaveLength(200);
    expect(catalog.skills.at(-1)?.id).toBe('s199');
    expect(catalog.agents.find((a) => a.id === 'long')?.description).toHaveLength(300);
    expect(catalog.agents.map((a) => a.id)).toEqual(['huge-fm', 'late', 'long']);
  });

  it.each([
    ['sdd/agents is a file', 'sdd/agents'],
    ['.claude/skills is a file', '.claude/skills'],
  ])('reports not ok when %s (an error other than ENOENT)', async (_name, rel) => {
    await write(rel, 'x');
    expect((await loadCatalog(root)).ok).toBe(false);
  });

  it('skips skill folders without SKILL.md and stray files without failing', async () => {
    await mkdir(path.join(root, 'sdd', 'skills', 'empty'), { recursive: true });
    await write('sdd/skills/README.md', 'x');
    await skill('sdd/skills', 'real');
    const catalog = await loadCatalog(root);
    expect(catalog.ok).toBe(true);
    expect(catalog.skills.map((s) => s.id)).toEqual(['real']);
  });
});
