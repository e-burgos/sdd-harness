import { act, renderHook, waitFor } from '@testing-library/react';
import type { GenerationSnapshot, GenerationState } from '@sdd-studio/protocol';
import { WIZARD_GENERATION_KEY, loadGenerationPointer, saveGenerationPointer } from '../persist';
import { useGeneration } from '../use-generation';
import { BridgeFailure, fakeClient, memoryStorage } from './fake-client';

const STAGES = ['prepare', 'scaffold', 'install', 'generate', 'validate', 'build'] as const;

const generation = (patch: Partial<GenerationState> = {}): GenerationState => ({
  id: 'g1',
  target: '/tmp/p',
  projectName: 'p',
  mode: 'nx',
  cliVersion: '0.17.0',
  argv: ['harness', 'init'],
  status: 'running',
  stages: STAGES.map((stage) => ({ stage, status: 'pending' as const })),
  gate: { validate: 'pending', build: 'pending' },
  failure: null,
  exitCode: null,
  hasSdd: false,
  startedAt: '2026-11-04T10:00:00Z',
  finishedAt: null,
  lastSeq: 0,
  ...patch,
});

const chunk = (seq: number, text = `line ${seq}`) => ({ seq, stream: 'stdout' as const, chunk: text });
const snapshot = (patch: Partial<GenerationSnapshot> = {}): GenerationSnapshot => ({
  generation: generation(),
  output: [],
  truncatedBefore: false,
  hasMore: false,
  ...patch,
});
const outputEvent = (seq: number, id = 'g1') => ({ kind: 'generation.output' as const, generationId: id, seq, stream: 'stdout' as const, chunk: `line ${seq}` });
const open = { status: 'open', welcome: {} as never } as const;

describe('useGeneration', () => {
  it('adopts a started generation and appends contiguous output in order', () => {
    const storage = memoryStorage();
    const fake = fakeClient();
    const { result } = renderHook(() => useGeneration(fake.client, storage));
    act(() => result.current.adopt(generation()));
    act(() => fake.emit(outputEvent(1)));
    act(() => fake.emit(outputEvent(2)));
    expect(result.current.output.map((c) => c.seq)).toEqual([1, 2]);
    expect(result.current.generation?.status).toBe('running');
    expect(loadGenerationPointer(storage)).toMatchObject({ generationId: 'g1', target: '/tmp/p', lastSeq: 2 });
    expect(fake.requests).toEqual([]);
  });

  it('ignores duplicates and events of another generation', () => {
    const fake = fakeClient();
    const { result } = renderHook(() => useGeneration(fake.client, memoryStorage()));
    act(() => result.current.adopt(generation()));
    act(() => fake.emit(outputEvent(1)));
    act(() => fake.emit(outputEvent(1)));
    act(() => fake.emit(outputEvent(1, 'other')));
    act(() => fake.emit({ kind: 'generation.status', generation: generation({ id: 'other', status: 'failed' }) }));
    expect(result.current.output).toHaveLength(1);
    expect(result.current.generation?.status).toBe('running');
  });

  it('resynchronises by seq when an output event leaves a gap', async () => {
    const fake = fakeClient((cmd) => {
      expect(cmd).toMatchObject({ cmd: 'wizard.generation.get', generationId: 'g1', sinceSeq: 1 });
      return snapshot({ output: [chunk(2), chunk(3), chunk(4)] });
    });
    const { result } = renderHook(() => useGeneration(fake.client, memoryStorage()));
    act(() => result.current.adopt(generation()));
    act(() => fake.emit(outputEvent(1)));
    act(() => fake.emit(outputEvent(4)));
    await waitFor(() => expect(result.current.output.map((c) => c.seq)).toEqual([1, 2, 3, 4]));
    expect(fake.requests).toHaveLength(1);
  });

  it('pages through hasMore and never duplicates chunks', async () => {
    const answers = [
      snapshot({ output: [chunk(1), chunk(2)], hasMore: true }),
      snapshot({ output: [chunk(3)], hasMore: false, truncatedBefore: true }),
    ];
    const fake = fakeClient(() => answers.shift());
    const { result } = renderHook(() => useGeneration(fake.client, memoryStorage()));
    await act(async () => result.current.attach('g1', '/tmp/p'));
    expect(result.current.output.map((c) => c.seq)).toEqual([1, 2, 3]);
    expect(result.current.truncatedBefore).toBe(true);
    expect(fake.requests.map((r) => r.sinceSeq)).toEqual([0, 2]);
  });

  it('applies status events and cancels through the bridge', async () => {
    const fake = fakeClient((cmd) => (cmd.cmd === 'wizard.generation.cancel' ? generation({ status: 'cancelled' }) : null));
    const { result } = renderHook(() => useGeneration(fake.client, memoryStorage()));
    act(() => result.current.adopt(generation()));
    act(() => fake.emit({ kind: 'generation.status', generation: generation({ status: 'succeeded', hasSdd: true }) }));
    expect(result.current.generation).toMatchObject({ status: 'succeeded', hasSdd: true });
    await act(async () => result.current.cancel());
    expect(fake.requests).toEqual([{ cmd: 'wizard.generation.cancel', generationId: 'g1' }]);
    expect(result.current.generation?.status).toBe('cancelled');
  });

  it('marks the connection lost and resynchronises when it reopens', async () => {
    const fake = fakeClient(() => snapshot({ output: [chunk(1), chunk(2)] }));
    const { result } = renderHook(() => useGeneration(fake.client, memoryStorage()));
    act(() => result.current.adopt(generation()));
    act(() => fake.setState({ status: 'reconnecting', attempt: 1, delayMs: 500 }));
    expect(result.current.connection).toBe('lost');
    expect(result.current.generation?.status).toBe('running');
    act(() => fake.setState(open));
    await waitFor(() => expect(result.current.output.map((c) => c.seq)).toEqual([1, 2]));
    expect(result.current.connection).toBe('live');
  });

  it('flags the generation as unknown when the bridge no longer knows it and it was running', async () => {
    const fake = fakeClient(() => {
      throw new BridgeFailure('not-found', 'unknown generation');
    });
    const { result } = renderHook(() => useGeneration(fake.client, memoryStorage()));
    act(() => result.current.adopt(generation()));
    await act(async () => result.current.resync());
    expect(result.current.unknown).toBe(true);
    expect(result.current.target).toBe('/tmp/p');
    expect(result.current.connection).toBe('live');
  });

  it('keeps a finished generation as known when the bridge restarted', async () => {
    const fake = fakeClient(() => {
      throw new BridgeFailure('not-found');
    });
    const { result } = renderHook(() => useGeneration(fake.client, memoryStorage()));
    act(() => result.current.adopt(generation({ status: 'succeeded' })));
    await act(async () => result.current.resync());
    expect(result.current.unknown).toBe(false);
  });

  it('treats a dropped request as a lost connection, not as a verdict', async () => {
    const fake = fakeClient(() => {
      throw new BridgeFailure('disconnected');
    });
    const { result } = renderHook(() => useGeneration(fake.client, memoryStorage()));
    act(() => result.current.adopt(generation()));
    await act(async () => result.current.resync());
    expect(result.current.connection).toBe('lost');
    expect(result.current.unknown).toBe(false);
  });

  it('restores the generation from the stored pointer on mount', async () => {
    const storage = memoryStorage();
    saveGenerationPointer({ generationId: 'g1', target: '/tmp/p', lastSeq: 3, lastStatus: 'running' }, storage);
    const fake = fakeClient(() => snapshot({ generation: generation({ status: 'succeeded', hasSdd: true }), output: [chunk(1), chunk(2), chunk(3)] }));
    const { result } = renderHook(() => useGeneration(fake.client, storage));
    await waitFor(() => expect(result.current.generation?.status).toBe('succeeded'));
    expect(result.current.output).toHaveLength(3);
    expect(fake.requests[0]).toMatchObject({ generationId: 'g1', sinceSeq: 0 });
  });

  it('reports unknown after a reload when the bridge restarted mid-run', async () => {
    const storage = memoryStorage();
    saveGenerationPointer({ generationId: 'g1', target: '/tmp/p', lastSeq: 3, lastStatus: 'running' }, storage);
    const fake = fakeClient(() => {
      throw new BridgeFailure('not-found');
    });
    const { result } = renderHook(() => useGeneration(fake.client, storage));
    await waitFor(() => expect(result.current.unknown).toBe(true));
    expect(result.current.target).toBe('/tmp/p');
  });

  it('dismiss clears the pointer and the view', () => {
    const storage = memoryStorage();
    const fake = fakeClient();
    const { result } = renderHook(() => useGeneration(fake.client, storage));
    act(() => result.current.adopt(generation()));
    expect(storage.getItem(WIZARD_GENERATION_KEY)).not.toBeNull();
    act(() => result.current.dismiss());
    expect(storage.getItem(WIZARD_GENERATION_KEY)).toBeNull();
    expect(result.current.generation).toBeNull();
    expect(result.current.output).toEqual([]);
  });

  it('unsubscribes on unmount', () => {
    const fake = fakeClient();
    const { unmount } = renderHook(() => useGeneration(fake.client, memoryStorage()));
    expect(fake.listeners()).toEqual({ events: 1, states: 1 });
    unmount();
    expect(fake.listeners()).toEqual({ events: 0, states: 0 });
  });
});
