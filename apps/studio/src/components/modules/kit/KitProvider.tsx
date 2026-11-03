'use client';

import { BotEvent, KitIndex } from '@sdd-studio/protocol';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBridge } from '../../BridgeProvider';

export type KitIndexStatus = 'loading' | 'ready' | 'error' | 'unsupported';

export interface KitIndexValue {
  status: KitIndexStatus;
  index: KitIndex | null;
  reload: () => void;
}

const NOT_MOUNTED: KitIndexValue = { status: 'loading', index: null, reload: () => undefined };

const KitIndexContext = createContext<KitIndexValue | null>(null);

export function KitProvider({ children }: { children: ReactNode }) {
  const { client, store, connection } = useBridge();
  const open = connection.status === 'open';
  const supported = open && client.supports('kit-index');
  const unsupported = open && !supported;
  const [index, setIndex] = useState<KitIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const run = useRef(0);

  const load = useCallback(() => {
    const current = ++run.current;
    client.request({ cmd: 'kit.index' }).then(
      (data) => {
        if (current !== run.current) return;
        const parsed = KitIndex.safeParse(data);
        if (parsed.success) setIndex(parsed.data);
        setFailed(!parsed.success);
      },
      () => {
        if (current === run.current) setFailed(true);
      },
    );
  }, [client]);

  useEffect(() => {
    if (!supported) return;
    load();
    const stop = typeof client.onEvent === 'function' ? client.onEvent((event) => (event.kind === 'kit.changed' ? load() : undefined)) : undefined;
    return () => {
      run.current += 1;
      stop?.();
    };
  }, [client, supported, load]);

  const toolsSupported = open && client.supports('kit-tools');
  useEffect(() => {
    if (!toolsSupported) return;
    let cancelled = false;
    client.request({ cmd: 'channel.botHistory', channelId: 'general', limit: 100, includeKitEvents: true }).then(
      (data) => {
        const parsed = BotEvent.array().safeParse(data);
        if (!cancelled && parsed.success) store.getState().setBotHistory('general', parsed.data);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [client, store, toolsSupported]);

  const value = useMemo<KitIndexValue>(
    () => ({ status: unsupported ? 'unsupported' : index ? 'ready' : failed ? 'error' : 'loading', index, reload: load }),
    [unsupported, index, failed, load],
  );
  return <KitIndexContext.Provider value={value}>{children}</KitIndexContext.Provider>;
}

export const useKitIndex = (): KitIndexValue => useContext(KitIndexContext) ?? NOT_MOUNTED;
