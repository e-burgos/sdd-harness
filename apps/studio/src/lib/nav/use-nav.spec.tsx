import { act, render } from '@testing-library/react';
import { LEGACY_VIEW_KEY, NAV_KEY_PREFIX, NavProvider, createNavStore, defaultNav, readNav, reconcileNav, useNav } from './use-nav';

const key = (project: string) => `${NAV_KEY_PREFIX}${project}`;

describe('navigation store', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts on Home with the documented defaults', () => {
    const store = createNavStore('p');
    const state = store.getState();
    expect(state.module).toBe('home');
    expect(state.home).toEqual({ kind: 'channel', channelId: 'general' });
    expect(state.filters.activity).toEqual([]);
    expect(state.selection).toEqual({ specs: null, fixes: null, agents: null, kit: null, architecture: null, metrics: null });
  });

  it('persists the activity filter per project', () => {
    createNavStore('alpha').getState().setFilter('activity', ['approval', 'tools']);
    expect(createNavStore('alpha').getState().filters.activity).toEqual(['approval', 'tools']);
  });

  it('migrates the stored legacy activity filter without losing the rest of the state', () => {
    const base = defaultNav();
    window.localStorage.setItem(key('p'), JSON.stringify({ ...base, module: 'kit', filters: { ...base.filters, activity: ['spec', 'fix', 'agent', 'tools'] } }));
    expect(readNav('p').filters.activity).toEqual([]);
    expect(readNav('p').module).toBe('kit');
    window.localStorage.setItem(key('p'), JSON.stringify({ ...base, filters: { ...base.filters, activity: ['fix', 'agent', 'bogus', 'fix'] } }));
    expect(readNav('p').filters.activity).toEqual(['fix']);
  });

  it('persists module and selection per project, never the search text', () => {
    const store = createNavStore('alpha');
    store.getState().open('specs', 'spec-1');
    store.getState().setQuery('specs', 'pagos');
    store.getState().setSpecTab('plan');
    const restored = createNavStore('alpha').getState();
    expect(restored.module).toBe('specs');
    expect(restored.selection.specs).toBe('spec-1');
    expect(restored.specTab).toBe('plan');
    expect(restored.queries).toEqual({});
    expect(window.localStorage.getItem(key('alpha'))).not.toContain('pagos');
    expect(createNavStore('beta').getState().module).toBe('home');
  });

  it('keeps one search text per module during the session', () => {
    const store = createNavStore('p');
    store.getState().setQuery('specs', 'uno');
    store.getState().setQuery('fixes', 'dos');
    store.getState().setModule('fixes');
    store.getState().setModule('specs');
    expect(store.getState().queries).toEqual({ specs: 'uno', fixes: 'dos' });
  });

  it('falls back to defaults on invalid or unreadable stored state', () => {
    window.localStorage.setItem(key('p'), '{"module":"nope"}');
    expect(readNav('p')).toEqual(defaultNav());
    window.localStorage.setItem(key('p'), 'not json');
    expect(readNav('p')).toEqual(defaultNav());
  });

  it('survives a storage that throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = createNavStore('p');
    expect(() => store.getState().setModule('kit')).not.toThrow();
    expect(store.getState().module).toBe('kit');
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it('migrates the legacy active view once and removes the old key', () => {
    window.localStorage.setItem(LEGACY_VIEW_KEY, 'telemetry');
    const first = readNav('p');
    expect(first.module).toBe('metrics');
    expect(first.selection.metrics).toBe('telemetry');
    expect(window.localStorage.getItem(LEGACY_VIEW_KEY)).toBeNull();
    window.localStorage.setItem(LEGACY_VIEW_KEY, 'agent-map');
    expect(readNav('q').module).toBe('map');
    window.localStorage.setItem(LEGACY_VIEW_KEY, 'workspace');
    expect(readNav('r').module).toBe('home');
  });

  it('does not migrate when the project already has navigation state', () => {
    createNavStore('p').getState().setModule('kit');
    window.localStorage.setItem(LEGACY_VIEW_KEY, 'agent-map');
    expect(readNav('p').module).toBe('kit');
  });

  it('reconcile drops selections that no longer exist and keeps the rest', () => {
    const value = { ...defaultNav(), module: 'specs' as const, specCycle: 'cycle-01', selection: { ...defaultNav().selection, specs: 'gone', fixes: 'FIX-1', agents: 'x', kit: 'skills/a' } };
    const next = reconcileNav(value, { specs: ['other'], fixes: ['FIX-1'], agents: [] });
    expect(next.selection.specs).toBeNull();
    expect(next.specCycle).toBeNull();
    expect(next.selection.fixes).toBe('FIX-1');
    expect(next.selection.agents).toBeNull();
    expect(next.selection.kit).toBe('skills/a');
    expect(next.module).toBe('specs');
  });

  it('reconcile sends an unknown thread back to #general', () => {
    const value = { ...defaultNav(), home: { kind: 'thread' as const, threadId: 't-9' } };
    expect(reconcileNav(value, { specs: [], fixes: [], agents: [], threads: ['t-1'] }).home).toEqual({ kind: 'channel', channelId: 'general' });
    expect(reconcileNav(value, { specs: [], fixes: [], agents: [], threads: ['t-9'] }).home).toEqual(value.home);
  });

  it('startNewConversation goes Home and bumps the signal', () => {
    const store = createNavStore('p');
    store.getState().setModule('map');
    store.getState().startNewConversation();
    expect(store.getState().module).toBe('home');
    expect(store.getState().newConversationSignal).toBe(1);
  });
});

function Probe({ project }: { project: string }) {
  const module = useNav((s) => s.module);
  const setModule = useNav((s) => s.setModule);
  return <button onClick={() => setModule('fixes')}>{`${project}:${module}`}</button>;
}

describe('NavProvider', () => {
  beforeEach(() => window.localStorage.clear());

  it('reconciles stored selections once the snapshot lists the entities', () => {
    createNavStore('p').getState().open('specs', 'gone');
    const { rerender, getByRole } = render(
      <NavProvider project="p" known={null}>
        <Probe project="p" />
      </NavProvider>,
    );
    expect(getByRole('button')).toHaveTextContent('p:specs');
    rerender(
      <NavProvider project="p" known={{ specs: ['other'], fixes: [], agents: [] }}>
        <Probe project="p" />
      </NavProvider>,
    );
    expect(JSON.parse(window.localStorage.getItem(key('p')) ?? '{}').selection.specs).toBeNull();
  });

  it('switches the store when the project changes', () => {
    createNavStore('b').getState().setModule('kit');
    const { rerender, getByRole } = render(
      <NavProvider project="a">
        <Probe project="a" />
      </NavProvider>,
    );
    expect(getByRole('button')).toHaveTextContent('a:home');
    act(() => getByRole('button').click());
    expect(getByRole('button')).toHaveTextContent('a:fixes');
    rerender(
      <NavProvider project="b">
        <Probe project="b" />
      </NavProvider>,
    );
    expect(getByRole('button')).toHaveTextContent('b:kit');
  });
});
