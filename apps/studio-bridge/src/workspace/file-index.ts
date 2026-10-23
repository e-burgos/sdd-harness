import { execFile } from 'node:child_process';
import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { FileSearchResult } from '@sdd-studio/protocol';

export interface FileIndex {
  search(query: string, limit: number): Promise<FileSearchResult>;
}

export class FileIndexError extends Error {
  readonly code = 'internal';
}

interface Listing {
  files: string[];
  source: 'git' | 'walk';
}

export interface FileIndexOptions {
  ttlMs?: number;
  now?: () => number;
  listGit?: (root: string) => Promise<string[] | null>;
}

const GIT_MAX_ENTRIES = 100_000;
const WALK_MAX_ENTRIES = 50_000;
const WALK_MAX_DEPTH = 12;
const MAX_PATH_LENGTH = 1024;
const EXCLUDED_SEGMENTS = new Set(['.git', 'node_modules', '.sdd-studio', '.nx', '.next', 'dist', 'coverage']);
const EXCLUDED_PREFIXES = ['.claude/worktrees/'];
const ENV_ALLOWED = new Set(['.env.example', '.env.sample', '.env.template']);
const SECRET_SUFFIXES = ['.pem', '.key', '.p12', '.pfx', '.keystore'];
const SECRET_PREFIXES = ['id_rsa', 'id_ed25519'];
const SECRET_NAMES = new Set(['.npmrc', '.netrc']);

const basenameOf = (file: string): string => file.slice(file.lastIndexOf('/') + 1);

function isSecret(file: string): boolean {
  const name = basenameOf(file).toLowerCase();
  if (/^\.env(\..+)?$/.test(name)) return !ENV_ALLOWED.has(name);
  return SECRET_NAMES.has(name) || SECRET_SUFFIXES.some((s) => name.endsWith(s)) || SECRET_PREFIXES.some((p) => name.startsWith(p));
}

function isSafeRelativePath(file: string): boolean {
  if (file.length === 0 || file.length > MAX_PATH_LENGTH) return false;
  if (file.includes('\0') || file.includes('\\') || file.startsWith('/')) return false;
  return file.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function isExcluded(file: string): boolean {
  if (EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix))) return true;
  return file.split('/').some((segment) => EXCLUDED_SEGMENTS.has(segment));
}

export const isIndexable = (file: string): boolean => isSafeRelativePath(file) && !isExcluded(file) && !isSecret(file);

function runGitListing(root: string): Promise<string[] | null> {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { timeout: 5000, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' },
      (error, stdout) => {
        if (error) return resolve(null);
        resolve(stdout.split('\0').filter((entry) => entry.length > 0).slice(0, GIT_MAX_ENTRIES));
      },
    );
  });
}

async function walkListing(root: string): Promise<string[]> {
  const files: string[] = [];
  let level = [''];
  for (let depth = 0; depth <= WALK_MAX_DEPTH && level.length > 0; depth++) {
    const next: string[] = [];
    for (const dir of level) {
      const entries = await readdir(path.join(root, dir), { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const relative = dir === '' ? entry.name : `${dir}/${entry.name}`;
        if (!isSafeRelativePath(relative) || isExcluded(relative)) continue;
        if (entry.isDirectory()) next.push(relative);
        else if (files.push(relative) >= WALK_MAX_ENTRIES) return files;
      }
    }
    level = next;
  }
  return files;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let at = 0;
  for (const char of haystack) if (char === needle[at] && ++at === needle.length) return true;
  return needle.length === 0;
}

function tierOf(file: string, query: string): number {
  const lower = file.toLowerCase();
  const base = basenameOf(lower);
  if (base.startsWith(query)) return 0;
  if (base.includes(query)) return 1;
  if (lower.includes(query)) return 2;
  return isSubsequence(query, lower) ? 3 : -1;
}

function rank(files: string[], query: string): string[] {
  return files
    .flatMap((file) => {
      const tier = tierOf(file, query);
      return tier < 0 ? [] : [{ file, tier }];
    })
    .sort((a, b) => a.tier - b.tier || a.file.length - b.file.length || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
    .map(({ file }) => file);
}

export function createFileIndex(root: string, opts: FileIndexOptions = {}): FileIndex {
  const ttlMs = opts.ttlMs ?? 15_000;
  const now = opts.now ?? Date.now;
  const listGit = opts.listGit ?? runGitListing;
  let cached: { at: number; listing: Promise<Listing> } | null = null;
  let rootReal: Promise<string> | null = null;

  const buildListing = async (): Promise<Listing> => {
    const git = await listGit(root);
    if (git) return { files: git.filter(isIndexable), source: 'git' };
    return { files: (await walkListing(root)).filter(isIndexable), source: 'walk' };
  };

  const listing = (): Promise<Listing> => {
    if (cached && now() - cached.at < ttlMs) return cached.listing;
    const fresh = buildListing();
    const entry = { at: now(), listing: fresh };
    cached = entry;
    fresh.catch(() => {
      if (cached === entry) cached = null;
    });
    return fresh;
  };

  const staysInsideRoot = async (file: string): Promise<boolean> => {
    rootReal ??= realpath(root);
    try {
      const base = await rootReal;
      const real = await realpath(path.join(base, file));
      if (!real.startsWith(base + path.sep)) return false;
      return (await stat(real)).isFile();
    } catch {
      return false;
    }
  };

  return {
    async search(query, limit) {
      const needle = query.trim().toLowerCase();
      let index: Listing;
      try {
        index = await listing();
      } catch {
        throw new FileIndexError('file index unavailable');
      }
      if (needle.length === 0) return { query, files: [], truncated: false, source: index.source };
      const ranked = rank(index.files, needle);
      const files: { path: string }[] = [];
      let at = 0;
      for (; at < ranked.length && files.length < limit; at++) {
        const candidate = ranked[at] as string;
        if (await staysInsideRoot(candidate)) files.push({ path: candidate });
      }
      return { query, files, truncated: at < ranked.length, source: index.source };
    },
  };
}
