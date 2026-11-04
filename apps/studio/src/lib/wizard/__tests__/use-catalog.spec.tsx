import { act, renderHook, waitFor } from '@testing-library/react';
import type { WizardCatalogResult } from '@sdd-studio/protocol';
import { useCatalog } from '../use-catalog';
import { BridgeFailure, fakeClient } from './fake-client';
import { catalogFixture } from './fixtures';

const result: WizardCatalogResult = {
  catalog: catalogFixture,
  initArgv: ['harness', 'init'],
  home: '/home/x',
  suggestedParent: '/home/x',
  platform: 'posix',
};

describe('useCatalog', () => {
  it('loads the catalog once connected', async () => {
    const fake = fakeClient(() => result);
    const { result: hook } = renderHook(() => useCatalog(fake.client));
    await waitFor(() => expect(hook.current.status).toBe('ready'));
    expect(hook.current.data?.catalog.cliVersion).toBe('0.17.0');
    expect(fake.requests).toEqual([{ cmd: 'wizard.catalog' }]);
  });

  it('waits for the connection and loads when it opens', async () => {
    const fake = fakeClient(() => result, 'connecting');
    const { result: hook } = renderHook(() => useCatalog(fake.client));
    expect(hook.current.status).toBe('loading');
    expect(fake.requests).toHaveLength(0);
    act(() => fake.setState({ status: 'idle' }));
    expect(fake.requests).toHaveLength(0);
    act(() => fake.setState({ status: 'open', welcome: {} as never }));
    await waitFor(() => expect(hook.current.status).toBe('ready'));
  });

  it('surfaces a failure and recovers on reload', async () => {
    let fail = true;
    const fake = fakeClient(() => {
      if (fail) throw new BridgeFailure('internal', 'CLI output does not match the protocol');
      return result;
    });
    const { result: hook } = renderHook(() => useCatalog(fake.client));
    await waitFor(() => expect(hook.current.status).toBe('error'));
    expect(hook.current.error).toContain('does not match');
    fail = false;
    act(() => hook.current.reload());
    await waitFor(() => expect(hook.current.status).toBe('ready'));
  });

  it('rejects an answer that does not match the protocol', async () => {
    const fake = fakeClient(() => ({ catalog: {} }));
    const { result: hook } = renderHook(() => useCatalog(fake.client));
    await waitFor(() => expect(hook.current.status).toBe('error'));
  });

  it('unsubscribes on unmount', async () => {
    const fake = fakeClient(() => result);
    const { unmount } = renderHook(() => useCatalog(fake.client));
    expect(fake.listeners().states).toBe(1);
    unmount();
    expect(fake.listeners().states).toBe(0);
  });
});
