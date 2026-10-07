// @vitest-environment node
import { defaultThreadOptions, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { DEFAULT_ORIGINS, startBridge } from '../../../../studio-bridge/src/main';
import { copyFixture, waitFor } from '../../../../studio-bridge/src/test-utils/fixture';
import { BridgeClient, type ConnectionState } from './client';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

async function bridge() {
  const { root, cleanup } = await copyFixture();
  cleanups.push(cleanup);
  const b = await startBridge({ root, port: 0, strictPort: true, engine: 'fake', allowedOrigins: DEFAULT_ORIGINS, webUrl: 'x' });
  cleanups.push(b.close);
  return b;
}

describe('BridgeClient ↔ real bridge', () => {
  it('handshakes, fetches the snapshot and receives thread events', async () => {
    const b = await bridge();
    const client = new BridgeClient({ url: `ws://127.0.0.1:${b.port}`, token: b.token, clientVersion: 'it' });
    cleanups.push(async () => client.close());
    const events: string[] = [];
    client.onEvent((e) => e.kind === 'thread.event' && events.push(e.event.type));
    client.connect();
    await waitFor(() => client.state.status === 'open');
    const snapshot = WorkspaceSnapshot.parse(await client.request({ cmd: 'workspace.snapshot' }));
    expect(snapshot.project).toBe('studio fixture');
    await client.request({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola' });
    await waitFor(() => events.includes('turn.end'));
  });

  it('fails with bad-token and does not retry', async () => {
    const b = await bridge();
    const states: ConnectionState[] = [];
    const client = new BridgeClient({ url: `ws://127.0.0.1:${b.port}`, token: 'wrong-token', clientVersion: 'it' });
    cleanups.push(async () => client.close());
    client.onState((s) => states.push(s));
    client.connect();
    await waitFor(() => client.state.status === 'failed');
    expect(client.state).toMatchObject({ status: 'failed', reason: 'bad-token' });
  });
});
