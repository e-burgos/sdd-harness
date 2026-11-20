import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { ClaudeToolsConfig, DEFAULT_CLAUDE_TOOLS_CONFIG, type ClaudeToolsScope } from '@sdd-studio/protocol';
import { computeToolsRevision, KitToolsError } from './kit-tools';

export interface ClaudeToolsState {
  config: ClaudeToolsConfig;
  revision: string;
  scope: ClaudeToolsScope;
  hasProjectOverride: boolean;
}

export interface ClaudeToolsSetOutcome extends ClaudeToolsState {
  changed: boolean;
}

const FS_PERMISSION_CODES = new Set(['EACCES', 'EPERM', 'EROFS']);

const studioDir = (base: string) => path.join(base, '.sdd-studio');
const projectFile = (root: string) => path.join(studioDir(root), 'claude-tools.json');
const globalFile = () => path.join(studioDir(process.env.SDD_STUDIO_HOME || homedir()), 'claude-tools.json');
const serialize = (config: ClaudeToolsConfig) => `${JSON.stringify(config, null, 2)}\n`;
const DEFAULT_BYTES = serialize(DEFAULT_CLAUDE_TOOLS_CONFIG);

const cache = new Map<string, ClaudeToolsConfig>();

export const cachedClaudeTools = (root: string): ClaudeToolsConfig => cache.get(root) ?? DEFAULT_CLAUDE_TOOLS_CONFIG;

async function readOptional(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown';
    throw new KitToolsError('internal', `cannot read claude-tools.json (${code})`);
  }
}

function parseConfig(raw: string): ClaudeToolsConfig {
  try {
    const parsed = ClaudeToolsConfig.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_CLAUDE_TOOLS_CONFIG;
  } catch {
    return DEFAULT_CLAUDE_TOOLS_CONFIG;
  }
}

interface Located {
  state: ClaudeToolsState;
  projectRaw: string | null;
  globalRaw: string | null;
}

async function locate(root: string): Promise<Located> {
  const [projectRaw, globalRaw] = await Promise.all([readOptional(projectFile(root)), readOptional(globalFile())]);
  const scope: ClaudeToolsScope = projectRaw !== null ? 'project' : 'global';
  const raw = projectRaw ?? globalRaw ?? DEFAULT_BYTES;
  const state: ClaudeToolsState = {
    config: parseConfig(raw),
    revision: computeToolsRevision(`${scope}\n${raw}`),
    scope,
    hasProjectOverride: projectRaw !== null,
  };
  return { state, projectRaw, globalRaw };
}

async function refreshCaches(): Promise<void> {
  await Promise.all(
    [...cache.keys()].map(async (root) => {
      const { state } = await locate(root).catch(() => ({ state: null }));
      if (state) cache.set(root, state.config);
    }),
  );
}

export async function readClaudeTools(root: string): Promise<ClaudeToolsState> {
  const { state } = await locate(root);
  cache.set(root, state.config);
  return state;
}

async function writeAtomically(file: string, content: string): Promise<void> {
  const temp = `${file}.${process.pid}.tmp`;
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(temp, content, 'utf8');
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => undefined);
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown';
    throw new KitToolsError('internal', FS_PERMISSION_CODES.has(code) ? `cannot write claude-tools.json (${code})` : `write failed (${code})`);
  }
}

const staleRevision = () => new KitToolsError('conflict', 'claude-tools.json changed since it was read; refresh and try again');

async function runSet(root: string, input: unknown, expectedRevision: string, requested?: ClaudeToolsScope): Promise<ClaudeToolsSetOutcome> {
  const parsed = ClaudeToolsConfig.safeParse(input);
  if (!parsed.success) throw new KitToolsError('bad-request', 'claude tools config is invalid');
  const located = await locate(root);
  if (located.state.revision !== expectedRevision) throw staleRevision();
  const target = requested ?? located.state.scope;
  const content = serialize(parsed.data);
  const current = target === 'project' ? located.projectRaw : located.globalRaw;
  const unchanged = target === 'project' ? current === content : (current ?? DEFAULT_BYTES) === content;
  if (unchanged) return { ...located.state, changed: false };
  await writeAtomically(target === 'project' ? projectFile(root) : globalFile(), content);
  cache.set(root, parsed.data);
  await refreshCaches();
  const { state } = await locate(root);
  return { ...state, changed: true };
}

async function runUseGlobal(root: string, expectedRevision: string): Promise<ClaudeToolsSetOutcome> {
  const located = await locate(root);
  if (located.state.revision !== expectedRevision) throw staleRevision();
  if (!located.state.hasProjectOverride) return { ...located.state, changed: false };
  await rm(projectFile(root), { force: true });
  await refreshCaches();
  const { state } = await locate(root);
  cache.set(root, state.config);
  return { ...state, changed: true };
}

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.catch(() => undefined);
  return run;
}

export const setClaudeTools = (root: string, config: unknown, expectedRevision: string, scope?: ClaudeToolsScope) =>
  enqueue(() => runSet(root, config, expectedRevision, scope));

export const useGlobalClaudeTools = (root: string, expectedRevision: string) => enqueue(() => runUseGlobal(root, expectedRevision));
