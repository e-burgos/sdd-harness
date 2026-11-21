import { describe, expect, it, vi } from 'vitest';
import { checkChrome, createChromeStatus, openStudioChrome, type ChromeCheckDeps } from './chrome-status';
import { StudioChromeError } from './studio-chrome';

const deps = (over: Partial<ChromeCheckDeps> = {}): ChromeCheckDeps => ({
  browserEnabled: () => true,
  browserUrl: () => null,
  probe: async () => true,
  studio: { ensure: async () => ({ launched: false }) },
  now: () => new Date('2026-11-20T10:00:00Z'),
  ...over,
});

describe('checkChrome', () => {
  it('is off when the browser is disabled without probing', async () => {
    const probe = vi.fn(async () => true);
    expect(await checkChrome(deps({ browserEnabled: () => false, probe }))).toMatchObject({ state: 'off', detail: null });
    expect(probe).not.toHaveBeenCalled();
  });
  it('is connected when the Studio Chrome answers', async () => {
    const probe = vi.fn(async () => true);
    expect(await checkChrome(deps({ probe }))).toEqual({ state: 'connected', checkedAt: '2026-11-20T10:00:00.000Z', detail: null });
    expect(probe).toHaveBeenCalledWith('http://127.0.0.1:9333');
  });
  it('launches Chrome when it does not answer and reports connected after re-probing', async () => {
    let up = false;
    const ensure = vi.fn(async () => {
      up = true;
      return { launched: true };
    });
    expect((await checkChrome(deps({ probe: async () => up, studio: { ensure } }))).state).toBe('connected');
    expect(ensure).toHaveBeenCalledTimes(1);
  });
  it('is chrome-closed with the error when the launch fails or the re-probe fails', async () => {
    const failing = deps({ probe: async () => false, studio: { ensure: async () => { throw new StudioChromeError('timeout', 'late'); } } });
    expect(await checkChrome(failing)).toMatchObject({ state: 'chrome-closed', detail: 'late' });
    expect((await checkChrome(deps({ probe: async () => false }))).state).toBe('chrome-closed');
  });
  it('is unknown when there is no Chrome binary', async () => {
    const noBinary = deps({ probe: async () => false, studio: { ensure: async () => { throw new StudioChromeError('no-binary', 'x'); } } });
    expect(await checkChrome(noBinary)).toMatchObject({ state: 'unknown', detail: 'No se encontró Google Chrome' });
  });
  it('probes the dev browserUrl and never launches anything', async () => {
    const probe = vi.fn(async () => false);
    const ensure = vi.fn();
    const status = await checkChrome(deps({ browserUrl: () => 'http://127.0.0.1:9222', probe, studio: { ensure } }));
    expect(status).toMatchObject({ state: 'chrome-closed', detail: 'No responde http://127.0.0.1:9222' });
    expect(probe).toHaveBeenCalledWith('http://127.0.0.1:9222');
    expect(ensure).not.toHaveBeenCalled();
    expect((await checkChrome(deps({ browserUrl: () => 'http://h:1' }))).state).toBe('connected');
  });
});

describe('createChromeStatus', () => {
  it('notifies only when the state changes and reuses an inflight check', async () => {
    let up = false;
    const service = createChromeStatus(deps({ probe: async () => up }));
    const listener = vi.fn();
    service.subscribe(listener);
    const [a, b] = await Promise.all([service.check(), service.check()]);
    expect(a).toBe(b);
    expect(listener).toHaveBeenCalledTimes(1);
    await service.check();
    expect(listener).toHaveBeenCalledTimes(1);
    up = true;
    await service.check();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(service.current()?.state).toBe('connected');
  });
});

describe('openStudioChrome', () => {
  it('reports opened when Chrome was launched, without opening a tab', async () => {
    const openTab = vi.fn(async () => true);
    expect(await openStudioChrome({ studio: { ensure: async () => ({ launched: true }) }, openTab })).toEqual({ opened: true });
    expect(openTab).not.toHaveBeenCalled();
  });
  it('opens a tab when Chrome was already running', async () => {
    const openTab = vi.fn(async () => true);
    expect(await openStudioChrome({ studio: { ensure: async () => ({ launched: false }) }, openTab })).toEqual({ opened: true });
    expect(openTab).toHaveBeenCalledTimes(1);
  });
  it('reports opened false when ensure fails', async () => {
    const studio = { ensure: async () => { throw new StudioChromeError('no-binary', 'x'); } };
    expect(await openStudioChrome({ studio, openTab: async () => true })).toEqual({ opened: false });
  });
});
