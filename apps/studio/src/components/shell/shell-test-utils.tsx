import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Presence, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { NavProvider } from '@/lib/nav/use-nav';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';

export const shellSnapshot: WorkspaceSnapshot = {
  project: 'fixture-project',
  profile: 'team',
  kitVersion: '0.17.0',
  specs: [{ id: 'spec-dev-001-pagos', title: 'Pagos', status: 'in-progress', folder: 'sdd/specs/spec-dev-001-pagos', module: 'pagos', app: 'api', dependsOn: [] }],
  cycles: [{ specId: 'spec-dev-001-pagos', cycle: 'cycle-01', status: 'in-progress', flow: 'full', apps: ['api'], tasks: [], tasksTotal: 2, tasksDone: 1 }],
  fixes: [{ id: 'FIX-dev-001', title: 'Arreglo', status: 'pending', severity: 'high', specId: null, createdAt: null, closedAt: null }],
  agents: [{ id: 'sdd-planner', description: 'Planner', model: 'sonnet', source: 'sdd', path: 'sdd/agents/sdd-planner.agent.md' }],
  skills: [],
  gateMode: 'block',
  pricing: null,
  stale: [],
};

export function bridgeValue(overrides: Partial<BridgeContextValue> = {}, snapshot: WorkspaceSnapshot | null = shellSnapshot) {
  const store = createStudioStore();
  if (snapshot) store.getState().setSnapshot(snapshot);
  store.getState().setPresence([] as Presence[]);
  const value = {
    client: { request: async () => ({}), supports: () => false },
    store,
    connection: { status: 'open' },
    pairing: { port: 3100, token: 'secret' },
    authMode: 'local',
    apiKeySource: null,
    setApiKey: async () => undefined,
    authPreference: null,
    setAuthPreference: async () => undefined,
    syncError: null,
    retrySync: () => undefined,
    ...overrides,
  } as unknown as BridgeContextValue;
  return value;
}

export function renderShell(ui: ReactNode, options: { lang?: 'es' | 'en'; value?: BridgeContextValue; project?: string } = {}) {
  const value = options.value ?? bridgeValue();
  return render(
    <I18nProvider initial={options.lang ?? 'es'}>
      <BridgeContext.Provider value={value}>
        <NavProvider project={options.project ?? 'fixture-project'}>{ui}</NavProvider>
      </BridgeContext.Provider>
    </I18nProvider>,
  );
}
