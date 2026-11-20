import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Options, Query } from '@anthropic-ai/claude-agent-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClaudeInventory, type ProbeQueryFn } from './claude-inventory';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'claude-inventory-'));
});
afterEach(() => rm(root, { recursive: true, force: true }));

const initMessage = (skills: number, withUser: boolean) => ({
  type: 'system',
  subtype: 'init',
  skills: Array(skills).fill('s'),
  agents: ['a'],
  tools: withUser ? ['mcp__x__y', 'Read'] : ['Read'],
  plugins: withUser ? [{ name: 'p', source: 'p@market' }] : [],
  mcp_servers: withUser ? [{ name: 'x', status: 'connected', source: 'user' }] : [],
});

interface Probe {
  fn: ProbeQueryFn;
  seen: Options[];
  closed: number;
  aborted: boolean[];
}
const fakeProbe = (): Probe => {
  const probe: Probe = { seen: [], closed: 0, aborted: [], fn: () => undefined as never };
  probe.fn = ({ options }) => {
    probe.seen.push(options ?? {});
    const withUser = (options?.settingSources ?? []).includes('user');
    async function* run() {
      yield initMessage(withUser ? 9 : 2, withUser);
      yield { type: 'result' };
    }
    return Object.assign(run(), {
      close: () => {
        probe.closed += 1;
        probe.aborted.push(options?.abortController?.signal.aborted ?? false);
      },
    }) as unknown as Query;
  };
  return probe;
};

describe('claude inventory probe', () => {
  it('combines project-only and all-sources inits and persists the result', async () => {
    const probe = fakeProbe();
    const service = createClaudeInventory({ root, queryFn: probe.fn, now: () => new Date('2026-11-20T10:00:00Z') });
    const inventory = await service.refresh();
    expect(inventory.counts.project).toMatchObject({ skills: 2, mcpTools: 0 });
    expect(inventory.counts.all).toMatchObject({ skills: 9, mcpTools: 1, plugins: 1 });
    expect(inventory.plugins).toEqual([{ id: 'p@market', name: 'p', scope: 'market' }]);
    expect(inventory.capturedAt).toBe('2026-11-20T10:00:00.000Z');
    expect(probe.seen.map((o) => o.settingSources).sort()).toEqual([['project'], ['user', 'project', 'local']].sort());
    for (const options of probe.seen) {
      expect(options).toMatchObject({ cwd: root, permissionMode: 'plan' });
      expect(options.settings).toBeUndefined();
      expect(options.mcpServers).toBeUndefined();
    }
    expect(probe.closed).toBe(2);
    expect(probe.aborted).toEqual([true, true]);
    const saved = JSON.parse(await readFile(path.join(root, '.sdd-studio', 'claude-inventory.json'), 'utf8'));
    expect(saved).toEqual(inventory);
  });

  it('reuses the in-flight probe', async () => {
    const probe = fakeProbe();
    const service = createClaudeInventory({ root, queryFn: probe.fn });
    const [a, b] = await Promise.all([service.refresh(), service.refresh()]);
    expect(a).toBe(b);
    expect(probe.seen).toHaveLength(2);
  });

  it('fails with an internal error on timeout', async () => {
    const hang: ProbeQueryFn = () =>
      Object.assign(
        (async function* () {
          await new Promise(() => undefined);
          yield {};
        })(),
        { close: () => undefined },
      ) as unknown as Query;
    const service = createClaudeInventory({ root, queryFn: hang, timeoutMs: 20 });
    await expect(service.refresh()).rejects.toMatchObject({ code: 'internal', message: expect.stringContaining('timed out') });
    expect(service.current()).toBeNull();
  });

  it('loads the persisted inventory without probing', async () => {
    const first = createClaudeInventory({ root, queryFn: fakeProbe().fn });
    const inventory = await first.refresh();
    const probe = fakeProbe();
    const second = createClaudeInventory({ root, queryFn: probe.fn });
    expect(second.current()).toBeNull();
    await second.load();
    expect(second.current()).toEqual(inventory);
    expect(probe.seen).toHaveLength(0);
  });

  it('updates MCP status from a live init without replacing the catalog', async () => {
    const service = createClaudeInventory({ root, queryFn: fakeProbe().fn, now: () => new Date('2026-11-20T11:00:00Z') });
    await service.refresh();
    service.applyInit({
      plugins: [],
      mcpServers: [{ name: 'x', status: 'failed', source: 'user' }, { name: 'other', status: 'connected', source: 'user' }],
      counts: { skills: 0, agents: 0, plugins: 0, mcpServers: 2, mcpTools: 0 },
    });
    const current = service.current();
    expect(current?.mcpServers).toEqual([{ name: 'x', status: 'failed', source: 'user' }]);
    expect(current?.capturedAt).toBe('2026-11-20T11:00:00.000Z');
    expect(current?.counts.all.skills).toBe(9);
  });

  it('ignores a live init when there is no catalog yet', () => {
    const service = createClaudeInventory({ root, queryFn: fakeProbe().fn });
    service.applyInit({ plugins: [], mcpServers: [], counts: { skills: 0, agents: 0, plugins: 0, mcpServers: 0, mcpTools: 0 } });
    expect(service.current()).toBeNull();
  });
});
