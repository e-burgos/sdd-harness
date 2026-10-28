'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

export function RegistriesProvider({ children }: { children: ReactNode }) {
  const { client, connection } = useBridge();
  const open = connection.status === 'open';
  const [state, setState] = useState<Omit<Registries, 'reload'>>(LOADING);
  const run = useRef(0);

  const load = useCallback(() => {
    const current = ++run.current;
    const request: Request = (command) => client.request(command);
    Promise.all([loadRegistry(request, 'db'), loadRegistry(request, 'api'), loadRegistry(request, 'components')]).then(([db, api, components]) => {
      if (current === run.current) setState({ db, api, components } as Omit<Registries, 'reload'>);
    });
  }, [client]);

  useEffect(() => {
    if (!open) return;
    load();
    const stop =
      typeof client.onEvent === 'function'
        ? client.onEvent((event) => (event.kind === 'workspace.changed' || event.kind === 'kit.changed' ? load() : undefined))
        : undefined;
    return () => {
      run.current += 1;
      stop?.();
    };
  }, [client, open, load]);

  const value = useMemo<Registries>(() => ({ ...state, reload: load }), [state, load]);
  return <RegistriesContext.Provider value={value}>{children}</RegistriesContext.Provider>;
}

export const useRegistries = (): Registries => useContext(RegistriesContext);
