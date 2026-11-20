'use client';

import { ClaudeInventoryRefreshResult, ClaudeToolsGetResult, ClaudeToolsSetResult, type ClaudeInventory, type ClaudeToolsConfig } from '@sdd-studio/protocol';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BridgeError } from '@/lib/bridge/client';
import { useBridge } from '../../BridgeProvider';

export type ClaudeNotice = { kind: 'saved' } | { kind: 'conflict' | 'not-found' | 'bad-request' | 'error' | 'refresh-failed'; message: string };

export interface ClaudeToolsValue {
  supported: boolean;
  open: boolean;
  loaded: boolean;
  loadFailed: boolean;
  config: ClaudeToolsConfig | null;
  inventory: ClaudeInventory | null;
  browserMcpVersion: string;
  busy: boolean;
  refreshing: boolean;
  notice: ClaudeNotice | null;
  save: (next: ClaudeToolsConfig) => Promise<void>;
  refresh: () => Promise<void>;
  dismissNotice: () => void;
}

interface Loaded {
  config: ClaudeToolsConfig;
  revision: string;
  inventory: ClaudeInventory | null;
  browserMcpVersion: string;
}

const KNOWN_ERRORS = ['conflict', 'not-found', 'bad-request'] as const;

const errorNotice = (error: unknown): ClaudeNotice => {
  const code = error instanceof BridgeError ? error.code : 'error';
  const kind = (KNOWN_ERRORS as readonly string[]).includes(code) ? (code as (typeof KNOWN_ERRORS)[number]) : 'error';
  return { kind, message: error instanceof Error ? error.message : '' };
};

export function useClaudeTools(): ClaudeToolsValue {
  const { client, connection } = useBridge();
  const open = connection.status === 'open';
  const supported = open && client.supports('claude-tools');
  const [data, setData] = useState<Loaded | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<ClaudeNotice | null>(null);
  const run = useRef(0);

  const load = useCallback(async () => {
    const current = ++run.current;
    try {
      const parsed = ClaudeToolsGetResult.safeParse(await client.request({ cmd: 'claude.tools.get' }));
      if (current !== run.current) return;
      if (parsed.success) setData(parsed.data);
      setLoadFailed(!parsed.success);
    } catch {
      if (current === run.current) setLoadFailed(true);
    }
  }, [client]);

  useEffect(() => {
    if (!supported) return;
    void load();
    const stop = typeof client.onEvent === 'function' ? client.onEvent((event) => (event.kind === 'bot.event' && event.botKind === 'claude-tools.changed' ? void load() : undefined)) : undefined;
    return () => {
      run.current += 1;
      stop?.();
    };
  }, [client, supported, load]);

  const save = useCallback(
    async (next: ClaudeToolsConfig) => {
      if (!data) return;
      setBusy(true);
      setNotice(null);
      try {
        const parsed = ClaudeToolsSetResult.safeParse(await client.request({ cmd: 'claude.tools.set', config: next, expectedRevision: data.revision }));
        if (parsed.success) {
          setData((current) => (current ? { ...current, config: parsed.data.config, revision: parsed.data.revision } : current));
          setNotice({ kind: 'saved' });
        } else {
          await load();
        }
      } catch (error) {
        const failure = errorNotice(error);
        if (failure.kind === 'conflict' || failure.kind === 'not-found') await load();
        setNotice(failure);
      } finally {
        setBusy(false);
      }
    },
    [client, data, load],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setNotice(null);
    try {
      const parsed = ClaudeInventoryRefreshResult.safeParse(await client.request({ cmd: 'claude.inventory.refresh' }));
      if (parsed.success) setData((current) => (current ? { ...current, inventory: parsed.data.inventory } : current));
      else setNotice({ kind: 'refresh-failed', message: '' });
    } catch (error) {
      setNotice({ kind: 'refresh-failed', message: error instanceof Error ? error.message : '' });
    } finally {
      setRefreshing(false);
    }
  }, [client]);

  return useMemo(
    () => ({
      supported,
      open,
      loaded: data !== null,
      loadFailed,
      config: data?.config ?? null,
      inventory: data?.inventory ?? null,
      browserMcpVersion: data?.browserMcpVersion ?? '',
      busy,
      refreshing,
      notice,
      save,
      refresh,
      dismissNotice: () => setNotice(null),
    }),
    [supported, open, data, loadFailed, busy, refreshing, notice, save, refresh],
  );
}
