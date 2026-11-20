import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ClaudeToolsConfig, DEFAULT_CLAUDE_TOOLS_CONFIG } from '@sdd-studio/protocol';
import { computeToolsRevision, KitToolsError } from './kit-tools';

export interface ClaudeToolsState {
  config: ClaudeToolsConfig;
  revision: string;
}

export interface ClaudeToolsSetOutcome extends ClaudeToolsState {
  changed: boolean;
}

const FS_PERMISSION_CODES = new Set(['EACCES', 'EPERM', 'EROFS']);

const studioDir = (root: string) => path.join(root, '.sdd-studio');
const configFile = (root: string) => path.join(studioDir(root), 'claude-tools.json');
const serialize = (config: ClaudeToolsConfig) => `${JSON.stringify(config, null, 2)}\n`;

const cache = new Map<string, ClaudeToolsConfig>();

export const cachedClaudeTools = (root: string): ClaudeToolsConfig => cache.get(root) ?? DEFAULT_CLAUDE_TOOLS_CONFIG;

const DEFAULT_BYTES = serialize(DEFAULT_CLAUDE_TOOLS_CONFIG);

async function readBytes(root: string): Promise<string> {
  try {
    return await readFile(configFile(root), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULT_BYTES;
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

export async function readClaudeTools(root: string): Promise<ClaudeToolsState> {
  const raw = await readBytes(root);
  const config = parseConfig(raw);
  cache.set(root, config);
  return { config, revision: computeToolsRevision(raw) };
}

async function writeAtomically(root: string, content: string): Promise<void> {
  const file = configFile(root);
  const temp = `${file}.${process.pid}.tmp`;
  try {
    await mkdir(studioDir(root), { recursive: true });
    await writeFile(temp, content, 'utf8');
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => undefined);
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown';
    throw new KitToolsError('internal', FS_PERMISSION_CODES.has(code) ? `cannot write claude-tools.json (${code})` : `write failed (${code})`);
  }
}

async function runSet(root: string, input: unknown, expectedRevision: string): Promise<ClaudeToolsSetOutcome> {
  const parsed = ClaudeToolsConfig.safeParse(input);
  if (!parsed.success) throw new KitToolsError('bad-request', 'claude tools config is invalid');
  const raw = await readBytes(root);
  const revision = computeToolsRevision(raw);
  if (revision !== expectedRevision) {
    throw new KitToolsError('conflict', 'claude-tools.json changed since it was read; refresh and try again');
  }
  const content = serialize(parsed.data);
  if (content === raw) return { config: parsed.data, revision, changed: false };
  await writeAtomically(root, content);
  cache.set(root, parsed.data);
  return { config: parsed.data, revision: computeToolsRevision(content), changed: true };
}

let queue: Promise<unknown> = Promise.resolve();

export function setClaudeTools(root: string, config: unknown, expectedRevision: string): Promise<ClaudeToolsSetOutcome> {
  const run = queue.then(() => runSet(root, config, expectedRevision));
  queue = run.catch(() => undefined);
  return run;
}
