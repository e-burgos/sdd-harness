import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import type { ConfigValidation } from '@sdd-studio/protocol';
import type { HarnessConfigDraft } from '../to-config';
import { useTargetCheck } from '../use-target-check';
import { useWizardValidation } from '../use-wizard-validation';
import { deferred, fakeClient, type Deferred } from './fake-client';

const draft = (name: string): HarnessConfigDraft => ({
  project: { name, description: 'd', packageScope: '@x' },
  apps: [],
  sdd: { profile: 'team' },
});

const validation = (ok: boolean, code = 'x'): ConfigValidation => ({
  format: 1,
  cliVersion: '0.17.0',
  ok,
  issues: ok ? [] : [{ severity: 'error', code, path: [], message: 'm' }],
  resolved: null,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useWizardValidation', () => {
  it('debounces 400 ms and sends only the last config', async () => {
    const fake = fakeClient(() => validation(true));
    const { result, rerender } = renderHook(({ config }) => useWizardValidation(fake.client, config), {
      initialProps: { config: draft('a') as HarnessConfigDraft | null },
    });
    expect(result.current.status).toBe('validating');
    act(() => vi.advanceTimersByTime(300));
    rerender({ config: draft('ab') });
    act(() => vi.advanceTimersByTime(300));
    rerender({ config: draft('abc') });
    act(() => vi.advanceTimersByTime(399));
    expect(fake.requests).toHaveLength(0);
    act(() => vi.advanceTimersByTime(1));
    await flush();
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toMatchObject({ cmd: 'wizard.validate', config: { project: { name: 'abc' } } });
    expect(result.current.status).toBe('ready');
    expect(result.current.canGenerate).toBe(true);
  });

  it('keeps one request in flight and replaces the queue, so the last state wins', async () => {
    const pending: Deferred<unknown>[] = [];
    const fake = fakeClient(() => {
      const d = deferred<unknown>();
      pending.push(d);
      return d.promise;
    });
    const { result, rerender } = renderHook(({ config }) => useWizardValidation(fake.client, config), {
      initialProps: { config: draft('one') as HarnessConfigDraft | null },
    });
    act(() => vi.advanceTimersByTime(400));
    expect(fake.requests).toHaveLength(1);

    rerender({ config: draft('two') });
    act(() => vi.advanceTimersByTime(400));
    rerender({ config: draft('three') });
    act(() => vi.advanceTimersByTime(400));
    expect(fake.requests).toHaveLength(1);

    await act(async () => pending[0].resolve(validation(false, 'stale')));
    expect(fake.requests).toHaveLength(2);
    expect(fake.requests[1]).toMatchObject({ config: { project: { name: 'three' } } });
    expect(result.current.status).toBe('validating');
    expect(result.current.validation).toBeNull();

    await act(async () => pending[1].resolve(validation(true)));
    expect(result.current.status).toBe('ready');
    expect(result.current.validation?.ok).toBe(true);
  });

  it('ignores a result that arrives after the input changed again', async () => {
    const pending: Deferred<unknown>[] = [];
    const fake = fakeClient(() => {
      const d = deferred<unknown>();
      pending.push(d);
      return d.promise;
    });
    const { result, rerender } = renderHook(({ config }) => useWizardValidation(fake.client, config), {
      initialProps: { config: draft('one') as HarnessConfigDraft | null },
    });
    act(() => vi.advanceTimersByTime(400));
    rerender({ config: draft('two') });
    await act(async () => pending[0].resolve(validation(false, 'stale')));
    expect(result.current.validation).toBeNull();
    expect(result.current.status).toBe('validating');
    act(() => vi.advanceTimersByTime(400));
    await act(async () => pending[1].resolve(validation(true)));
    expect(result.current.validation?.ok).toBe(true);
  });

  it('blocks generation on errors and on port-conflict warnings, not on other warnings', async () => {
    let next: ConfigValidation = validation(false);
    const fake = fakeClient(() => next);
    const { result, rerender } = renderHook(({ config }) => useWizardValidation(fake.client, config), {
      initialProps: { config: draft('a') as HarnessConfigDraft | null },
    });
    act(() => vi.advanceTimersByTime(400));
    await flush();
    expect(result.current.canGenerate).toBe(false);

    next = { ...validation(true), issues: [{ severity: 'warning', code: 'port-conflict', path: ['apps', 0, 'port'], message: 'm' }] };
    rerender({ config: draft('b') });
    act(() => vi.advanceTimersByTime(400));
    await flush();
    expect(result.current.canGenerate).toBe(false);

    next = { ...validation(true), issues: [{ severity: 'warning', code: 'standalone-libs-ignored', path: ['libs'], message: 'm' }] };
    rerender({ config: draft('c') });
    act(() => vi.advanceTimersByTime(400));
    await flush();
    expect(result.current.canGenerate).toBe(true);
  });

  it('reports a failed request and an unparseable answer as an error', async () => {
    const fake = fakeClient(() => ({ nope: true }));
    const { result } = renderHook(() => useWizardValidation(fake.client, draft('a')));
    act(() => vi.advanceTimersByTime(400));
    await flush();
    expect(result.current.status).toBe('error');
    expect(result.current.canGenerate).toBe(false);
  });

  it('goes idle and sends nothing without a config', () => {
    const fake = fakeClient();
    const { result } = renderHook(() => useWizardValidation(fake.client, null));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.status).toBe('idle');
    expect(fake.requests).toHaveLength(0);
  });
});

describe('useTargetCheck', () => {
  const check = (input: string) => ({
    input,
    resolvedPath: input,
    state: 'empty',
    reason: null,
    entries: null,
    insideProject: false,
    needsConfirmation: false,
    fingerprint: null,
  });

  it('debounces, trims and checks the last path', async () => {
    const fake = fakeClient((cmd) => check(String(cmd.path)));
    const { result, rerender } = renderHook(({ path }) => useTargetCheck(fake.client, path), { initialProps: { path: '/a' } });
    rerender({ path: '/a/b ' });
    act(() => vi.advanceTimersByTime(400));
    await flush();
    expect(fake.requests).toEqual([{ cmd: 'wizard.checkTarget', path: '/a/b' }]);
    expect(result.current.status).toBe('ready');
    expect(result.current.check?.resolvedPath).toBe('/a/b');
  });

  it('stays idle for an empty path', () => {
    const fake = fakeClient();
    const { result } = renderHook(() => useTargetCheck(fake.client, '   '));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toEqual({ status: 'idle', check: null, error: null });
    expect(fake.requests).toHaveLength(0);
  });
});
