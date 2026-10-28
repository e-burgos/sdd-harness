import type { KitEntry, SkillSummary, AgentSummary, WorkspaceSnapshot } from '@sdd-studio/protocol';

export const DOC_FILES = [
  { id: 'readme', file: 'README.md' },
  { id: 'how-to', file: 'HOW-TO-USE-SDD.md' },
  { id: 'install', file: 'INSTALL.md' },
] as const;

export type KitDocId = (typeof DOC_FILES)[number]['id'];
export type CapabilityKind = 'skills' | 'prompts' | 'agents';
export type MemoryKind = 'lessons' | 'journal';

export type KitView =
  | { kind: 'capabilities'; which: CapabilityKind }
  | { kind: 'tools' }
  | { kind: 'doc'; doc: KitDocId }
  | { kind: 'schemas' }
  | { kind: 'context' }
  | { kind: 'memory'; which: MemoryKind };

export const KIT_TOOLS_SELECTION = 'tools';

export const kitSelectionOf = (view: KitView): string => {
  switch (view.kind) {
    case 'capabilities':
      return view.which;
    case 'tools':
      return KIT_TOOLS_SELECTION;
    case 'doc':
      return `doc:${view.doc}`;
    case 'schemas':
      return 'schemas';
    case 'context':
      return 'context';
    case 'memory':
      return `memory:${view.which}`;
  }
};

export function parseKitSelection(value: string | null): KitView | null {
  if (value === null) return null;
  if (value === 'skills' || value === 'prompts' || value === 'agents') return { kind: 'capabilities', which: value };
  if (value === KIT_TOOLS_SELECTION) return { kind: 'tools' };
  if (value === 'schemas') return { kind: 'schemas' };
  if (value === 'context') return { kind: 'context' };
  if (value === 'memory:lessons' || value === 'memory:journal') return { kind: 'memory', which: value.slice('memory:'.length) as MemoryKind };
  if (value.startsWith('doc:')) {
    const doc = DOC_FILES.find((candidate) => candidate.id === value.slice('doc:'.length));
    return doc ? { kind: 'doc', doc: doc.id } : null;
  }
  return null;
}

export const fileNameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

export const entriesOf = (entries: readonly KitEntry[], section: string, role?: string): KitEntry[] =>
  entries.filter((entry) => entry.section === section && (role === undefined || entry.role === role));

export const docPathFallback = (lang: string, doc: KitDocId): string => `sdd/documentation/${lang}/${DOC_FILES.find((d) => d.id === doc)?.file ?? ''}`;

export interface ResolvedDoc {
  path: string;
  language: string;
  fallback: boolean;
}

export function resolveDoc(entries: readonly KitEntry[] | null, doc: KitDocId, lang: string): ResolvedDoc | null {
  if (entries === null) return { path: docPathFallback(lang, doc), language: lang, fallback: false };
  const file = DOC_FILES.find((candidate) => candidate.id === doc)?.file;
  const docs = entriesOf(entries, 'docs', 'doc').filter((entry) => fileNameOf(entry.path) === file);
  const preferred = docs.find((entry) => entry.group === lang);
  if (preferred) return { path: preferred.path, language: lang, fallback: false };
  const other = docs[0];
  return other ? { path: other.path, language: other.group ?? '', fallback: true } : null;
}

export const contextEntries = (entries: readonly KitEntry[]): KitEntry[] =>
  entriesOf(entries, 'context')
    .slice()
    .sort((a, b) => scopeRank(a) - scopeRank(b) || (a.group ?? '').localeCompare(b.group ?? '') || roleRank(a) - roleRank(b) || a.path.localeCompare(b.path));

const scopeRank = (entry: KitEntry): number => (entry.group === 'global' ? 0 : 1);
const roleRank = (entry: KitEntry): number => (entry.role === 'base' ? 0 : 1);

export const journalEntries = (entries: readonly KitEntry[]): KitEntry[] =>
  entriesOf(entries, 'memory', 'journal')
    .slice()
    .sort((a, b) => b.path.localeCompare(a.path));

export const contextScopeCount = (entries: readonly KitEntry[]): number => new Set(entriesOf(entries, 'context').map((entry) => entry.group)).size;

export function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export const kitSkills = (snapshot: WorkspaceSnapshot | null, kind: 'skill' | 'prompt'): SkillSummary[] =>
  (snapshot?.skills ?? []).filter((skill) => skill.kind === kind && skill.source === 'sdd').sort((a, b) => a.id.localeCompare(b.id));

export const kitAgents = (snapshot: WorkspaceSnapshot | null): AgentSummary[] =>
  (snapshot?.agents ?? []).filter((agent) => agent.source === 'sdd').sort((a, b) => a.id.localeCompare(b.id));

export function kitSearchTerms(view: KitView, snapshot: WorkspaceSnapshot | null, entries: readonly KitEntry[] | null): string[] {
  const names = (list: readonly KitEntry[]): string[] => list.map((entry) => fileNameOf(entry.path));
  switch (view.kind) {
    case 'capabilities':
      return view.which === 'agents'
        ? kitAgents(snapshot).flatMap((agent) => [agent.id, agent.description])
        : kitSkills(snapshot, view.which === 'skills' ? 'skill' : 'prompt').flatMap((skill) => [skill.id, skill.description]);
    case 'schemas':
      return entries ? names(entriesOf(entries, 'schemas')) : [];
    case 'context':
      return entries ? names(contextEntries(entries)) : [];
    case 'memory':
      return view.which === 'journal' && entries ? names(journalEntries(entries)) : [];
    case 'doc':
      return [DOC_FILES.find((candidate) => candidate.id === view.doc)?.file ?? ''];
    case 'tools':
      return [];
  }
}
