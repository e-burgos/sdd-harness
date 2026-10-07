import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  AgentSummary,
  Area,
  CycleSummary,
  FixSummary,
  SpecSummary,
  TaskSummary,
  WorkspaceSnapshot,
} from '@sdd-studio/protocol';

type Json = Record<string, any>;
type ReadResult = { ok: true; value: Json | null; missing?: boolean } | { ok: false };

export interface LoadResult {
  snapshot: WorkspaceSnapshot;
  failed: Area[];
  /** Areas whose source file does not exist (ENOENT). Only 'specs' and 'fixes'. */
  missing: Area[];
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

async function readJson(file: string): Promise<ReadResult> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? { ok: true, value: null, missing: true } : { ok: false };
  }
  try {
    return { ok: true, value: JSON.parse(raw) as Json };
  } catch {
    return { ok: false };
  }
}

const toTask = (t: Json): TaskSummary => ({
  id: str(t.id),
  title: str(t.title, str(t.id)),
  status: str(t.status, 'pending'),
  storyPoints: typeof t.story_points === 'number' ? t.story_points : null,
});

const toSpec = (s: Json): SpecSummary => ({
  id: str(s.id),
  title: str(s.title, str(s.id)),
  status: str(s.status, 'draft'),
  folder: str(s.folder),
  module: strOrNull(s.module),
  app: strOrNull(s.app),
  dependsOn: strings(s.depends_on),
});

const toFix = (f: Json): FixSummary => ({
  id: str(f.id),
  title: str(f.title, str(f.id)),
  status: str(f.status, 'pending'),
  severity: strOrNull(f.severity),
  specId: strOrNull(f.spec_id),
});

async function loadSpecs(root: string, sdd: string) {
  const index = await readJson(path.join(sdd, 'specs', 'index.json'));
  if (!index.ok) return { ok: false, missing: false, specs: [] as SpecSummary[], cycles: [] as CycleSummary[] };
  let ok = true;
  const specs = (Array.isArray(index.value?.specs) ? index.value.specs : []).map(toSpec);
  const cycles: CycleSummary[] = [];
  for (const spec of specs) {
    const segments = spec.folder.split('/');
    if (!spec.folder.startsWith('sdd/') || segments.includes('..')) continue;
    const dir = path.join(root, ...segments, 'cycles');
    let names: string[];
    try {
      names = await readdir(dir);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') ok = false;
      continue;
    }
    for (const name of names.filter((n) => /^cycle-\d{2}$/.test(n)).sort()) {
      const [cycle, tasks] = await Promise.all([
        readJson(path.join(dir, name, 'cycle.json')),
        readJson(path.join(dir, name, 'tasks.json')),
      ]);
      if (!cycle.ok || !tasks.ok) {
        ok = false;
        continue;
      }
      if (cycle.value === null && tasks.value === null) continue;
      const list = (Array.isArray(tasks.value?.tasks) ? tasks.value.tasks : []).map(toTask);
      const counted = list.filter((t: TaskSummary) => t.status !== 'skipped');
      cycles.push({
        specId: spec.id,
        cycle: name,
        status: str(cycle.value?.status, 'unknown'),
        flow: str(cycle.value?.flow, str(tasks.value?.flow, 'full')),
        apps: strings(cycle.value?.apps),
        tasks: list,
        tasksTotal: counted.length,
        tasksDone: counted.filter((t: TaskSummary) => t.status === 'done').length,
      });
    }
  }
  return { ok, missing: index.missing === true, specs, cycles };
}

function parseFrontmatter(text: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(text.replace(/\r\n/g, '\n'));
  const out: Record<string, string> = {};
  for (const line of match?.[1]?.split('\n') ?? []) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv?.[1] && kv[2] !== undefined) out[kv[1]] = kv[2].trim();
  }
  return out;
}

async function loadAgents(dir: string): Promise<{ ok: boolean; agents: AgentSummary[] }> {
  const agents: AgentSummary[] = [];
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    return { ok: (error as NodeJS.ErrnoException).code === 'ENOENT', agents };
  }
  let ok = true;
  for (const name of names.filter((n) => n.endsWith('.agent.md')).sort()) {
    let text: string;
    try {
      text = await readFile(path.join(dir, name), 'utf8');
    } catch {
      ok = false;
      continue;
    }
    const fm = parseFrontmatter(text);
    agents.push({
      id: fm.name ?? name.replace(/\.agent\.md$/, ''),
      description: fm.description ?? '',
      model: fm.model ?? null,
    });
  }
  return { ok, agents };
}

export async function loadWorkspaceSnapshot(root: string): Promise<LoadResult> {
  const sdd = path.join(root, 'sdd');
  const failed: Area[] = [];
  const missing: Area[] = [];
  const read = async (area: Area, rel: string): Promise<Json | null> => {
    const result = await readJson(path.join(sdd, rel));
    if (!result.ok) {
      failed.push(area);
      return null;
    }
    if (result.missing && area === 'fixes') missing.push(area);
    return result.value;
  };
  const [global, tools, pricing, kit, fixes] = await Promise.all([
    read('global', 'global.json'),
    read('tools', 'tools.json'),
    read('pricing', 'pricing.json'),
    read('kit', 'kit.json'),
    read('fixes', 'fixes.json'),
  ]);
  const specs = await loadSpecs(root, sdd);
  if (!specs.ok) failed.push('specs');
  else if (specs.missing) missing.push('specs');
  const agents = await loadAgents(path.join(sdd, 'agents'));
  if (!agents.ok) failed.push('agents');
  const snapshot: WorkspaceSnapshot = {
    project: str(global?.project, path.basename(root)),
    profile: str(global?.profile, 'team'),
    kitVersion: strOrNull(kit?.kit_version),
    specs: specs.specs,
    cycles: specs.cycles,
    fixes: Array.isArray(fixes?.fixes) ? fixes.fixes.map(toFix) : [],
    agents: agents.agents,
    gateMode: tools?.claude_mod?.gate === 'warn' ? 'warn' : 'block',
    pricing: pricing && typeof pricing === 'object' ? pricing : null,
    stale: [],
  };
  return { snapshot, failed, missing };
}

const AREA_FIELDS: Record<Area, (keyof WorkspaceSnapshot)[]> = {
  global: ['project', 'profile'],
  specs: ['specs', 'cycles'],
  fixes: ['fixes'],
  agents: ['agents'],
  tools: ['gateMode'],
  pricing: ['pricing'],
  kit: ['kitVersion'],
};

export function mergeSnapshot(prev: WorkspaceSnapshot | null, next: LoadResult): WorkspaceSnapshot {
  const out: WorkspaceSnapshot = { ...next.snapshot, stale: [...next.failed] };
  if (prev) for (const area of next.missing) if (!out.stale.includes(area)) out.stale.push(area);
  if (prev) {
    for (const area of [...next.failed, ...next.missing]) {
      for (const field of AREA_FIELDS[area]) (out as Record<string, unknown>)[field] = prev[field];
    }
  }
  return out;
}

export function changedAreas(prev: WorkspaceSnapshot, next: WorkspaceSnapshot): Area[] {
  return (Object.keys(AREA_FIELDS) as Area[]).filter((area) => {
    const fieldsChanged = AREA_FIELDS[area].some(
      (field) => JSON.stringify(prev[field]) !== JSON.stringify(next[field]),
    );
    return fieldsChanged || prev.stale.includes(area) !== next.stale.includes(area);
  });
}
