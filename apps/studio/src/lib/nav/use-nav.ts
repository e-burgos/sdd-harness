'use client';

import { createContext, createElement, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { z } from 'zod';
import { MODULE_IDS, type ModuleId } from './module-ids';

export const NAV_KEY_PREFIX = 'sdd-studio.nav.v1:';
export const LEGACY_VIEW_KEY = 'sdd-studio.active-view';

export const METRICS_VIEWS = ['dashboard', 'planning', 'costs', 'ecosystem', 'telemetry'] as const;
export const ARCHITECTURE_SECTIONS = ['db', 'api', 'components'] as const;
export const SPEC_TABS = ['summary', 'plan', 'tasks', 'documents', 'conversations'] as const;
export const ACTIVITY_ORIGINS = ['spec', 'fix', 'agent', 'tools'] as const;

export type MetricsView = (typeof METRICS_VIEWS)[number];
export type ArchitectureSection = (typeof ARCHITECTURE_SECTIONS)[number];
export type SpecTab = (typeof SPEC_TABS)[number];
export type ActivityOrigin = (typeof ACTIVITY_ORIGINS)[number];

const nullable = <T extends z.ZodType>(schema: T) => schema.nullable();

const HomeTarget = z.union([
  z.object({ kind: z.literal('channel'), channelId: z.string().max(256) }),
  z.object({ kind: z.literal('specs-channel') }),
  z.object({ kind: z.literal('inbox'), which: z.enum(['running', 'approvals']) }),
  z.object({ kind: z.literal('thread'), threadId: z.string().max(256) }),
]);

const PersistedNav = z.object({
  module: z.enum(MODULE_IDS),
  selection: z.object({
    specs: nullable(z.string().max(256)),
    fixes: nullable(z.string().max(256)),
    agents: nullable(z.string().max(256)),
    kit: nullable(z.string().max(512)),
    architecture: nullable(z.enum(ARCHITECTURE_SECTIONS)),
    metrics: nullable(z.enum(METRICS_VIEWS)),
  }),
  specTab: z.enum(SPEC_TABS),
  specCycle: nullable(z.string().max(64)),
  home: HomeTarget,
  filters: z.object({
    homeConversations: z.enum(['active', 'all']),
    specs: z.enum(['active', 'all', 'closed']),
    map: z.enum(['all', 'transversal', 'cycle', 'running', 'ready']),
    activity: z.array(z.enum(ACTIVITY_ORIGINS)).max(ACTIVITY_ORIGINS.length),
  }),
});

export type HomeTargetValue = z.infer<typeof HomeTarget>;
export type PersistedNavValue = z.infer<typeof PersistedNav>;

export interface NavState extends PersistedNavValue {
  queries: Partial<Record<ModuleId, string>>;
  newConversationSignal: number;
}

export type NavSelection = NavState['selection'];
export type NavFilters = NavState['filters'];

export interface NavActions {
  setModule(module: ModuleId): void;
  select<K extends keyof NavSelection>(module: K, value: NavSelection[K]): void;
  open<K extends keyof NavSelection>(module: K, value: NavSelection[K]): void;
  setSpecTab(tab: SpecTab): void;
  setSpecCycle(cycle: string | null): void;
  setHome(target: HomeTargetValue): void;
  openHome(target: HomeTargetValue): void;
  setFilter<K extends keyof NavFilters>(key: K, value: NavFilters[K]): void;
  setQuery(module: ModuleId, query: string): void;
  startNewConversation(): void;
  reconcile(known: KnownEntities): void;
}

export type NavStore = StoreApi<NavState & NavActions>;

export interface KnownEntities {
  specs: readonly string[];
  fixes: readonly string[];
  agents: readonly string[];
  threads?: readonly string[];
}

export const defaultNav = (): PersistedNavValue => ({
  module: 'home',
  selection: { specs: null, fixes: null, agents: null, kit: null, architecture: null, metrics: null },
  specTab: 'summary',
  specCycle: null,
  home: { kind: 'channel', channelId: 'general' },
  filters: { homeConversations: 'active', specs: 'active', map: 'all', activity: [...ACTIVITY_ORIGINS] },
});

const storageKey = (project: string) => `${NAV_KEY_PREFIX}${project}`;

const LEGACY_VIEW_TARGET: Record<string, { module: ModuleId; metrics?: MetricsView }> = {
  workspace: { module: 'home' },
  'agent-map': { module: 'map' },
  ecosystem: { module: 'metrics', metrics: 'ecosystem' },
  telemetry: { module: 'metrics', metrics: 'telemetry' },
};

function migrateLegacyView(): PersistedNavValue | null {
  try {
    const legacy = window.localStorage.getItem(LEGACY_VIEW_KEY);
    if (legacy === null) return null;
    window.localStorage.removeItem(LEGACY_VIEW_KEY);
    const target = LEGACY_VIEW_TARGET[legacy];
    if (!target) return null;
    const base = defaultNav();
    return { ...base, module: target.module, selection: { ...base.selection, metrics: target.metrics ?? null } };
  } catch {
    return null;
  }
}

export function readNav(project: string): PersistedNavValue {
  try {
    const raw = window.localStorage.getItem(storageKey(project));
    if (raw !== null) {
      const parsed = PersistedNav.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : defaultNav();
    }
  } catch {
    return defaultNav();
  }
  return migrateLegacyView() ?? defaultNav();
}

function writeNav(project: string, state: NavState): void {
  const { queries: _queries, newConversationSignal: _signal, ...persisted } = state;
  const value: PersistedNavValue = {
    module: persisted.module,
    selection: persisted.selection,
    specTab: persisted.specTab,
    specCycle: persisted.specCycle,
    home: persisted.home,
    filters: persisted.filters,
  };
  try {
    window.localStorage.setItem(storageKey(project), JSON.stringify(value));
  } catch {
    return;
  }
}

export function reconcileNav(value: PersistedNavValue, known: KnownEntities): PersistedNavValue {
  const keep = (id: string | null, list: readonly string[]) => (id !== null && list.includes(id) ? id : null);
  const home =
    value.home.kind === 'thread' && known.threads && !known.threads.includes(value.home.threadId)
      ? defaultNav().home
      : value.home;
  const specs = keep(value.selection.specs, known.specs);
  return {
    ...value,
    selection: {
      ...value.selection,
      specs,
      fixes: keep(value.selection.fixes, known.fixes),
      agents: keep(value.selection.agents, known.agents),
    },
    specCycle: specs === null ? null : value.specCycle,
    home,
  };
}

export function createNavStore(project: string, initial: PersistedNavValue = readNav(project)): NavStore {
  const store = createStore<NavState & NavActions>()((set) => ({
    ...initial,
    queries: {},
    newConversationSignal: 0,
    setModule: (module) => set({ module }),
    select: (module, value) => set((s) => ({ selection: { ...s.selection, [module]: value } })),
    open: (module, value) => set((s) => ({ module: module as ModuleId, selection: { ...s.selection, [module]: value } })),
    setSpecTab: (specTab) => set({ specTab }),
    setSpecCycle: (specCycle) => set({ specCycle }),
    setHome: (home) => set({ home }),
    openHome: (home) => set({ module: 'home', home }),
    setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
    setQuery: (module, query) => set((s) => ({ queries: { ...s.queries, [module]: query } })),
    startNewConversation: () =>
      set((s) => ({
        module: 'home',
        home: s.home.kind === 'channel' ? s.home : defaultNav().home,
        newConversationSignal: s.newConversationSignal + 1,
      })),
    reconcile: (known) =>
      set((s) => {
        const next = reconcileNav(s, known);
        return { selection: next.selection, specCycle: next.specCycle, home: next.home };
      }),
  }));
  store.subscribe((state) => writeNav(project, state));
  return store;
}

const NavContext = createContext<NavStore | null>(null);

export function NavProvider({ project, known, children }: { project: string; known?: KnownEntities | null; children: ReactNode }) {
  const store = useMemo(() => createNavStore(project), [project]);
  const reconcile = store.getState().reconcile;
  const knownKey = known ? `${known.specs.join('|')}#${known.fixes.join('|')}#${known.agents.join('|')}` : null;
  useEffect(() => {
    if (known && known.specs.length + known.fixes.length + known.agents.length > 0) reconcile(known);
  }, [knownKey, reconcile]);
  return createElement(NavContext.Provider, { value: store }, children);
}

export function useNavStore(): NavStore {
  const store = useContext(NavContext);
  if (!store) throw new Error('useNav must be used within NavProvider');
  return store;
}

export function useNav<T>(selector: (state: NavState & NavActions) => T): T {
  return useStore(useNavStore(), selector);
}
