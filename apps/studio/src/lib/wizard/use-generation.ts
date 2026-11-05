'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GENERATION_BUFFER_BYTES, GenerationSnapshot, GenerationState, type GenerationOutputChunk, type ServerEvent } from '@sdd-studio/protocol';
import {
  clearGenerationPointer,
  loadGenerationPointer,
  saveGenerationPointer,
  sessionStore,
  type StorageLike,
} from './persist';
import { errorCode, errorMessage, type WizardClient } from './wizard-client';

export interface GenerationView {
  generationId: string | null;
  generation: GenerationState | null;
  target: string | null;
  output: GenerationOutputChunk[];
  outputVersion: number;
  truncatedBefore: boolean;
  connection: 'live' | 'lost';
  unknown: boolean;
  error: string | null;
}

export interface GenerationControls extends GenerationView {
  adopt(generation: GenerationState): void;
  attach(generationId: string, target: string): Promise<void>;
  resync(): Promise<void>;
  cancel(): Promise<void>;
  dismiss(): void;
}

interface Tracker {
  id: string | null;
  target: string | null;
  lastSeq: number;
  lastStatus: string;
  output: GenerationOutputChunk[];
  outputBytes: number;
  outputVersion: number;
  truncatedBefore: boolean;
  generation: GenerationState | null;
  syncing: boolean;
  again: boolean;
  unknown: boolean;
}

const EMPTY_VIEW: GenerationView = {
  generationId: null,
  generation: null,
  target: null,
  output: [],
  outputVersion: 0,
  truncatedBefore: false,
  connection: 'live',
  unknown: false,
  error: null,
};

const TRIM_TO_FRACTION = 0.75;
const LOST_CODES = new Set(['not-connected', 'disconnected', 'timeout']);

export function useGeneration(client: WizardClient, storage: StorageLike | null = sessionStore()): GenerationControls {
  const [view, setView] = useState<GenerationView>(() => ({
    ...EMPTY_VIEW,
    connection: client.state.status === 'open' ? 'live' : 'lost',
  }));
  const tracker = useRef<Tracker>({
    id: null,
    target: null,
    lastSeq: 0,
    lastStatus: 'running',
    output: [],
    outputBytes: 0,
    outputVersion: 0,
    truncatedBefore: false,
    generation: null,
    syncing: false,
    again: false,
    unknown: false,
  });
  const alive = useRef(true);
  const connection = useRef<'live' | 'lost'>(client.state.status === 'open' ? 'live' : 'lost');
  const error = useRef<string | null>(null);

  const publish = useCallback(() => {
    if (!alive.current) return;
    const t = tracker.current;
    setView({
      generationId: t.id,
      generation: t.generation,
      target: t.target,
      output: t.output,
      outputVersion: t.outputVersion,
      truncatedBefore: t.truncatedBefore,
      connection: connection.current,
      unknown: t.unknown,
      error: error.current,
    });
  }, []);

  const persist = useCallback(() => {
    const t = tracker.current;
    if (t.id === null || t.target === null) return;
    saveGenerationPointer({ generationId: t.id, target: t.target, lastSeq: t.lastSeq, lastStatus: t.lastStatus }, storage);
  }, [storage]);

  const setGeneration = useCallback(
    (generation: GenerationState) => {
      const t = tracker.current;
      t.generation = generation;
      t.lastStatus = generation.status;
      t.unknown = false;
      persist();
    },
    [persist],
  );

  const appendChunks = useCallback((chunks: GenerationOutputChunk[]) => {
    const t = tracker.current;
    const fresh = chunks.filter((chunk) => chunk.seq > t.lastSeq).sort((a, b) => a.seq - b.seq);
    if (fresh.length === 0) return;
    for (const chunk of fresh) {
      t.output.push(chunk);
      t.outputBytes += chunk.chunk.length;
    }
    t.lastSeq = fresh[fresh.length - 1].seq;
    if (t.outputBytes > GENERATION_BUFFER_BYTES) {
      const target = GENERATION_BUFFER_BYTES * TRIM_TO_FRACTION;
      let dropCount = 0;
      while (dropCount < t.output.length - 1 && t.outputBytes > target) t.outputBytes -= t.output[dropCount++].chunk.length;
      t.output.splice(0, dropCount);
      t.truncatedBefore = true;
    }
    t.outputVersion += 1;
  }, []);

  const resync = useCallback(async (): Promise<void> => {
    const t = tracker.current;
    if (t.id === null) return;
    if (t.syncing) {
      t.again = true;
      return;
    }
    t.syncing = true;
    try {
      do {
        t.again = false;
        let more = true;
        while (more && t.id !== null) {
          const snapshot = GenerationSnapshot.parse(
            await client.request({ cmd: 'wizard.generation.get', generationId: t.id, sinceSeq: t.lastSeq }),
          );
          if (snapshot.generation) setGeneration(snapshot.generation);
          if (snapshot.truncatedBefore) t.truncatedBefore = true;
          appendChunks(snapshot.output);
          more = snapshot.hasMore && snapshot.output.length > 0;
        }
        connection.current = 'live';
        error.current = null;
        persist();
      } while (t.again);
    } catch (failure) {
      const code = errorCode(failure);
      if (code === 'not-found') {
        connection.current = 'live';
        if (t.lastStatus === 'running') t.unknown = true;
      } else if (code !== null && LOST_CODES.has(code)) {
        connection.current = 'lost';
      } else {
        error.current = errorMessage(failure);
      }
    } finally {
      t.syncing = false;
      publish();
    }
  }, [client, setGeneration, appendChunks, persist, publish]);

  const begin = useCallback((id: string, target: string, lastStatus: string) => {
    tracker.current = {
      id,
      target,
      lastSeq: 0,
      lastStatus,
      output: [],
      outputBytes: 0,
      outputVersion: 0,
      truncatedBefore: false,
      generation: null,
      syncing: false,
      again: false,
      unknown: false,
    };
    error.current = null;
  }, []);

  const attach = useCallback(
    async (generationId: string, target: string) => {
      begin(generationId, target, 'running');
      persist();
      publish();
      await resync();
    },
    [begin, persist, publish, resync],
  );

  const adopt = useCallback(
    (generation: GenerationState) => {
      begin(generation.id, generation.target, generation.status);
      setGeneration(generation);
      publish();
    },
    [begin, setGeneration, publish],
  );

  const onEvent = useCallback(
    (event: ServerEvent) => {
      const t = tracker.current;
      if (t.id === null) return;
      if (event.kind === 'generation.status' && event.generation.id === t.id) {
        setGeneration(event.generation);
        publish();
        return;
      }
      if (event.kind !== 'generation.output' || event.generationId !== t.id) return;
      if (event.seq <= t.lastSeq) return;
      if (event.seq !== t.lastSeq + 1) {
        void resync();
        return;
      }
      appendChunks([{ seq: event.seq, stream: event.stream, chunk: event.chunk }]);
      persist();
      publish();
    },
    [setGeneration, appendChunks, persist, publish, resync],
  );

  useEffect(() => {
    alive.current = true;
    const offEvent = client.onEvent(onEvent);
    const offState = client.onState((state) => {
      if (state.status === 'open') {
        connection.current = 'live';
        publish();
        void resync();
      } else {
        connection.current = 'lost';
        publish();
      }
    });
    const pointer = loadGenerationPointer(storage);
    if (pointer && tracker.current.id === null) {
      begin(pointer.generationId, pointer.target, pointer.lastStatus);
      publish();
      if (client.state.status === 'open') void resync();
    }
    return () => {
      alive.current = false;
      offEvent();
      offState();
    };
  }, [client, storage, onEvent, begin, publish, resync]);

  const cancel = useCallback(async () => {
    const id = tracker.current.id;
    if (id === null) return;
    try {
      setGeneration(GenerationState.parse(await client.request({ cmd: 'wizard.generation.cancel', generationId: id })));
      error.current = null;
    } catch (failure) {
      error.current = errorMessage(failure);
    }
    publish();
  }, [client, setGeneration, publish]);

  const dismiss = useCallback(() => {
    tracker.current = {
      id: null,
      target: null,
      lastSeq: 0,
      lastStatus: 'running',
      output: [],
      outputBytes: 0,
      outputVersion: 0,
      truncatedBefore: false,
      generation: null,
      syncing: false,
      again: false,
      unknown: false,
    };
    error.current = null;
    clearGenerationPointer(storage);
    publish();
  }, [storage, publish]);

  return { ...view, adopt, attach, resync, cancel, dismiss };
}
