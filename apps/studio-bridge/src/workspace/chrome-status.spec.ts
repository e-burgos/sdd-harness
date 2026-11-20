import { describe, expect, it, vi } from 'vitest';
import { checkChrome, createChromeStatus, devToolsActivePortFile, openChromeSettings, type ChromeCheckDeps } from './chrome-status';

const deps = (over: Partial<ChromeCheckDeps> = {}): ChromeCheckDeps => ({
  platform: 'darwin',
  homedir: () => '/home/u',
  env: {},
  readFile: async () => '9222\n/devtools/browser/abc',
  isChromeRunning: async () => true,
  connect: async () => ({ open: true, detail: null }),
  browserEnabled: () => true,
  now: () => new Date('2026-11-20T10:00:00Z'),
  ...over,
});

describe('devToolsActivePortFile', () => {
  it('resolves the profile directory per platform', () => {
    expect(devToolsActivePortFile('darwin', '/home/u', {})).toBe('/home/u/Library/Application Support/Google/Chrome/DevToolsActivePort');
    expect(devToolsActivePortFile('linux', '/home/u', {})).toBe('/home/u/.config/google-chrome/DevToolsActivePort');
    expect(devToolsActivePortFile('win32', 'C:\\Users\\u', { LOCALAPPDATA: 'C:\\L' })).toBe('C:\\L\\Google\\Chrome\\User Data\\DevToolsActivePort');
  });
});

describe('checkChrome', () => {
  it('is off when the browser is disabled and does not look at Chrome', async () => {
    const isChromeRunning = vi.fn(async () => true);
    expect(await checkChrome(deps({ browserEnabled: () => false, isChromeRunning }))).toMatchObject({ state: 'off', detail: null });
    expect(isChromeRunning).not.toHaveBeenCalled();
  });
  it('is chrome-closed without a process', async () => {
    expect((await checkChrome(deps({ isChromeRunning: async () => false }))).state).toBe('chrome-closed');
  });
  it('keeps going with the file when the process cannot be detected', async () => {
    expect((await checkChrome(deps({ isChromeRunning: async () => null }))).state).toBe('connected');
  });
  it('is debugging-disabled without the port file or with a malformed one', async () => {
    expect((await checkChrome(deps({ readFile: async () => { throw new Error('ENOENT'); } }))).state).toBe('debugging-disabled');
    expect((await checkChrome(deps({ readFile: async () => 'nope' }))).state).toBe('debugging-disabled');
  });
  it('is connected when the websocket opens and uses the file url', async () => {
    const connect = vi.fn(async () => ({ open: true, detail: null }));
    const status = await checkChrome(deps({ connect }));
    expect(status).toEqual({ state: 'connected', checkedAt: '2026-11-20T10:00:00.000Z', detail: null });
    expect(connect).toHaveBeenCalledWith('ws://127.0.0.1:9222/devtools/browser/abc', 8000);
  });
  it('is permission-pending on 403, timeout or error, with detail', async () => {
    for (const detail of ['Chrome answered 403', 'Opening handshake has timed out', 'ECONNREFUSED']) {
      const status = await checkChrome(deps({ connect: async () => ({ open: false, detail }) }));
      expect(status).toMatchObject({ state: 'permission-pending', detail });
    }
  });
  it('works the same on linux and windows', async () => {
    const files: string[] = [];
    for (const platform of ['linux', 'win32'] as const) {
      await checkChrome(deps({ platform, env: { LOCALAPPDATA: 'C:\\L' }, readFile: async (file) => { files.push(file); return '1\n/x'; } }));
    }
    expect(files[0]).toContain('google-chrome');
    expect(files[1]).toContain('User Data');
  });
});

describe('createChromeStatus', () => {
  it('notifies only when the state changes and reuses an inflight check', async () => {
    let state: 'connected' | 'closed' = 'closed';
    const service = createChromeStatus(deps({ isChromeRunning: async () => state === 'connected' }));
    const listener = vi.fn();
    service.subscribe(listener);
    const [a, b] = await Promise.all([service.check(), service.check()]);
    expect(a).toBe(b);
    expect(listener).toHaveBeenCalledTimes(1);
    await service.check();
    expect(listener).toHaveBeenCalledTimes(1);
    state = 'connected';
    await service.check();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(service.current()?.state).toBe('connected');
  });
});

describe('openChromeSettings', () => {
  const url = 'chrome://inspect/#remote-debugging';
  const run = (platform: NodeJS.Platform, results: boolean[]) => {
    const calls: string[][] = [];
    const queue = [...results];
    return { calls, deps: { platform, exec: async (file: string, args: string[]) => { calls.push([file, ...args]); return queue.shift() ?? false; } } };
  };
  it('uses open on macOS', async () => {
    const { calls, deps: d } = run('darwin', [true]);
    expect(await openChromeSettings(d)).toEqual({ opened: true });
    expect(calls).toEqual([['open', '-a', 'Google Chrome', url]]);
  });
  it('uses cmd start on Windows', async () => {
    const { calls, deps: d } = run('win32', [true]);
    await openChromeSettings(d);
    expect(calls).toEqual([['cmd', '/c', 'start', 'chrome', url]]);
  });
  it('falls back to chromium on Linux', async () => {
    const { calls, deps: d } = run('linux', [false, true]);
    expect(await openChromeSettings(d)).toEqual({ opened: true });
    expect(calls).toEqual([['google-chrome', url], ['chromium', url]]);
  });
  it('reports opened false when nothing launches', async () => {
    expect(await openChromeSettings(run('linux', [false, false]).deps)).toEqual({ opened: false });
  });
});
