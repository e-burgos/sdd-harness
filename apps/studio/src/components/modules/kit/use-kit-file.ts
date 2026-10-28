'use client';

import { useEffect, useState } from 'react';
import { BridgeError } from '@/lib/bridge/client';
import { useBridge } from '../../BridgeProvider';

export type KitFileFailure = 'not-found' | 'bad-path' | 'too-large' | 'not-connected' | 'timeout' | 'internal';

export type KitFileState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; reason: KitFileFailure | null } | { status: 'ready'; content: string };

type Loaded = { path: string; content: string | null; reason: KitFileFailure | null };

const KNOWN_FAILURES: readonly KitFileFailure[] = ['not-found', 'bad-path', 'too-large', 'not-connected', 'timeout', 'internal'];

export function failureReasonOf(error: unknown): KitFileFailure | null {
  if (!(error instanceof BridgeError)) return null;
  if (error.code === 'frame-too-large' || (error.code === 'bad-request' && /too large/i.test(error.message))) return 'too-large';
  return (KNOWN_FAILURES as readonly string[]).includes(error.code) ? (error.code as KitFileFailure) : null;
}

export function useKitFile(path: string | null, revision: string | null): KitFileState {
  const { client } = useBridge();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    client.request({ cmd: 'workspace.readFile', path }).then(
      (data) => {
        const content = (data as { content?: unknown } | null)?.content;
        if (!cancelled) setLoaded({ path, content: typeof content === 'string' ? content : null, reason: null });
      },
      (error: unknown) => {
        if (!cancelled) setLoaded({ path, content: null, reason: failureReasonOf(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, path, revision]);
  if (path === null) return { status: 'idle' };
  if (loaded === null || loaded.path !== path) return { status: 'loading' };
  return loaded.content === null ? { status: 'error', reason: loaded.reason } : { status: 'ready', content: loaded.content };
}
