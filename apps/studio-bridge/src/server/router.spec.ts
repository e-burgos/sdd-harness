import { AuthState } from '../auth-mode';
import { BRIDGE_FEATURES, decodeClientMessage, defaultThreadOptions, type ClientCommand, type KitPackStats, type RtkGain, type ServerEvent } from '@sdd-studio/protocol';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommandRunner } from '../commands/runner';
import { FakeEngine } from '../engine/fake-engine';
import { createFileIndex } from '../workspace/file-index';
import { KitIndexer } from '../workspace/kit-index';
import { computeToolsRevision } from '../workspace/kit-tools';
import { createAttachmentStore } from '../sessions/attachment-store';
import { SessionManager } from '../sessions/session-manager';
import { PackStatsError } from '../workspace/pack-runner';
import { ThreadStore } from '../sessions/store';
import { copyFixture, waitFor } from '../test-utils/fixture';
import { loadWorkspaceSnapshot } from '../workspace/snapshot';
import type { ClaudeBrowserStatus } from '@sdd-studio/protocol';
import type { ChromeStatusService, OpenStudioChromeDeps } from '../workspace/chrome-status';
import type { ClaudeMcpService } from '../workspace/claude-mcp';
import type { ClaudeInventoryService } from '../workspace/claude-inventory';
import type { KitIntegrations } from '../workspace/kit-integrations';
import { createHandlers } from './router';

let root: string;
let cleanup: () => Promise<void>;
let home: string;
beforeEach(async () => {
  ({ root, cleanup } = await copyFixture());
  home = await mkdtemp(path.join(tmpdir(), 'router-home-'));
  process.env.SDD_STUDIO_HOME = home;
});
afterEach(async () => {
  await cleanup();
  await rm(home, { recursive: true, force: true });
});

async function handlers(
  broadcast: (e: ServerEvent) => void = () => {},
  refresh: () => Promise<unknown> = async () => null,
  extra: { claudeInventory?: ClaudeInventoryService; rtkGain?: (root: string) => Promise<RtkGain>; packStats?: (root: string, spec: string, cycle: string) => Promise<KitPackStats>; now?: () => Date; integrations?: KitIntegrations; chromeStatus?: ChromeStatusService; claudeMcp?: ClaudeMcpService; openSettings?: OpenStudioChromeDeps } = {},
  runner: CommandRunner = new CommandRunner(root, broadcast, () => 'run-1'),
) {
  const snapshot = (await loadWorkspaceSnapshot(root)).snapshot;
  const store = new ThreadStore(root);
  await store.init();
  const attachments = createAttachmentStore(root);
  await attachments.init();
  const sessions = new SessionManager({ root, engine: new FakeEngine(1), store, attachments, snapshot: () => snapshot, broadcast: () => {} });
  const auth = new AuthState({}, 'sdd-studio/test');
  const account = { state: 'disconnected', email: null, method: null, plan: null, loginUrl: null, error: null } as const;
  const login = { status: async () => account, login: async () => ({ ...account, state: 'pending' as const }), logout: async () => account };
  return createHandlers({
    root, auth, login, bridgeVersion: '0.1.0', sessions, store, attachments, fileIndex: createFileIndex(root),
    kitIndexer: new KitIndexer({ root, onChanged: () => undefined }), broadcast: (m) => broadcast(m as ServerEvent),
    chromeStatus: fakeChrome().service, claudeMcp: fakeMcp(), openSettings: { studio: { ensure: async () => ({ launched: true }) }, openTab: async () => true }, ...extra,
    watcher: { current: () => snapshot, refresh: async () => { await refresh(); return null; } }, runner,
  });
}
const cmd = (c: Record<string, unknown>): ClientCommand => {
  const parsed = decodeClientMessage(JSON.stringify({ kind: 'command', id: 'x', ...c }));
  if (!parsed.ok || parsed.value.kind !== 'command') throw new Error(`invalid command in test: ${JSON.stringify(c)}`);
  return parsed.value;
};

const fakeChrome = (state: ClaudeBrowserStatus['state'] = 'permission-pending') => {
  const listeners = new Set<(status: ClaudeBrowserStatus) => void>();
  let last: ClaudeBrowserStatus | null = null;
  const fake = {
    calls: 0,
    service: {
      current: () => last,
      check: async () => {
        fake.calls += 1;
        const next = { state, checkedAt: '2026-11-20T10:00:00.000Z', detail: null };
        const changed = last?.state !== next.state;
        last = next;
        if (changed) for (const listener of listeners) listener(next);
        return next;
      },
      subscribe: (listener: (status: ClaudeBrowserStatus) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    } satisfies ChromeStatusService,
  };
  return fake;
};

const fakeMcp = (): ClaudeMcpService => ({
  login: async (name) => ({ name, outcome: 'ok', output: 'done', inventory: null }),
  reconnect: async (name) => ({ name, status: 'connected', inventory: fakeInventory().current() as never }),
});

const fakeInventory = (over: Partial<ClaudeInventoryService> = {}): ClaudeInventoryService & { calls: number } => {
  const inventory = {
    capturedAt: '2026-11-20T10:00:00.000Z',
    plugins: [],
    mcpServers: [],
    counts: {
      project: { skills: 1, agents: 1, plugins: 0, mcpServers: 0, mcpTools: 0 },
      all: { skills: 5, agents: 2, plugins: 1, mcpServers: 1, mcpTools: 3 },
    },
  };
  const service = {
    calls: 0,
    current: () => null,
    load: async () => undefined,
    refresh: async () => {
      service.calls += 1;
      return inventory;
    },
    applyInit: () => undefined,
    ...over,
  };
  return service;
};

describe('claude tools commands', () => {
  const customConfig = { sources: { user: true, local: false }, disabledPlugins: [], disabledMcpServers: ['x'], browser: { enabled: true, browserUrl: null } };

  it('get returns defaults, a revision, no inventory and the browser mcp version', async () => {
    const h = await handlers(undefined, undefined, { claudeInventory: fakeInventory() });
    const result = (await h.handle(cmd({ cmd: 'claude.tools.get' }))) as { config: unknown; revision: string; inventory: unknown; browserMcpVersion: string };
    expect(result.inventory).toBeNull();
    expect(result.revision).toMatch(/^[a-f0-9]{16}$/);
    expect(result.browserMcpVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('set stores the config and announces claude-tools.changed once', async () => {
    const events: ServerEvent[] = [];
    const h = await handlers((e) => events.push(e), undefined, { claudeInventory: fakeInventory(), now: () => new Date('2026-11-20T10:00:00Z') });
    const { revision } = (await h.handle(cmd({ cmd: 'claude.tools.get' }))) as { revision: string };
    const result = (await h.handle(cmd({ cmd: 'claude.tools.set', config: customConfig, expectedRevision: revision }))) as { changed: boolean; revision: string };
    expect(result.changed).toBe(true);
    const bot = events.filter((e) => e.kind === 'bot.event');
    expect(bot).toHaveLength(1);
    expect(bot[0]).toMatchObject({ channelId: 'general', botKind: 'claude-tools.changed', payload: { changed: ['sources', 'mcp'] } });
    await h.handle(cmd({ cmd: 'claude.tools.set', config: customConfig, expectedRevision: result.revision }));
    expect(events.filter((e) => e.kind === 'bot.event')).toHaveLength(1);
  });

  it('get reports the effective scope', async () => {
    const h = await handlers(undefined, undefined, { claudeInventory: fakeInventory() });
    const result = (await h.handle(cmd({ cmd: 'claude.tools.get' }))) as { scope: string; hasProjectOverride: boolean };
    expect(result).toMatchObject({ scope: 'global', hasProjectOverride: false });
  });

  it('set with scope project creates the override and useGlobal drops it, announcing both', async () => {
    const events: ServerEvent[] = [];
    const h = await handlers((e) => events.push(e), undefined, { claudeInventory: fakeInventory() });
    const { revision } = (await h.handle(cmd({ cmd: 'claude.tools.get' }))) as { revision: string };
    const set = (await h.handle(cmd({ cmd: 'claude.tools.set', config: customConfig, expectedRevision: revision, scope: 'project' }))) as { scope: string; hasProjectOverride: boolean; revision: string };
    expect(set).toMatchObject({ scope: 'project', hasProjectOverride: true });
    const back = (await h.handle(cmd({ cmd: 'claude.tools.useGlobal', expectedRevision: set.revision }))) as { scope: string; hasProjectOverride: boolean; config: unknown; inventory: unknown };
    expect(back).toMatchObject({ scope: 'global', hasProjectOverride: false });
    const bot = events.filter((e) => e.kind === 'bot.event');
    expect(bot).toHaveLength(2);
    expect(bot[0]).toMatchObject({ botKind: 'claude-tools.changed', payload: { scope: 'project' } });
    expect(bot[1]).toMatchObject({ botKind: 'claude-tools.changed', payload: { scope: 'global', changed: ['sources', 'mcp'] } });
  });

  it('useGlobal without an override changes nothing and announces nothing', async () => {
    const events: ServerEvent[] = [];
    const h = await handlers((e) => events.push(e), undefined, { claudeInventory: fakeInventory() });
    const { revision } = (await h.handle(cmd({ cmd: 'claude.tools.get' }))) as { revision: string };
    await h.handle(cmd({ cmd: 'claude.tools.useGlobal', expectedRevision: revision }));
    expect(events.filter((e) => e.kind === 'bot.event')).toHaveLength(0);
  });

  it('useGlobal reports conflict on a stale revision', async () => {
    const h = await handlers(undefined, undefined, { claudeInventory: fakeInventory() });
    await expect(h.handle(cmd({ cmd: 'claude.tools.useGlobal', expectedRevision: 'ffffffffffffffff' }))).rejects.toMatchObject({ code: 'conflict' });
  });

  it('set reports conflict on a stale revision', async () => {
    const h = await handlers(undefined, undefined, { claudeInventory: fakeInventory() });
    await expect(h.handle(cmd({ cmd: 'claude.tools.set', config: customConfig, expectedRevision: 'ffffffffffffffff' }))).rejects.toMatchObject({ code: 'conflict' });
  });

  it('refresh runs the probe and returns the inventory', async () => {
    const inventory = fakeInventory();
    const h = await handlers(undefined, undefined, { claudeInventory: inventory });
    const result = (await h.handle(cmd({ cmd: 'claude.inventory.refresh' }))) as { inventory: { counts: { all: { skills: number } } } };
    expect(result.inventory.counts.all.skills).toBe(5);
    expect(inventory.calls).toBe(1);
  });
});

describe('createHandlers', () => {
  it('question.answer rejects an unknown question as not-found', async () => {
    const h = await handlers();
    await expect(h.handle(cmd({ cmd: 'question.answer', questionId: 'nope', decline: true }))).rejects.toMatchObject({ code: 'not-found' });
  });

  it('profile.set writes the profile into global.json and returns it', async () => {
    const h = await handlers();
    expect(await h.handle(cmd({ cmd: 'profile.set', profile: 'solo' }))).toEqual({ profile: 'solo' });
    expect(JSON.parse(await readFile(path.join(root, 'sdd', 'global.json'), 'utf8')).profile).toBe('solo');
  });

  it('profile.set reports a workspace without global.json as not-found', async () => {
    const h = await handlers();
    await rm(path.join(root, 'sdd', 'global.json'));
    await expect(h.handle(cmd({ cmd: 'profile.set', profile: 'team' }))).rejects.toMatchObject({ code: 'not-found' });
  });

  it('advertises the kit features in the welcome', async () => {
    expect((await handlers()).welcome().features).toEqual(expect.arrayContaining(['kit-index', 'kit-tools', 'rtk-gain']));
  });

  it('kit.index returns the kit index with the memory and registries sections', async () => {
    await mkdir(path.join(root, 'sdd/memory'), { recursive: true });
    await writeFile(path.join(root, 'sdd/memory/lessons.md'), '# lessons');
    const index = (await (await handlers()).handle(cmd({ cmd: 'kit.index' }))) as { entries: { path: string; section: string }[]; truncated: boolean };
    expect(index.truncated).toBe(false);
    expect(index.entries).toContainEqual(expect.objectContaining({ path: 'sdd/memory/lessons.md', section: 'memory' }));
  });

  it('kit.pack.stats delegates to the reader and maps typed failures to session errors', async () => {
    const stats: KitPackStats = { rows: [{ unit: 'B-01', role: 'implementor-back', packBytes: 1, sourceBytes: 2 }], total: { packBytes: 1, sourceBytes: 2 }, packMisses: 0 };
    const calls: string[][] = [];
    const h = await handlers(undefined, undefined, { packStats: async (r, spec, cycle) => { calls.push([r, spec, cycle]); return stats; } });
    expect(await h.handle(cmd({ cmd: 'kit.pack.stats', spec: 'spec-a-001-b', cycle: 'cycle-01' }))).toEqual(stats);
    expect(calls).toEqual([[root, 'spec-a-001-b', 'cycle-01']]);
    const failing = await handlers(undefined, undefined, { packStats: async () => { throw new PackStatsError('not-found', 'nope'); } });
    await expect(failing.handle(cmd({ cmd: 'kit.pack.stats', spec: 'spec-a-001-b', cycle: 'cycle-01' }))).rejects.toMatchObject({ code: 'not-found' });
  });

  it('kit.rtkGain delegates to the reader with the workspace root', async () => {
    const gain: RtkGain = { status: 'not-installed', version: null, gain: null, readAt: '2026-10-27T00:00:00.000Z' };
    const calls: string[] = [];
    const h = await handlers(undefined, undefined, { rtkGain: async (r) => { calls.push(r); return gain; } });
    expect(await h.handle(cmd({ cmd: 'kit.rtkGain' }))).toEqual(gain);
    expect(calls).toEqual([root]);
  });

  describe('kit.tools.set', () => {
    const toolsPath = () => path.join(root, 'sdd/tools.json');
    const revision = async () => computeToolsRevision(await readFile(toolsPath()));
    const at = new Date('2026-10-27T12:00:00.000Z');

    it('writes the change, refreshes the watcher, records tools.changed in #general and broadcasts it', async () => {
      const events: ServerEvent[] = [];
      let refreshed = 0;
      const h = await handlers((e) => events.push(e), async () => { refreshed++; }, { now: () => at });
      const result = await h.handle(cmd({ cmd: 'kit.tools.set', change: { tool: 'gate', mode: 'warn' }, expectedRevision: await revision() }));
      expect(result).toMatchObject({ changed: true, tool: 'gate', from: 'block', to: 'warn' });
      expect(JSON.parse(await readFile(toolsPath(), 'utf8')).claude_mod.gate).toBe('warn');
      expect(refreshed).toBe(1);
      const expected = { channelId: 'general', botKind: 'tools.changed', payload: { tool: 'gate', from: 'block', to: 'warn', file: 'sdd/tools.json' }, at: at.toISOString() };
      expect(events).toEqual([{ kind: 'bot.event', ...expected }]);
      expect(await h.handle(cmd({ cmd: 'channel.botHistory', channelId: 'general', limit: 10, includeKitEvents: true }))).toEqual([expected]);
      expect(await h.handle(cmd({ cmd: 'channel.botHistory', channelId: 'general', limit: 10 }))).toEqual([]);
    });

    it('a no-op change neither refreshes nor records anything', async () => {
      const events: ServerEvent[] = [];
      let refreshed = 0;
      const h = await handlers((e) => events.push(e), async () => { refreshed++; });
      const result = await h.handle(cmd({ cmd: 'kit.tools.set', change: { tool: 'rtk', enabled: false }, expectedRevision: await revision() }));
      expect(result).toMatchObject({ changed: false });
      expect(refreshed).toBe(0);
      expect(events).toEqual([]);
      expect(await h.handle(cmd({ cmd: 'channel.botHistory', channelId: 'general', limit: 10, includeKitEvents: true }))).toEqual([]);
    });

    it('a stale revision is a conflict and records nothing', async () => {
      const events: ServerEvent[] = [];
      const h = await handlers((e) => events.push(e));
      await expect(h.handle(cmd({ cmd: 'kit.tools.set', change: { tool: 'mod', enabled: true }, expectedRevision: '0123456789abcdef' }))).rejects.toMatchObject({ code: 'conflict' });
      expect(events).toEqual([]);
      expect(JSON.parse(await readFile(toolsPath(), 'utf8')).claude_mod.enabled).toBe(false);
    });

    it('a missing tools.json is not-found and is never created', async () => {
      const h = await handlers();
      await rm(toolsPath());
      await expect(h.handle(cmd({ cmd: 'kit.tools.set', change: { tool: 'rtk', enabled: true }, expectedRevision: '0123456789abcdef' }))).rejects.toMatchObject({ code: 'not-found' });
      await expect(readFile(toolsPath())).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });

  describe('kit.integration', () => {
    const at = new Date('2026-11-13T12:00:00.000Z');
    const status = (state: 'off' | 'complete', enabled: boolean) => ({
      integration: 'tucu-ui' as const, available: true, enabled, state, parts: { skill: true, mcp: true }, version: '0.16.0', kitVersion: '0.16.0',
      updateAvailable: false, nodeOk: true, harnesses: { claude: 'complete' as const, copilot: 'complete' as const, gemini: 'complete' as const, antigravity: 'complete' as const }, repair: null,
    });
    const fake = (ok: boolean): { integrations: KitIntegrations; calls: unknown[][] } => {
      const calls: unknown[][] = [];
      return {
        calls,
        integrations: {
          status: async (_root, integration) => { calls.push(['status', integration]); return status('off', false); },
          set: async (_root, integration, enabled) => { calls.push(['set', integration, enabled]); return { ok, exitCode: ok ? 0 : 1, output: ok ? 'on' : 'boom', status: status(ok ? 'complete' : 'off', ok) }; },
        },
      };
    };

    it('advertises kit-integrations in the welcome', async () => {
      expect((await handlers()).welcome().features).toContain('kit-integrations');
    });

    it('status delegates to the runner', async () => {
      const { integrations, calls } = fake(true);
      const h = await handlers(undefined, undefined, { integrations });
      expect(await h.handle(cmd({ cmd: 'kit.integration.status', integration: 'tucu-ui' }))).toEqual(status('off', false));
      expect(calls).toEqual([['status', 'tucu-ui']]);
    });

    it('a successful set refreshes the watcher, records integration.changed in #general and broadcasts it', async () => {
      const events: ServerEvent[] = [];
      let refreshed = 0;
      const { integrations } = fake(true);
      const h = await handlers((e) => events.push(e), async () => { refreshed++; }, { integrations, now: () => at });
      const result = await h.handle(cmd({ cmd: 'kit.integration.set', integration: 'tucu-ui', enabled: true }));
      expect(result).toMatchObject({ ok: true, output: 'on' });
      expect(refreshed).toBe(1);
      const expected = { channelId: 'general', botKind: 'integration.changed', payload: { integration: 'tucu-ui', enabled: true, state: 'complete' }, at: at.toISOString() };
      expect(events).toEqual([{ kind: 'bot.event', ...expected }]);
      expect(await h.handle(cmd({ cmd: 'channel.botHistory', channelId: 'general', limit: 10, includeKitEvents: true }))).toEqual([expected]);
      expect(await h.handle(cmd({ cmd: 'channel.botHistory', channelId: 'general', limit: 10 }))).toEqual([]);
    });

    it('a failed set returns ok false and neither refreshes nor records anything', async () => {
      const events: ServerEvent[] = [];
      let refreshed = 0;
      const { integrations } = fake(false);
      const h = await handlers((e) => events.push(e), async () => { refreshed++; }, { integrations });
      expect(await h.handle(cmd({ cmd: 'kit.integration.set', integration: 'tucu-ui', enabled: true }))).toMatchObject({ ok: false, exitCode: 1, output: 'boom' });
      expect(refreshed).toBe(0);
      expect(events).toEqual([]);
      expect(await h.handle(cmd({ cmd: 'channel.botHistory', channelId: 'general', limit: 10, includeKitEvents: true }))).toEqual([]);
    });
  });

  it('advertises the questions feature in the welcome', async () => {
    expect((await handlers()).welcome().features).toContain('questions');
  });

  it('builds the welcome from the snapshot', async () => {
    expect((await handlers()).welcome()).toEqual({
      bridgeVersion: '0.1.0', workspace: { root, project: 'studio fixture' }, kitVersion: '0.16.0', authMode: 'local-claude-login',
      features: [...BRIDGE_FEATURES],
    });
  });

  it('auth.set switches the welcome to api-key and null goes back', async () => {
    const h = await handlers();
    expect(await h.handle(cmd({ cmd: 'auth.set', apiKey: 'sk-ant-' + 'x'.repeat(30) }))).toEqual({ authMode: 'api-key' });
    expect(h.welcome().authMode).toBe('api-key');
    expect(await h.handle(cmd({ cmd: 'auth.set', apiKey: null }))).toEqual({ authMode: 'local-claude-login' });
  });

  it('auth.set with mode subscription keeps the local login and ignores a key', async () => {
    const h = await handlers();
    expect(await h.handle(cmd({ cmd: 'auth.set', apiKey: 'sk-ant-' + 'x'.repeat(30), mode: 'subscription' }))).toEqual({ authMode: 'local-claude-login' });
  });

  it('routes auth.status, auth.login and auth.logout to the login service', async () => {
    const h = await handlers();
    expect(await h.handle(cmd({ cmd: 'auth.status' }))).toMatchObject({ state: 'disconnected' });
    expect(await h.handle(cmd({ cmd: 'auth.login' }))).toMatchObject({ state: 'pending' });
    expect(await h.handle(cmd({ cmd: 'auth.logout' }))).toMatchObject({ state: 'disconnected' });
  });

  it('reads files under sdd/ and refuses the rest', async () => {
    const h = await handlers();
    expect(await h.handle(cmd({ cmd: 'workspace.readFile', path: 'sdd/global.json' }))).toMatchObject({ path: 'sdd/global.json' });
    await expect(h.handle(cmd({ cmd: 'workspace.readFile', path: 'sdd/../package.json' }))).rejects.toMatchObject({ code: 'bad-path' });
  });

  it('rejects oversized files and directories as bad-request', async () => {
    const h = await handlers();
    await writeFile(path.join(root, 'sdd', 'big.md'), 'x'.repeat(2 * 1024 * 1024 + 1));
    await expect(h.handle(cmd({ cmd: 'workspace.readFile', path: 'sdd/big.md' }))).rejects.toMatchObject({ code: 'bad-request' });
    await expect(h.handle(cmd({ cmd: 'workspace.readFile', path: 'sdd/scripts' }))).rejects.toMatchObject({ code: 'bad-request' });
  });

  it('creates threads, lists them and runs kit commands', async () => {
    const events: ServerEvent[] = [];
    const h = await handlers((e) => events.push(e));
    const thread = (await h.handle(cmd({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola' }))) as { id: string };
    expect(await h.handle(cmd({ cmd: 'thread.list', channelId: 'general' }))).toEqual([expect.objectContaining({ id: thread.id })]);
    // let the background turn finish so it is not still writing to the store when afterEach removes the workspace
    const status = async () => ((await h.handle(cmd({ cmd: 'thread.list', channelId: 'general' }))) as { status: string }[])[0]?.status;
    for (let n = 0; n < 250 && ['queued', 'running'].includes((await status()) ?? ''); n++) await new Promise((r) => setTimeout(r, 20));
    expect(await h.handle(cmd({ cmd: 'command.run', name: 'validate', args: [] }))).toEqual({ runId: 'run-1' });
    // the kit script runs with the workspace as cwd: Windows can't remove it until the child exits
    await waitFor(() => events.some((e) => e.kind === 'command.exit' && e.runId === 'run-1'));
    expect(await h.handle(cmd({ cmd: 'channel.botHistory', channelId: 'fixes', limit: 10 }))).toEqual([]);
  });

  it('workspace.snapshot rescans the workspace before answering, so a reload recovers missed fs events', async () => {
    let refreshes = 0;
    const h = await handlers(() => {}, async () => { refreshes += 1; });
    await h.handle(cmd({ cmd: 'workspace.snapshot' }));
    expect(refreshes).toBe(1);
  });

  it('I4: presence.get returns the current presence', async () => {
    const h = await handlers();
    const presence = (await h.handle(cmd({ cmd: 'presence.get' }))) as { agent: string; state: string }[];
    expect(presence.map((p) => p.agent)).toEqual(['sdd-orchestrator', 'sdd-planner']);
    expect(presence.every((p) => p.state === 'idle')).toBe(true);
  });

  it.skipIf(process.platform === 'win32')('T16: a FIFO under sdd/ is refused without blocking', async () => {
    const { execFileSync } = await import('node:child_process');
    const fifo = path.join(root, 'sdd', 'pipe.md');
    execFileSync('mkfifo', [fifo]);
    const h = await handlers();
    await expect(h.handle(cmd({ cmd: 'workspace.readFile', path: 'sdd/pipe.md' }))).rejects.toMatchObject({ code: 'bad-request' });
  }, 5000);

  describe('pending messages and cycle-02 contracts', () => {
    const create = async (h: Awaited<ReturnType<typeof handlers>>, text: string) => {
      const thread = (await h.handle(cmd({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text }))) as { id: string };
      const list = async () => ((await h.handle(cmd({ cmd: 'thread.list', channelId: 'general' }))) as { status: string; pendingCount: number }[])[0];
      await waitFor(async () => (await list())?.status === 'running');
      return { id: thread.id, list };
    };

    it('thread.send answers started or pending, and the pending commands work end to end', async () => {
      const h = await handlers();
      const { id, list } = await create(h, '#slow');
      const sent = (await h.handle(cmd({ cmd: 'thread.send', threadId: id, text: 'later' }))) as { delivery: string; pendingId: string };
      expect(sent).toEqual({ delivery: 'pending', pendingId: expect.any(String) });
      expect(await h.handle(cmd({ cmd: 'thread.pending.edit', threadId: id, pendingId: sent.pendingId, text: 'edited' }))).toBeNull();
      await expect(h.handle(cmd({ cmd: 'thread.pending.flush', threadId: id }))).rejects.toMatchObject({ code: 'conflict' });
      expect(await h.handle(cmd({ cmd: 'thread.pending.remove', threadId: id, pendingId: sent.pendingId }))).toBeNull();
      expect((await list())?.pendingCount).toBe(0);
      await expect(h.handle(cmd({ cmd: 'thread.pending.remove', threadId: id, pendingId: sent.pendingId }))).rejects.toMatchObject({ code: 'not-found' });
      await h.handle(cmd({ cmd: 'thread.interrupt', threadId: id }));
    });

    it('thread.pending.flush starts a turn with the pending messages of a stopped thread', async () => {
      const h = await handlers();
      const { id, list } = await create(h, '#slow');
      await h.handle(cmd({ cmd: 'thread.send', threadId: id, text: 'p1' }));
      await h.handle(cmd({ cmd: 'thread.interrupt', threadId: id }));
      await waitFor(async () => (await list())?.status === 'interrupted');
      await new Promise((r) => setTimeout(r, 30));
      expect(await h.handle(cmd({ cmd: 'thread.pending.flush', threadId: id }))).toEqual({ delivery: 'started' });
      await waitFor(async () => (await list())?.status === 'idle');
    });

    it('announces the cycle-02 features', async () => {
      const features = (await handlers()).welcome().features ?? [];
      expect(features).toEqual(expect.arrayContaining(['attachments', 'file-search', 'catalog']));
    });

    it('thread.create with attachments and refs stores the upload and echoes the markers', async () => {
      const h = await handlers();
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 5]).toString('base64');
      const created = (await h.handle(cmd({
        cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'see',
        attachments: [{ kind: 'image', name: 'a.png', mime: 'image/png', data: png, width: 1, height: 1 }],
        refs: { agents: ['sdd-planner'], skills: [] },
      }))) as { id: string };
      const history = async () => (await h.handle(cmd({ cmd: 'thread.history', threadId: created.id, sinceSeq: 0 }))) as Array<{ event: { type: string; text?: string; attachments?: unknown[]; refs?: unknown } }>;
      await waitFor(async () => (await history()).some(({ event }) => event.type === 'turn.end'));
      const events = (await history()).map(({ event }) => event);
      expect(events.find((e) => e.type === 'user.message')).toMatchObject({ attachments: [{ name: 'a.png' }], refs: { agents: ['sdd-planner'] } });
      expect(events.find((e) => e.type === 'message.delta')).toMatchObject({ text: 'echo: see [attachments: a.png] [refs: @sdd-planner]' });
    });

    it('thread.send with attachments reaches the session manager', async () => {
      const h = await handlers();
      const created = (await h.handle(cmd({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola' }))) as { id: string };
      const list = async () => ((await h.handle(cmd({ cmd: 'thread.list' }))) as Array<{ id: string; status: string }>).find((t) => t.id === created.id);
      await waitFor(async () => (await list())?.status === 'idle');
      const note = { kind: 'text', name: 'n.txt', mime: 'text/plain', text: 'hi' };
      expect(await h.handle(cmd({ cmd: 'thread.send', threadId: created.id, text: '', attachments: [note] }))).toEqual({ delivery: 'started' });
      await waitFor(async () => (await list())?.status === 'idle');
    });
  });

  it('workspace.searchFiles answers from the file index without leaking secrets', async () => {
    const h = await handlers();
    await writeFile(path.join(root, 'notes.md'), 'x');
    await writeFile(path.join(root, '.env'), 'SECRET=1');
    const hit = (await h.handle(cmd({ cmd: 'workspace.searchFiles', query: 'notes' }))) as { files: Array<{ path: string }>; query: string };
    expect(hit.files).toEqual([{ path: 'notes.md' }]);
    const env = (await h.handle(cmd({ cmd: 'workspace.searchFiles', query: 'env', limit: 5 }))) as { files: Array<{ path: string }> };
    expect(env.files.map((f) => f.path)).not.toContain('.env');
  });

  it('attachment.get returns stored bytes as base64 and hides failures behind a generic not-found', async () => {
    const h = await handlers();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]);
    const store = createAttachmentStore(root);
    const ref = await store.put({ kind: 'image', name: 'a.png', mime: 'image/png', data: png.toString('base64'), width: 1, height: 1 });
    expect(await h.handle(cmd({ cmd: 'attachment.get', sha256: ref.sha256, mime: 'image/png' }))).toEqual({
      sha256: ref.sha256, mime: 'image/png', data: png.toString('base64'),
    });
    await expect(h.handle(cmd({ cmd: 'attachment.get', sha256: 'a'.repeat(64), mime: 'image/png' }))).rejects.toMatchObject({
      code: 'not-found', message: 'attachment not available',
    });
    expect(decodeClientMessage(JSON.stringify({ kind: 'command', id: 'x', cmd: 'attachment.get', sha256: '../../etc/passwd', mime: 'image/png' })).ok).toBe(false);
    expect(decodeClientMessage(JSON.stringify({ kind: 'command', id: 'x', cmd: 'attachment.get', sha256: 'A'.repeat(64), mime: 'image/png' })).ok).toBe(false);
  });

  it('thread.create accepts a link and thread.setLink answers the updated ThreadInfo', async () => {
    const h = await handlers();
    const created = (await h.handle(cmd({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola', link: { kind: 'none' } }))) as { id: string; link: unknown };
    expect(created.link).toEqual({ target: { kind: 'none' }, source: 'manual', targets: [] });
    const updated = (await h.handle(cmd({ cmd: 'thread.setLink', threadId: created.id, link: { kind: 'fix', fixId: 'FIX-dev-001-001' } }))) as { link: unknown };
    expect(updated.link).toEqual({ target: { kind: 'fix', fixId: 'FIX-dev-001-001' }, source: 'manual', targets: [{ kind: 'fix', fixId: 'FIX-dev-001-001', origin: 'manual' }] });
    await expect(h.handle(cmd({ cmd: 'thread.setLink', threadId: created.id, link: { kind: 'fix', fixId: 'FIX-nope' } }))).rejects.toMatchObject({ code: 'not-found' });
    await waitFor(async () => ((await h.handle(cmd({ cmd: 'thread.list' }))) as { status: string }[])[0]?.status === 'idle');
  });

  it('thread.updateLinks adds and removes associations and keeps the list on a missing destination', async () => {
    const h = await handlers();
    const created = (await h.handle(cmd({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola' }))) as { id: string };
    await waitFor(async () => ((await h.handle(cmd({ cmd: 'thread.list' }))) as { status: string }[])[0]?.status === 'idle');
    const cycle = { kind: 'cycle', specId: 'spec-dev-001-pagos', cycle: 'cycle-01' };
    const added = (await h.handle(cmd({ cmd: 'thread.updateLinks', threadId: created.id, add: [cycle] }))) as { link: { targets: unknown[] } };
    expect(added.link.targets).toEqual([{ ...cycle, origin: 'manual' }]);
    await expect(
      h.handle(cmd({ cmd: 'thread.updateLinks', threadId: created.id, add: [{ kind: 'fix', fixId: 'FIX-nope' }], remove: [cycle] })),
    ).rejects.toMatchObject({ code: 'not-found' });
    const kept = (await h.handle(cmd({ cmd: 'thread.list' }))) as Array<{ link: { targets: unknown[] } }>;
    expect(kept[0]?.link.targets).toEqual([{ ...cycle, origin: 'manual' }]);
    const removed = (await h.handle(cmd({ cmd: 'thread.updateLinks', threadId: created.id, remove: [cycle] }))) as { link: { targets: unknown[] } };
    expect(removed.link.targets).toEqual([]);
  });

  it('thread.history hides document.touched unless includeDocumentTouched is true', async () => {
    const h = await handlers();
    const created = (await h.handle(cmd({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: '#write-doc' }))) as { id: string };
    await waitFor(async () => ((await h.handle(cmd({ cmd: 'thread.list' }))) as { status: string }[])[0]?.status === 'idle');
    const types = async (extra: Record<string, unknown>) =>
      ((await h.handle(cmd({ cmd: 'thread.history', threadId: created.id, sinceSeq: 0, ...extra }))) as Array<{ event: { type: string } }>).map((e) => e.event.type);
    expect(await types({})).not.toContain('document.touched');
    expect(await types({ includeDocumentTouched: false })).not.toContain('document.touched');
    expect(await types({ includeDocumentTouched: true })).toContain('document.touched');
  });
});

describe('claude connect commands', () => {
  const offConfig = { sources: { user: false, local: false }, disabledPlugins: [] as string[], disabledMcpServers: [] as string[], browser: { enabled: false, browserUrl: null } };
  const onConfig = { ...offConfig, browser: { enabled: true, browserUrl: null } };

  it('browser.check returns the status and announces claude-browser.changed once', async () => {
    const events: ServerEvent[] = [];
    const chrome = fakeChrome('connected');
    const h = await handlers((e) => events.push(e), undefined, { chromeStatus: chrome.service });
    expect(await h.handle(cmd({ cmd: 'claude.browser.check' }))).toMatchObject({ state: 'connected', detail: null });
    await h.handle(cmd({ cmd: 'claude.browser.check' }));
    const bot = events.filter((e) => e.kind === 'bot.event');
    expect(bot).toHaveLength(1);
    expect(bot[0]).toMatchObject({ botKind: 'claude-browser.changed', payload: { state: 'connected' } });
  });

  it('openSettings launches Studio Chrome or opens a tab when it was already running', async () => {
    let launched = true;
    let tabs = 0;
    const h = await handlers(undefined, undefined, { openSettings: { studio: { ensure: async () => ({ launched }) }, openTab: async () => { tabs += 1; return true; } } });
    expect(await h.handle(cmd({ cmd: 'claude.browser.openSettings' }))).toEqual({ opened: true });
    expect(tabs).toBe(0);
    launched = false;
    expect(await h.handle(cmd({ cmd: 'claude.browser.openSettings' }))).toEqual({ opened: true });
    expect(tabs).toBe(1);
  });

  it('mcp login and reconnect delegate to the service', async () => {
    const h = await handlers(undefined, undefined, { claudeMcp: fakeMcp() });
    expect(await h.handle(cmd({ cmd: 'claude.mcp.login', name: 'docs' }))).toMatchObject({ name: 'docs', outcome: 'ok' });
    expect(await h.handle(cmd({ cmd: 'claude.mcp.reconnect', name: 'docs' }))).toMatchObject({ name: 'docs', status: 'connected' });
  });

  it('checks Chrome when tools.set turns the browser on, not when it stays on or turns off', async () => {
    const chrome = fakeChrome();
    const h = await handlers(undefined, undefined, { claudeInventory: fakeInventory(), chromeStatus: chrome.service });
    let { revision } = (await h.handle(cmd({ cmd: 'claude.tools.get' }))) as { revision: string };
    const set = async (config: typeof onConfig) => {
      const result = (await h.handle(cmd({ cmd: 'claude.tools.set', config, expectedRevision: revision }))) as { revision: string };
      revision = result.revision;
    };
    await set(offConfig);
    await set(onConfig);
    await waitFor(() => chrome.calls === 1);
    await set({ ...onConfig, disabledMcpServers: ['x'] });
    await set(offConfig);
    expect(chrome.calls).toBe(1);
  });

  it('announces claude-connect in the welcome features', () => {
    expect(BRIDGE_FEATURES).toContain('claude-connect');
  });
});

describe('kit.verify.run', () => {
  const writeVerifyKit = async (script: string) => {
    await writeFile(path.join(root, 'sdd', 'verify.json'), JSON.stringify({ 'libs/x': { quick: ['c'], full: ['c'] }, 'apps/q': { quick: ['c'] } }));
    await writeFile(path.join(root, 'sdd', 'scripts', 'sdd-verify.mjs'), script);
  };
  const echoArgs = "process.stdout.write(process.argv.slice(2).join(' '));\n";
  const verify = (extra: Record<string, unknown> = {}) => cmd({ cmd: 'kit.verify.run', app: 'libs/x', level: 'quick', ...extra });

  it('runs sdd-verify with app, level and the optional unit and cycle args', async () => {
    await writeVerifyKit(echoArgs);
    const events: ServerEvent[] = [];
    const h = await handlers((e) => events.push(e));
    expect(await h.handle(verify({ level: 'full', spec: 'spec-a', cycle: 'cycle-02', unit: 'B-01' }))).toEqual({ runId: 'run-1' });
    await waitFor(() => events.find((e) => e.kind === 'command.exit'));
    expect(events).toContainEqual({ kind: 'command.output', runId: 'run-1', stream: 'stdout', chunk: 'libs/x full --spec spec-a --cycle cycle-02 --unit B-01' });
    expect(events).toContainEqual({ kind: 'command.exit', runId: 'run-1', exitCode: 0 });
  });

  it('reports a non-zero exit such as the lease timeout (75)', async () => {
    await writeVerifyKit('process.exit(75);\n');
    const events: ServerEvent[] = [];
    const h = await handlers((e) => events.push(e));
    await h.handle(verify());
    expect(await waitFor(() => events.find((e) => e.kind === 'command.exit'))).toMatchObject({ exitCode: 75 });
  });

  it('refreshes the snapshot when the run ends', async () => {
    await writeVerifyKit(echoArgs);
    let refreshed = 0;
    const h = await handlers(() => {}, async () => { refreshed++; });
    await h.handle(verify());
    await waitFor(() => refreshed > 0);
  });

  it('rejects an app that is not in verify.json and a level it does not have', async () => {
    await writeVerifyKit(echoArgs);
    const h = await handlers();
    await expect(h.handle(verify({ app: 'libs/nope' }))).rejects.toMatchObject({ code: 'bad-request' });
    await expect(h.handle(verify({ app: 'apps/q', level: 'full' }))).rejects.toMatchObject({ code: 'bad-request' });
  });

  it('answers conflict while another verify is running', async () => {
    await writeVerifyKit('setInterval(() => undefined, 1000);\n');
    const runner = new CommandRunner(root, () => {}, () => 'run-1');
    const h = await handlers(undefined, undefined, {}, runner);
    await h.handle(verify());
    await expect(h.handle(verify())).rejects.toMatchObject({ code: 'conflict' });
    runner.terminateAll();
    await waitFor(() => runner.activeRuns() === 0);
  });

  it('announces kit-execution in the welcome features', async () => {
    expect((await handlers()).welcome().features).toContain('kit-execution');
  });
});
