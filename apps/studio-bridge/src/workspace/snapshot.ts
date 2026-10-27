import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  MAX_CYCLE_DOCUMENTS,
  type Area,
  type CycleSummary,
  type FixSummary,
  type KitToolsState,
  type SpecSummary,
  type TaskSummary,
  type WorkspaceSnapshot,
} from '@sdd-studio/protocol';

import { loadCatalog } from './catalog';
import { computeToolsRevision, effectiveToolsValues, isModLinked, loadValidator } from './kit-tools';

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

const safeSddPath = (value: unknown): string | undefined =>
  typeof value === 'string' && value.startsWith('sdd/') && value.length <= 512 && !value.split('/').includes('..') ? value : undefined;

const toFix = (f: Json): FixSummary => ({
  id: str(f.id),
  title: str(f.title, str(f.id)),
  status: str(f.status, 'pending'),
  severity: strOrNull(f.severity),
  specId: strOrNull(f.spec_id),
  createdAt: strOrNull(f.created_at),
  closedAt: strOrNull(f.resolved_at) ?? strOrNull(f.validated_at),
  document: safeSddPath(f.fix_document),
});

const CYCLE_DOCUMENT_NAMES = ['brief.yaml', 'functional.md', 'planner.md', 'architect.md', 'plan.md', 'cycle.json', 'tasks.json'];

async function regularFileNames(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && !entry.name.startsWith('.')).map((entry) => entry.name);
  } catch {
    return [];
  }
}

const MAX_CYCLE_DOCUMENT_LENGTH = 256;

async function listCycleDocuments(cycleDir: string): Promise<string[]> {
  const present = new Set(await regularFileNames(cycleDir));
  const artifacts = (await regularFileNames(path.join(cycleDir, 'artifacts'))).sort();
  const artifactPaths = artifacts.map((name) => `artifacts/${name}`).filter((entry) => entry.length <= MAX_CYCLE_DOCUMENT_LENGTH);
  return [...CYCLE_DOCUMENT_NAMES.filter((name) => present.has(name)), ...artifactPaths].slice(0, MAX_CYCLE_DOCUMENTS);
}

async function specDocument(root: string, spec: SpecSummary): Promise<string | undefined> {
  const relative = `${spec.folder}/${spec.id}.spec.md`;
  if (!spec.folder.startsWith('sdd/') || spec.folder.split('/').includes('..')) return undefined;
  const info = await stat(path.join(root, ...relative.split('/'))).catch(() => null);
  return info?.isFile() ? relative : undefined;
}

export async function readToolsState(root: string): Promise<KitToolsState> {
  const unknown = (status: 'missing' | 'invalid'): KitToolsState => ({
    status,
    rtkEnabled: null,
    modEnabled: null,
    gate: null,
    modLinked: false,
    revision: null,
  });
  let raw: Buffer;
  try {
    raw = await readFile(path.join(root, 'sdd', 'tools.json'));
  } catch (error) {
    return unknown((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'invalid');
  }
  let doc: unknown;
  try {
    doc = JSON.parse(raw.toString('utf8'));
  } catch {
    return unknown('invalid');
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return unknown('invalid');
  const problem = (await loadValidator(root))(doc);
  if (problem) return unknown('invalid');
  return {
    status: 'ok',
    ...effectiveToolsValues(doc as Record<string, unknown>),
    modLinked: await isModLinked(root),
    revision: computeToolsRevision(raw),
  };
}

const SAFE_SPEC_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

async function loadSpecs(root: string, sdd: string) {
  const index = await readJson(path.join(sdd, 'specs', 'index.json'));
  if (!index.ok) return { ok: false, missing: false, specs: [] as SpecSummary[], cycles: [] as CycleSummary[] };
  let ok = true;
  // Spec ids are part of a ChannelId and of paths in .sdd-studio/: unsafe ones are dropped.
  const specs = (Array.isArray(index.value?.specs) ? index.value.specs : [])
    .map(toSpec)
    .filter((sp: SpecSummary) => SAFE_SPEC_ID.test(sp.id));
  for (const spec of specs) {
    const document = await specDocument(root, spec);
    if (document) spec.document = document;
  }
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
        documents: await listCycleDocuments(path.join(dir, name)),
      });
    }
  }
  return { ok, missing: index.missing === true, specs, cycles };
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
  const toolsState = await readToolsState(root);
  const catalog = await loadCatalog(root);
  if (!catalog.ok) failed.push('agents');
  const snapshot: WorkspaceSnapshot = {
    project: str(global?.project, path.basename(root)),
    profile: str(global?.profile, 'team'),
    kitVersion: strOrNull(kit?.kit_version),
    specs: specs.specs,
    cycles: specs.cycles,
    fixes: Array.isArray(fixes?.fixes) ? fixes.fixes.map(toFix) : [],
    agents: catalog.agents,
    skills: catalog.skills,
    gateMode: tools?.claude_mod?.gate === 'warn' ? 'warn' : 'block',
    pricing: pricing && typeof pricing === 'object' ? pricing : null,
    tools: toolsState,
    stale: [],
  };
  return { snapshot, failed, missing };
}

const AREA_FIELDS: Record<Area, (keyof WorkspaceSnapshot)[]> = {
  global: ['project', 'profile'],
  specs: ['specs', 'cycles'],
  fixes: ['fixes'],
  agents: ['agents', 'skills'],
  tools: ['gateMode', 'tools'],
  pricing: ['pricing'],
  kit: ['kitVersion'],
};

export function mergeSnapshot(prev: WorkspaceSnapshot | null, next: LoadResult): WorkspaceSnapshot {
  const out: WorkspaceSnapshot = { ...next.snapshot, stale: [...next.failed] };
  if (prev) for (const area of next.missing) if (!out.stale.includes(area)) out.stale.push(area);
  if (prev) {
    for (const area of [...next.failed, ...next.missing]) {
      for (const field of AREA_FIELDS[area]) {
        if (field !== 'tools') (out as Record<string, unknown>)[field] = prev[field];
      }
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
