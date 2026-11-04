'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WizardCatalogResult } from '@sdd-studio/protocol';
import { errorMessage, type WizardClient } from './wizard-client';

export interface CatalogState {
  status: 'loading' | 'ready' | 'error';
  data: WizardCatalogResult | null;
  error: string | null;
}

export interface CatalogControls extends CatalogState {
  reload(): void;
}

export function useCatalog(client: WizardClient): CatalogControls {
  const [state, setState] = useState<CatalogState>({ status: 'loading', data: null, error: null });
  const alive = useRef(true);
  const ready = useRef(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState((previous) => (previous.data ? previous : { status: 'loading', data: null, error: null }));
    try {
      const data = WizardCatalogResult.parse(await client.request({ cmd: 'wizard.catalog' }));
      ready.current = true;
      if (alive.current) setState({ status: 'ready', data, error: null });
    } catch (error) {
      if (alive.current && !ready.current) setState({ status: 'error', data: null, error: errorMessage(error) });
    } finally {
      inFlight.current = false;
    }
  }, [client]);

  useEffect(() => {
    alive.current = true;
    ready.current = false;
    if (client.state.status === 'open') void load();
    else setState({ status: 'loading', data: null, error: null });
    const off = client.onState((next) => {
      if (next.status === 'open' && !ready.current) void load();
    });
    return () => {
      alive.current = false;
      off();
    };
  }, [client, load]);

  const reload = useCallback(() => {
    ready.current = false;
    void load();
  }, [load]);

  return { ...state, reload };
}
