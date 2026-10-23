import { open, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { AgentId, CatalogId, type AgentSummary, type CatalogSource, type SkillSummary } from '@sdd-studio/protocol';

export interface Catalog {
  ok: boolean;
  agents: AgentSummary[];
  skills: SkillSummary[];
}

type Kind = 'agent' | 'skill' | 'prompt';
type Layout = 'files' | 'skill-dirs';

interface Source {
  dir: string;
  kind: Kind;
  layout: Layout;
  matches(name: string): boolean;
  idFromName(name: string): string;
}

const CAP_PER_KIND = 200;
const MAX_DESCRIPTION = 300;
const READ_BYTES = 8192;

const stripSuffix = (name: string, suffixes: string[]): string => {
  const suffix = suffixes.find((candidate) => name.endsWith(candidate));
  return suffix ? name.slice(0, -suffix.length) : name;
};

const SOURCES: Source[] = [
  { dir: '.claude/agents', kind: 'agent', layout: 'files', matches: (n) => n.endsWith('.md'), idFromName: (n) => stripSuffix(n, ['.agent.md', '.md']) },
  { dir: 'sdd/agents', kind: 'agent', layout: 'files', matches: (n) => n.endsWith('.agent.md'), idFromName: (n) => stripSuffix(n, ['.agent.md']) },
  { dir: '.claude/skills', kind: 'skill', layout: 'skill-dirs', matches: () => true, idFromName: (n) => n },
  { dir: 'sdd/skills', kind: 'skill', layout: 'skill-dirs', matches: () => true, idFromName: (n) => n },
  { dir: 'sdd/prompts', kind: 'prompt', layout: 'files', matches: (n) => n.endsWith('.prompt.md'), idFromName: (n) => stripSuffix(n, ['.prompt.md']) },
];

export function parseFrontmatter(text: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(text.replace(/\r\n/g, '\n'));
  const out: Record<string, string> = {};
  for (const line of match?.[1]?.split('\n') ?? []) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv?.[1] && kv[2] !== undefined) out[kv[1]] = kv[2].trim();
  }
  return out;
}

const isMissing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';

async function readHead(file: string): Promise<string> {
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.alloc(READ_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, READ_BYTES, 0);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await handle.close();
  }
}

const isInside = (parent: string, child: string): boolean => child.startsWith(parent + path.sep);

interface Found {
  kind: Kind;
  id: string;
  description: string;
  model: string | null;
  source: CatalogSource;
  path: string;
}

export async function loadCatalog(root: string): Promise<Catalog> {
  let ok = true;
  let rootReal: string;
  try {
    rootReal = await realpath(root);
  } catch {
    return { ok: false, agents: [], skills: [] };
  }

  const candidatesOf = async (source: Source): Promise<string[]> => {
    let dirReal: string;
    let names: string[];
    try {
      dirReal = await realpath(path.join(rootReal, source.dir));
      if (!isInside(rootReal, dirReal)) return [];
      names = (await readdir(dirReal)).sort();
    } catch (error) {
      if (!isMissing(error)) ok = false;
      return [];
    }
    return names.filter(source.matches).map((name) => path.join(dirReal, source.layout === 'skill-dirs' ? `${name}/SKILL.md` : name));
  };

  const describe = async (source: Source, candidate: string, seen: Set<string>): Promise<Found | null> => {
    let real: string;
    let head: string;
    try {
      real = await realpath(candidate);
      if (!isInside(rootReal, real) || seen.has(real)) return null;
      head = await readHead(real);
    } catch (error) {
      const notDirectory = (error as NodeJS.ErrnoException).code === 'ENOTDIR' && source.layout === 'skill-dirs';
      if (!isMissing(error) && !notDirectory) ok = false;
      return null;
    }
    seen.add(real);
    const relative = path.relative(rootReal, real).split(path.sep).join('/');
    const nameForId = source.layout === 'skill-dirs' ? path.basename(path.dirname(candidate)) : path.basename(candidate);
    const frontmatter = parseFrontmatter(head);
    return {
      kind: source.kind,
      id: (source.kind === 'prompt' ? undefined : frontmatter.name) ?? source.idFromName(nameForId),
      description: (frontmatter.description ?? '').slice(0, MAX_DESCRIPTION),
      model: frontmatter.model ?? null,
      source: relative.startsWith('sdd/') ? 'sdd' : 'claude',
      path: relative,
    };
  };

  const seenByKind: Record<Kind, Set<string>> = { agent: new Set(), skill: new Set(), prompt: new Set() };
  const found: Found[] = [];
  for (const source of SOURCES) {
    for (const candidate of await candidatesOf(source)) {
      const entry = await describe(source, candidate, seenByKind[source.kind]);
      if (entry) found.push(entry);
    }
  }

  const firstById = (kind: Kind, validId: (id: string) => boolean): Found[] => {
    const byId = new Map<string, Found>();
    for (const entry of found) if (entry.kind === kind && validId(entry.id) && !byId.has(entry.id)) byId.set(entry.id, entry);
    return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, CAP_PER_KIND);
  };

  const agents = firstById('agent', (id) => AgentId.safeParse(id).success).map(
    ({ id, description, model, source, path: file }): AgentSummary => ({ id, description, model, source, path: file }),
  );
  const skillEntries = firstById('skill', (id) => CatalogId.safeParse(id).success);
  const skillIds = new Set(skillEntries.map((entry) => entry.id));
  const promptEntries = firstById('prompt', (id) => CatalogId.safeParse(id).success).filter((entry) => !skillIds.has(entry.id));
  const skills = [...skillEntries, ...promptEntries]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(({ id, kind, description, source, path: file }): SkillSummary => ({ id, kind: kind === 'skill' ? 'skill' : 'prompt', description, source, path: file }));
  return { ok, agents, skills };
}
