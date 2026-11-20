import { mkdtemp, readFile, readdir, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CLAUDE_TOOLS_CONFIG, type ClaudeToolsConfig } from '@sdd-studio/protocol';
import { cachedClaudeTools, readClaudeTools, setClaudeTools, useGlobalClaudeTools } from './claude-tools';

let root: string;
let home: string;
const globalFile = () => path.join(home, '.sdd-studio', 'claude-tools.json');
const file = () => path.join(root, '.sdd-studio', 'claude-tools.json');
const custom: ClaudeToolsConfig = {
  sources: { user: true, local: false },
  disabledPlugins: ['a@market'],
  disabledMcpServers: ['github'],
  browser: { enabled: true, browserUrl: 'http://127.0.0.1:9222' },
};

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'claude-tools-'));
  home = await mkdtemp(path.join(tmpdir(), 'claude-home-'));
  process.env.SDD_STUDIO_HOME = home;
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
});

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
    expect(await readClaudeTools(root)).toEqual({ config: custom, revision: result.revision, scope: 'global', hasProjectOverride: false });
    expect(await readdir(path.join(home, '.sdd-studio'))).toEqual(['claude-tools.json']);
    await expect(readdir(path.join(root, '.sdd-studio'))).rejects.toThrow();
  });

  it('reports changed false when nothing differs', async () => {
    const { revision } = await readClaudeTools(root);
    const result = await setClaudeTools(root, DEFAULT_CLAUDE_TOOLS_CONFIG, revision);
    expect(result).toEqual({ config: DEFAULT_CLAUDE_TOOLS_CONFIG, revision, scope: 'global', hasProjectOverride: false, changed: false });
    await expect(readFile(file())).rejects.toThrow();
    await expect(readFile(globalFile())).rejects.toThrow();
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

  describe('global scope', () => {
    const other: ClaudeToolsConfig = { ...custom, disabledMcpServers: ['other'] };
    const writeGlobal = async (config: ClaudeToolsConfig) => {
      await mkdir(path.dirname(globalFile()), { recursive: true });
      await writeFile(globalFile(), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    };
    const writeProject = async (config: ClaudeToolsConfig) => {
      await mkdir(path.dirname(file()), { recursive: true });
      await writeFile(file(), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    };

    it('inherits the global config when the project has no file', async () => {
      await writeGlobal(custom);
      const state = await readClaudeTools(root);
      expect(state).toMatchObject({ config: custom, scope: 'global', hasProjectOverride: false });
      expect(cachedClaudeTools(root)).toEqual(custom);
    });

    it('lets the project override win', async () => {
      await writeGlobal(custom);
      await writeProject(other);
      expect(await readClaudeTools(root)).toMatchObject({ config: other, scope: 'project', hasProjectOverride: true });
    });

    it('writes the global file on set without scope when there is no override', async () => {
      const { revision } = await readClaudeTools(root);
      await setClaudeTools(root, custom, revision);
      expect(JSON.parse(await readFile(globalFile(), 'utf8'))).toEqual(custom);
    });

    it('writes the override on set without scope when one exists', async () => {
      await writeGlobal(custom);
      await writeProject(other);
      const { revision } = await readClaudeTools(root);
      const result = await setClaudeTools(root, DEFAULT_CLAUDE_TOOLS_CONFIG, revision);
      expect(result).toMatchObject({ scope: 'project', changed: true });
      expect(JSON.parse(await readFile(globalFile(), 'utf8'))).toEqual(custom);
      expect(JSON.parse(await readFile(file(), 'utf8'))).toEqual(DEFAULT_CLAUDE_TOOLS_CONFIG);
    });

    it('creates the override with scope project', async () => {
      await writeGlobal(custom);
      const { revision } = await readClaudeTools(root);
      const result = await setClaudeTools(root, custom, revision, 'project');
      expect(result).toMatchObject({ scope: 'project', hasProjectOverride: true, changed: true });
      expect(JSON.parse(await readFile(file(), 'utf8'))).toEqual(custom);
    });

    it('writes the global with scope global and leaves the override alone', async () => {
      await writeProject(other);
      const { revision } = await readClaudeTools(root);
      const result = await setClaudeTools(root, custom, revision, 'global');
      expect(result).toMatchObject({ config: other, scope: 'project', hasProjectOverride: true, changed: true });
      expect(JSON.parse(await readFile(globalFile(), 'utf8'))).toEqual(custom);
      expect(JSON.parse(await readFile(file(), 'utf8'))).toEqual(other);
    });

    it('useGlobal removes the override and returns the global config', async () => {
      await writeGlobal(custom);
      await writeProject(other);
      const { revision } = await readClaudeTools(root);
      const result = await useGlobalClaudeTools(root, revision);
      expect(result).toMatchObject({ config: custom, scope: 'global', hasProjectOverride: false, changed: true });
      await expect(readFile(file())).rejects.toThrow();
      expect(cachedClaudeTools(root)).toEqual(custom);
      expect(await useGlobalClaudeTools(root, result.revision)).toMatchObject({ changed: false, scope: 'global' });
    });

    it('reports conflict when the scope changed under the client', async () => {
      await writeGlobal(custom);
      const stale = (await readClaudeTools(root)).revision;
      await writeProject(custom);
      await expect(setClaudeTools(root, other, stale)).rejects.toMatchObject({ code: 'conflict' });
      await expect(useGlobalClaudeTools(root, stale)).rejects.toMatchObject({ code: 'conflict' });
    });

    it('gives the same bytes a different revision per scope', async () => {
      await writeGlobal(custom);
      const inherited = (await readClaudeTools(root)).revision;
      await writeProject(custom);
      expect((await readClaudeTools(root)).revision).not.toBe(inherited);
    });

    it('refreshes the cache of every cached root after a global change', async () => {
      const second = await mkdtemp(path.join(tmpdir(), 'claude-tools-b-'));
      try {
        const { revision } = await readClaudeTools(root);
        await readClaudeTools(second);
        await setClaudeTools(root, custom, revision);
        expect(cachedClaudeTools(second)).toEqual(custom);
      } finally {
        await rm(second, { recursive: true, force: true });
      }
    });
  });
});
