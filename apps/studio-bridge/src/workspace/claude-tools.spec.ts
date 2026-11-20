import { mkdtemp, readFile, readdir, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CLAUDE_TOOLS_CONFIG, type ClaudeToolsConfig } from '@sdd-studio/protocol';
import { readClaudeTools, setClaudeTools } from './claude-tools';

let root: string;
const file = () => path.join(root, '.sdd-studio', 'claude-tools.json');
const custom: ClaudeToolsConfig = {
  sources: { user: true, local: false },
  disabledPlugins: ['a@market'],
  disabledMcpServers: ['github'],
  browser: { enabled: true, browserUrl: 'http://127.0.0.1:9222' },
};

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'claude-tools-'));
});
afterEach(() => rm(root, { recursive: true, force: true }));

describe('claude tools store', () => {
  it('returns defaults and a stable revision without a file', async () => {
    const first = await readClaudeTools(root);
    expect(first.config).toEqual(DEFAULT_CLAUDE_TOOLS_CONFIG);
    expect(first.revision).toMatch(/^[a-f0-9]{16}$/);
    expect((await readClaudeTools(root)).revision).toBe(first.revision);
  });

  it('round-trips a config and creates the directory', async () => {
    const { revision } = await readClaudeTools(root);
    const result = await setClaudeTools(root, custom, revision);
    expect(result.changed).toBe(true);
    expect(await readClaudeTools(root)).toEqual({ config: custom, revision: result.revision });
    expect(await readdir(path.join(root, '.sdd-studio'))).toEqual(['claude-tools.json']);
  });

  it('reports changed false when nothing differs', async () => {
    const { revision } = await readClaudeTools(root);
    const result = await setClaudeTools(root, DEFAULT_CLAUDE_TOOLS_CONFIG, revision);
    expect(result).toEqual({ config: DEFAULT_CLAUDE_TOOLS_CONFIG, revision, changed: false });
    await expect(readFile(file())).rejects.toThrow();
  });

  it('rejects a stale revision with conflict', async () => {
    const { revision } = await readClaudeTools(root);
    await setClaudeTools(root, custom, revision);
    await expect(setClaudeTools(root, DEFAULT_CLAUDE_TOOLS_CONFIG, revision)).rejects.toMatchObject({ code: 'conflict' });
  });

  it('rejects an invalid config with bad-request', async () => {
    const { revision } = await readClaudeTools(root);
    await expect(setClaudeTools(root, { sources: {} }, revision)).rejects.toMatchObject({ code: 'bad-request' });
  });

  it('falls back to defaults on a corrupt file and overwrites it only with the right revision', async () => {
    await mkdir(path.join(root, '.sdd-studio'));
    await writeFile(file(), '{not json', 'utf8');
    const state = await readClaudeTools(root);
    expect(state.config).toEqual(DEFAULT_CLAUDE_TOOLS_CONFIG);
    await expect(setClaudeTools(root, custom, 'ffffffffffffffff')).rejects.toMatchObject({ code: 'conflict' });
    const result = await setClaudeTools(root, custom, state.revision);
    expect(result.changed).toBe(true);
    expect((await readClaudeTools(root)).config).toEqual(custom);
  });

  it('serializes concurrent writes so only one wins the revision', async () => {
    const { revision } = await readClaudeTools(root);
    const results = await Promise.allSettled([setClaudeTools(root, custom, revision), setClaudeTools(root, custom, revision)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
