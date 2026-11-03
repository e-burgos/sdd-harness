'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { KitIndex } from '@sdd-studio/protocol';
import { z } from 'zod';
import { BridgeError } from '@/lib/bridge/client';
import { useBridge } from '../../BridgeProvider';
import {
  REGISTRY_PATH,
  collectComponents,
  collectEndpoints,
  collectTables,
  parseRegistry,
  type ComponentEntry,
  type EndpointEntry,
  type RegistryKey,
  type TableEntry,
} from './architecture-model';

const FileResult = z.object({ path: z.string(), content: z.string() });

export type RegistryFailure = 'missing' | 'invalid' | 'failed';

export type RegistryState<T> = { status: 'loading' } | { status: 'error'; reason: RegistryFailure } | { status: 'ready'; items: T[] };

export interface Registries {
  db: RegistryState<TableEntry>;
  api: RegistryState<EndpointEntry>;
  components: RegistryState<ComponentEntry>;
  reload: () => void;
}

const NOOP = () => undefined;

const LOADING: Registries = { db: { status: 'loading' }, api: { status: 'loading' }, components: { status: 'loading' }, reload: NOOP };

const RegistriesContext = createContext<Registries>(LOADING);

const COLLECT = { db: collectTables, api: collectEndpoints, components: collectComponents } as const;

type Request = (cmd: { cmd: 'workspace.readFile'; path: string }) => Promise<unknown>;

async function loadRegistry<K extends RegistryKey>(request: Request, key: K) {
  let content: string;
  try {
    content = FileResult.parse(await request({ cmd: 'workspace.readFile', path: REGISTRY_PATH[key] })).content;
  } catch (error) {
    return { status: 'error', reason: error instanceof BridgeError && error.code === 'not-found' ? 'missing' : 'failed' } as const;
  }
  const registry = parseRegistry(content);
  if (registry === null) return { status: 'error', reason: 'invalid' } as const;
  return { status: 'ready', items: COLLECT[key](registry) } as const;
}

const KEYS = Object.keys(REGISTRY_PATH) as RegistryKey[];

type Fingerprints = Partial<Record<RegistryKey, string>>;

function fingerprintsOf(data: unknown): Fingerprints | null {
  const parsed = KitIndex.safeParse(data);
  if (!parsed.success || parsed.data.truncated) return null;
  const byPath = new Map(parsed.data.entries.filter((entry) => entry.section === 'registries').map((entry) => [entry.path, `${entry.size}:${entry.mtime}`]));
  return Object.fromEntries(KEYS.flatMap((key) => (byPath.has(REGISTRY_PATH[key]) ? [[key, byPath.get(REGISTRY_PATH[key])]] : []))) as Fingerprints;
}

const changedKeys = (before: Fingerprints | null, after: Fingerprints): RegistryKey[] =>
  before === null ? KEYS : KEYS.filter((key) => after[key] === undefined || before[key] !== after[key]);

export function RegistriesProvider({ children }: { children: ReactNode }) {
  const { client, connection } = useBridge();
  const open = connection.status === 'open';
  const indexed = open && client.supports('kit-index');
  const [state, setState] = useState<Omit<Registries, 'reload'>>(LOADING);
  const runs = useRef<Record<RegistryKey, number>>({ db: 0, api: 0, components: 0 });
  const fingerprints = useRef<Fingerprints | null>(null);

  const loadKeys = useCallback(
    (keys: RegistryKey[]) => {
      const request: Request = (command) => client.request(command);
      for (const key of keys) {
        const current = ++runs.current[key];
        loadRegistry(request, key).then((next) => {
          if (current === runs.current[key]) setState((previous) => ({ ...previous, [key]: next }));
        });
      }
    },
    [client],
  );

  const load = useCallback(() => {
    fingerprints.current = null;
    loadKeys(KEYS);
    if (indexed) client.request({ cmd: 'kit.index' }).then((data) => (fingerprints.current ??= fingerprintsOf(data)), () => undefined);
  }, [client, indexed, loadKeys]);

  const reloadChanged = useCallback(() => {
    client.request({ cmd: 'kit.index' }).then(
      (data) => {
        const after = fingerprintsOf(data);
        if (after === null) return loadKeys(KEYS);
        const keys = changedKeys(fingerprints.current, after);
        fingerprints.current = after;
        if (keys.length > 0) loadKeys(keys);
      },
      () => loadKeys(KEYS),
    );
  }, [client, loadKeys]);

  useEffect(() => {
    if (!open) return;
    load();
    const stop =
      typeof client.onEvent === 'function'
        ? client.onEvent((event) => {
            if (!indexed) return event.kind === 'workspace.changed' || event.kind === 'kit.changed' ? load() : undefined;
            if (event.kind === 'kit.changed' && event.sections.includes('registries')) reloadChanged();
          })
        : undefined;
    return () => {
      for (const key of KEYS) runs.current[key] += 1;
      stop?.();
    };
  }, [client, open, indexed, load, reloadChanged]);

  const value = useMemo<Registries>(() => ({ ...state, reload: load }), [state, load]);
  return <RegistriesContext.Provider value={value}>{children}</RegistriesContext.Provider>;
}

export const useRegistries = (): Registries => useContext(RegistriesContext);
