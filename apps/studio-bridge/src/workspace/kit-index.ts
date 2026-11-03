import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { KIT_SECTIONS, MAX_KIT_ENTRIES, type KitEntry, type KitIndex } from '@sdd-studio/protocol';

export const KIT_RESCAN_INTERVAL_MS = 30_000;
export const KIT_DEBOUNCE_MS = 200;

const MAX_KIT_PATH_LENGTH = 512;
const MAX_KIT_GROUP_LENGTH = 128;
const CONTEXT_FILES = ['constitution.md', 'context_prompt.md'];
const CONTEXT_SUBPROJECT_KINDS = ['apps', 'libs', 'tools'];
const REGISTRY_FILES = ['schema.json', 'api.json', 'components.json'];
const DOC_LANGUAGES = ['es', 'en'];

export const KIT_WATCH_ROOTS = [
  'documentation',
  'schemas',
  'context',
  'memory',
  'schema.json',
  'api.json',
  'components.json',
];

type Candidate = Pick<KitEntry, 'section' | 'role' | 'group'> & { absolute: string; relative: string };

const toPosix = (value: string): string => value.split(path.sep).join('/');

async function listFiles(directory: string, extension: string): Promise<string[]> {
  try {
    const dirents = await readdir(directory, { withFileTypes: true });
    return dirents
      .filter((dirent) => dirent.isFile() && !dirent.name.startsWith('.') && dirent.name.endsWith(extension))
      .map((dirent) => dirent.name)
      .sort();
  } catch {
    return [];
  }
}

async function listDirectories(directory: string): Promise<string[]> {
  try {
    const dirents = await readdir(directory, { withFileTypes: true });
    return dirents
      .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('.'))
      .map((dirent) => dirent.name)
      .sort();
  } catch {
    return [];
  }
}

async function isRegularFile(absolute: string): Promise<boolean> {
  try {
    return (await stat(absolute)).isFile();
  } catch {
    return false;
  }
}

async function collectContextScope(
  sddDir: string,
  scopeRelative: string,
  group: string,
  out: Candidate[],
): Promise<void> {
  const scopeAbsolute = path.join(sddDir, scopeRelative);
  for (const name of CONTEXT_FILES) {
    const absolute = path.join(scopeAbsolute, name);
    if (await isRegularFile(absolute)) {
      out.push({
        section: 'context',
        role: 'base',
        group,
        absolute,
        relative: toPosix(path.join('sdd', scopeRelative, name)),
      });
    }
  }
  for (const name of await listFiles(path.join(scopeAbsolute, 'updates'), '.md')) {
    out.push({
      section: 'context',
      role: 'update',
      group,
      absolute: path.join(scopeAbsolute, 'updates', name),
      relative: toPosix(path.join('sdd', scopeRelative, 'updates', name)),
    });
  }
}

async function collectCandidates(root: string): Promise<Candidate[]> {
  const sddDir = path.join(root, 'sdd');
  const out: Candidate[] = [];

  for (const language of DOC_LANGUAGES) {
    for (const name of await listFiles(path.join(sddDir, 'documentation', language), '.md')) {
      out.push({
        section: 'docs',
        role: 'doc',
        group: language,
        absolute: path.join(sddDir, 'documentation', language, name),
        relative: `sdd/documentation/${language}/${name}`,
      });
    }
  }

  for (const name of await listFiles(path.join(sddDir, 'schemas'), '.json')) {
    out.push({
      section: 'schemas',
      role: 'schema',
      group: null,
      absolute: path.join(sddDir, 'schemas', name),
      relative: `sdd/schemas/${name}`,
    });
  }

  await collectContextScope(sddDir, 'context', 'global', out);
  for (const kind of CONTEXT_SUBPROJECT_KINDS) {
    for (const name of await listDirectories(path.join(sddDir, 'context', kind))) {
      await collectContextScope(sddDir, `context/${kind}/${name}`, `${kind}/${name}`, out);
    }
  }

  const lessons = path.join(sddDir, 'memory', 'lessons.md');
  if (await isRegularFile(lessons)) {
    out.push({
      section: 'memory',
      role: 'lessons',
      group: null,
      absolute: lessons,
      relative: 'sdd/memory/lessons.md',
    });
  }
  for (const name of await listFiles(path.join(sddDir, 'memory', 'journal'), '.md')) {
    out.push({
      section: 'memory',
      role: 'journal',
      group: null,
      absolute: path.join(sddDir, 'memory', 'journal', name),
      relative: `sdd/memory/journal/${name}`,
    });
  }

  for (const name of REGISTRY_FILES) {
    const absolute = path.join(sddDir, name);
    if (await isRegularFile(absolute)) {
      out.push({ section: 'registries', role: 'registry', group: null, absolute, relative: `sdd/${name}` });
    }
  }

  return out.sort((a, b) => (a.relative < b.relative ? -1 : a.relative > b.relative ? 1 : 0));
}

const sha1 = (value: string): string => createHash('sha1').update(value).digest('hex');

export function fingerprintSections(
  entries: readonly KitEntry[],
  mtimesMs: ReadonlyMap<string, number>,
): Record<string, string> {
  const fingerprints: Record<string, string> = {};
  for (const section of KIT_SECTIONS) {
    const lines = entries
      .filter((entry) => entry.section === section)
      .map((entry) => `${entry.path}:${mtimesMs.get(entry.path) ?? 0}:${entry.size}`)
      .sort();
    fingerprints[section] = sha1(lines.join('\n'));
  }
  return fingerprints;
}

export interface KitSnapshot {
  index: KitIndex;
  fingerprints: Record<string, string>;
}

export async function buildKitIndex(root: string): Promise<KitSnapshot> {
  const candidates = await collectCandidates(root);
  const entries: KitEntry[] = [];
  const mtimesMs = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.relative.length > MAX_KIT_PATH_LENGTH || (candidate.group?.length ?? 0) > MAX_KIT_GROUP_LENGTH) continue;
    try {
      const info = await stat(candidate.absolute);
      if (!info.isFile()) continue;
      mtimesMs.set(candidate.relative, info.mtimeMs);
      entries.push({
        section: candidate.section,
        role: candidate.role,
        group: candidate.group,
        path: candidate.relative,
        size: info.size,
        mtime: info.mtime.toISOString(),
      });
    } catch {
      continue;
    }
  }
  const fingerprints = fingerprintSections(entries, mtimesMs);
  const revision = sha1(KIT_SECTIONS.map((section) => `${section}=${fingerprints[section]}`).join('\n'));
  const truncated = entries.length > MAX_KIT_ENTRIES;
  return {
    index: { revision, entries: truncated ? entries.slice(0, MAX_KIT_ENTRIES) : entries, truncated },
    fingerprints,
  };
}

export function changedKitSections(
  previous: Record<string, string>,
  next: Record<string, string>,
): string[] {
  return KIT_SECTIONS.filter((section) => previous[section] !== next[section]);
}

export function isKitPath(root: string, candidate: string): boolean {
  const relative = path.relative(path.join(root, 'sdd'), candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
  const first = relative.split(path.sep)[0] ?? '';
  return KIT_WATCH_ROOTS.includes(first);
}

export interface KitIndexerOptions {
  root: string;
  onChanged: (change: { sections: string[]; revision: string }) => void;
  rescanMs?: number;
  debounceMs?: number;
}

export class KitIndexer {
  private readonly root: string;
  private readonly onChanged: KitIndexerOptions['onChanged'];
  private readonly rescanMs: number;
  private readonly debounceMs: number;
  private snapshot: KitSnapshot | null = null;
  private arming: Promise<KitSnapshot> | null = null;
  private rescanTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private recomputing: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(options: KitIndexerOptions) {
    this.root = options.root;
    this.onChanged = options.onChanged;
    this.rescanMs = options.rescanMs ?? KIT_RESCAN_INTERVAL_MS;
    this.debounceMs = options.debounceMs ?? KIT_DEBOUNCE_MS;
  }

  isArmed(): boolean {
    return this.snapshot !== null;
  }

  async index(): Promise<KitIndex> {
    if (this.snapshot) return this.snapshot.index;
    if (!this.arming) {
      this.arming = buildKitIndex(this.root).then((built) => {
        this.snapshot = built;
        this.startRescanning();
        return built;
      });
    }
    return (await this.arming).index;
  }

  notifyPath(candidate: string): void {
    if (this.closed || !this.snapshot || !isKitPath(this.root, candidate)) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.recompute();
    }, this.debounceMs);
  }

  recompute(): Promise<void> {
    this.recomputing = this.recomputing.then(() => this.recomputeNow());
    return this.recomputing;
  }

  close(): void {
    this.closed = true;
    if (this.rescanTimer) clearInterval(this.rescanTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.rescanTimer = null;
    this.debounceTimer = null;
  }

  private startRescanning(): void {
    if (this.closed || this.rescanTimer) return;
    this.rescanTimer = setInterval(() => void this.recompute(), this.rescanMs);
    this.rescanTimer.unref?.();
  }

  private async recomputeNow(): Promise<void> {
    const previous = this.snapshot;
    if (this.closed || !previous) return;
    let next: KitSnapshot;
    try {
      next = await buildKitIndex(this.root);
    } catch {
      return;
    }
    if (this.closed) return;
    this.snapshot = next;
    const sections = changedKitSections(previous.fingerprints, next.fingerprints);
    if (sections.length > 0) this.onChanged({ sections, revision: next.index.revision });
  }
}
