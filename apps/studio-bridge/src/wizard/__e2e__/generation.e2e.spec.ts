import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PROTOCOL_VERSION, WS_CLOSE_WORKSPACE_SWITCHED, type GenerationState, type ServerMessage } from '@sdd-studio/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { DEFAULT_ORIGINS, startBridge } from '../../main';
import { waitFor } from '../../test-utils/fixture';
import { locateHarnessCli } from '../cli-locator';

const ignoredNames = new Set(['node_modules', 'pnpm-lock.yaml', '.git', 'dist', '.nx', '.next', '.cache', '.sdd-studio']);
const MINUTE = 60_000;

function normalize(text: string, name: string): string {
  return text
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '<TS>')
    .replace(/\d{4}-\d{2}-\d{2}/g, '<DATE>')
    .split(name)
    .join('<NAME>');
}

function treeOf(root: string, name: string, relative = '', out = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(path.join(root, relative)).sort()) {
    if (ignoredNames.has(entry) || entry.endsWith('.tsbuildinfo')) continue;
    const rel = path.join(relative, entry);
    const info = lstatSync(path.join(root, rel));
    if (info.isSymbolicLink()) out.set(rel, `L:${readlinkSync(path.join(root, rel))}`);
    else if (info.isDirectory()) {
      out.set(rel, 'D');
      treeOf(root, name, rel, out);
    } else out.set(rel, `F:${normalize(readFileSync(path.join(root, rel), 'utf8'), name)}`);
  }
  return out;
}

function configOf(name: string, mode: 'nx' | 'standalone') {
  const apps = mode === 'nx' ? [{ name: 'web', type: 'react', port: 4300 }, { name: 'core-api', type: 'nestjs', port: 3100 }] : [{ name: 'app', type: 'nextjs' }];
  return {
    mode,
    project: { name, description: 'Wizard generation e2e.', packageScope: '@wizard' },
    apps,
    libs: mode === 'nx' ? [{ name: 'shared-types', type: 'shared-types' }] : [],
    services: [],
    sdd: { author: 'e2e', modules: ['core'], ...(mode === 'nx' ? { tucu_ui: true } : {}) },
  };
}

async function connect(port: number, token: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const inbox: ServerMessage[] = [];
  ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
  await new Promise((resolve) => ws.once('open', resolve));
  ws.send(JSON.stringify({ kind: 'hello', token, protocolVersion: PROTOCOL_VERSION, clientVersion: 'e2e' }));
  const welcome = (await waitFor(() => inbox.find((m) => m.kind === 'welcome'))) as Extract<ServerMessage, { kind: 'welcome' }>;
  let counter = 0;
  const call = async (cmd: Record<string, unknown>) => {
    const id = `e${++counter}`;
    ws.send(JSON.stringify({ kind: 'command', id, ...cmd }));
    return (await waitFor(() => inbox.find((m) => m.kind === 'result' && m.id === id), 30_000)) as Extract<ServerMessage, { kind: 'result' }>;
  };
  return { ws, inbox, welcome, call };
}

let sandbox: string;
beforeAll(() => {
  sandbox = mkdtempSync(path.join(process.env['HARNESS_E2E_OUT'] ?? tmpdir(), 'wizard-e2e-'));
});
afterAll(() => rmSync(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }), 5 * MINUTE);

describe.skipIf(!process.env['HARNESS_E2E'])('e2e: real generation through the launcher bridge', () => {
  it.each([['nx' as const], ['standalone' as const]])('generates a %s project equivalent to harness init --config and opens it', async (mode) => {
    const name = `wiz-${mode === 'nx' ? 'mono' : 'sa'}`;
    const config = configOf(name, mode);
    const launcherRoot = path.join(sandbox, `launcher-${mode}`);
    mkdirSync(launcherRoot, { recursive: true });
    const bridge = await startBridge({ root: launcherRoot, port: 0, strictPort: true, engine: 'fake', allowedOrigins: DEFAULT_ORIGINS, webUrl: 'x', allowTargets: [sandbox], harnessCli: locateHarnessCli() });
    try {
      const client = await connect(bridge.port, bridge.token);
      expect(client.welcome.workspace).toBeNull();
      const target = path.join(sandbox, 'bridge', name);
      const started = await client.call({ cmd: 'wizard.generate', config, path: target });
      expect(started).toMatchObject({ ok: true, data: { outcome: 'started' } });
      const id = (started as { data: { generation: GenerationState } }).data.generation.id;

      const final = await waitFor(
        () => client.inbox.find((m): m is Extract<ServerMessage, { kind: 'generation.status' }> => m.kind === 'generation.status' && m.generation.id === id && m.generation.status !== 'running'),
        15 * MINUTE,
      );
      expect(final.generation).toMatchObject({ status: 'succeeded', exitCode: 0, hasSdd: true, gate: { validate: 'pass', build: 'pass' } });
      expect(final.generation.stages.map((s) => s.status)).toEqual(Array(6).fill('done'));

      const seqs = client.inbox.flatMap((m) => (m.kind === 'generation.output' && m.generationId === id ? [m.seq] : []));
      expect(seqs.length).toBeGreaterThan(0);
      expect(seqs).toEqual(seqs.map((_, index) => index + 1));
      expect(seqs.at(-1)).toBe(final.generation.lastSeq);
      expect(JSON.parse(readFileSync(path.join(target, 'harness.config.json'), 'utf8'))).toEqual(config);

      const direct = path.join(sandbox, 'cli', name);
      mkdirSync(direct, { recursive: true });
      writeFileSync(path.join(direct, 'harness.config.json'), `${JSON.stringify(config, null, 2)}\n`);
      const { NX_WORKSPACE_ROOT_PATH: _ignored, ...env } = process.env;
      void _ignored;
      const run = spawnSync(process.execPath, [locateHarnessCli().bin, 'init', '--config', 'harness.config.json', '--here', '-y'], { cwd: direct, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      expect(run.status, `${run.stdout}${run.stderr}`.slice(-3000)).toBe(0);

      const viaBridge = treeOf(target, name);
      const viaCli = treeOf(direct, name);
      const mismatches = [...new Set([...viaBridge.keys(), ...viaCli.keys()])].filter((key) => viaBridge.get(key) !== viaCli.get(key));
      expect(mismatches).toEqual([]);

      const closed = new Promise<number>((resolve) => client.ws.once('close', resolve));
      expect(await client.call({ cmd: 'workspace.open', generationId: id })).toMatchObject({ ok: true, data: { project: name } });
      expect(await closed).toBe(WS_CLOSE_WORKSPACE_SWITCHED);
      const reconnected = await connect(bridge.port, bridge.token);
      expect(reconnected.welcome.workspace?.project).toBe(name);
      reconnected.ws.close();
    } finally {
      await bridge.close();
    }
  }, 30 * MINUTE);

  it('cancels a running generation and leaves no process behind', async () => {
    const launcherRoot = path.join(sandbox, 'launcher-cancel');
    mkdirSync(launcherRoot, { recursive: true });
    const bridge = await startBridge({ root: launcherRoot, port: 0, strictPort: true, engine: 'fake', allowedOrigins: DEFAULT_ORIGINS, webUrl: 'x', allowTargets: [sandbox], harnessCli: locateHarnessCli() });
    try {
      const client = await connect(bridge.port, bridge.token);
      const started = await client.call({ cmd: 'wizard.generate', config: configOf('wiz-cancel', 'standalone'), path: path.join(sandbox, 'bridge', 'wiz-cancel') });
      const id = (started as { data: { generation: GenerationState } }).data.generation.id;
      await waitFor(() => client.inbox.some((m) => m.kind === 'generation.status' && m.generation.stages.some((s) => s.stage === 'install' && s.status === 'active')), 2 * MINUTE);
      const cancelled = await client.call({ cmd: 'wizard.generation.cancel', generationId: id });
      expect(cancelled).toMatchObject({ ok: true, data: { status: 'cancelled', failure: { kind: 'cancelled' } } });
      expect(await client.call({ cmd: 'wizard.generation.cancel', generationId: id })).toMatchObject({ ok: false, error: { code: 'conflict' } });
    } finally {
      await bridge.close();
    }
  }, 5 * MINUTE);
});
