import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { chromeLaunchArgs, createStudioChrome, openNewTab, probeUrl, resolveChromeBinary, studioChromeProfile, StudioChromeError, type BinaryDeps, type StudioChromeDeps } from './studio-chrome';

const binary = (over: Partial<BinaryDeps> = {}): BinaryDeps => ({
  platform: 'linux',
  env: {},
  home: () => '/home/u',
  exists: async () => false,
  which: async () => null,
  ...over,
});

describe('studioChromeProfile', () => {
  it('lives under the home or SDD_STUDIO_HOME', () => {
    expect(studioChromeProfile({}, () => '/home/u')).toBe('/home/u/.sdd-studio/chrome-profile');
    expect(studioChromeProfile({ SDD_STUDIO_HOME: '/s' }, () => '/home/u')).toBe('/s/.sdd-studio/chrome-profile');
  });
});

describe('chromeLaunchArgs', () => {
  it('uses the Studio port and profile', () => {
    expect(chromeLaunchArgs('/p')).toEqual(['--remote-debugging-port=9333', '--user-data-dir=/p', '--no-first-run', '--no-default-browser-check']);
  });
});

describe('resolveChromeBinary', () => {
  it('finds the macOS app in /Applications or ~/Applications', async () => {
    const system = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    expect(await resolveChromeBinary(binary({ platform: 'darwin', exists: async (f) => f === system }))).toBe(system);
    const user = '/home/u/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    expect(await resolveChromeBinary(binary({ platform: 'darwin', exists: async (f) => f === user }))).toBe(user);
    expect(await resolveChromeBinary(binary({ platform: 'darwin' }))).toBeNull();
  });
  it('tries the Linux names in order', async () => {
    const asked: string[] = [];
    const which = async (name: string) => { asked.push(name); return name === 'chromium' ? '/usr/bin/chromium' : null; };
    expect(await resolveChromeBinary(binary({ which }))).toBe('/usr/bin/chromium');
    expect(asked).toEqual(['google-chrome', 'google-chrome-stable', 'chromium']);
  });
  it('looks in the Windows install roots', async () => {
    const target = 'C:\\L\\Google\\Chrome\\Application\\chrome.exe';
    const env = { PROGRAMFILES: 'C:\\PF', 'PROGRAMFILES(X86)': 'C:\\PF86', LOCALAPPDATA: 'C:\\L' };
    expect(await resolveChromeBinary(binary({ platform: 'win32', env, exists: async (f) => f === target }))).toBe(target);
    expect(await resolveChromeBinary(binary({ platform: 'win32', env }))).toBeNull();
  });
});

const chromeDeps = (over: Partial<StudioChromeDeps> = {}) => {
  let clock = 0;
  const calls = { launch: [] as Array<[string, string[]]>, mkdir: [] as string[] };
  const deps: StudioChromeDeps = {
    probe: async () => false,
    resolveBinary: async () => '/bin/chrome',
    launch: (bin, args) => { calls.launch.push([bin, args]); },
    mkdir: async (dir) => { calls.mkdir.push(dir); },
    profile: () => '/p',
    sleep: async (ms) => { clock += ms; },
    now: () => clock,
    waitMs: 1000,
    ...over,
  };
  return { deps, calls };
};

describe('createStudioChrome', () => {
  it('does nothing when Chrome already answers', async () => {
    const { deps, calls } = chromeDeps({ probe: async () => true });
    expect(await createStudioChrome(deps).ensure()).toEqual({ launched: false });
    expect(calls.launch).toEqual([]);
  });
  it('creates the profile, launches with exact args and waits for the port', async () => {
    let probes = 0;
    const { deps, calls } = chromeDeps({ probe: async () => ++probes > 3 });
    expect(await createStudioChrome(deps).ensure()).toEqual({ launched: true });
    expect(calls.mkdir).toEqual(['/p']);
    expect(calls.launch).toEqual([['/bin/chrome', ['--remote-debugging-port=9333', '--user-data-dir=/p', '--no-first-run', '--no-default-browser-check']]]);
  });
  it('fails with no-binary, launch-failed and timeout', async () => {
    await expect(createStudioChrome(chromeDeps({ resolveBinary: async () => null }).deps).ensure()).rejects.toMatchObject({ code: 'no-binary' });
    const boom = chromeDeps({ launch: () => { throw new Error('spawn failed'); } }).deps;
    await expect(createStudioChrome(boom).ensure()).rejects.toMatchObject({ code: 'launch-failed' });
    await expect(createStudioChrome(chromeDeps().deps).ensure()).rejects.toBeInstanceOf(StudioChromeError);
    await expect(createStudioChrome(chromeDeps().deps).ensure()).rejects.toMatchObject({ code: 'timeout' });
  });
  it('reuses the inflight launch', async () => {
    const launch = vi.fn();
    let up = false;
    const { deps } = chromeDeps({ launch: () => { launch(); up = true; }, probe: async () => up });
    const service = createStudioChrome(deps);
    const [a, b] = [service.ensure(), service.ensure()];
    expect(a).toBe(b);
    await a;
    expect(launch).toHaveBeenCalledTimes(1);
  });
});

describe('http helpers', () => {
  const serve = async (handler: http.RequestListener) => {
    const server = http.createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    return { url, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
  };
  it('probeUrl is true on 200, false on 500, closed port or timeout', async () => {
    const ok = await serve((_req, res) => res.end('{}'));
    const bad = await serve((_req, res) => { res.statusCode = 500; res.end(); });
    const slow = await serve(() => undefined);
    expect(await probeUrl(ok.url)).toBe(true);
    expect(await probeUrl(bad.url)).toBe(false);
    expect(await probeUrl(slow.url, 100)).toBe(false);
    const closed = ok.url;
    await ok.close();
    expect(await probeUrl(closed)).toBe(false);
    await bad.close();
    slow.close().catch(() => undefined);
  });
  it('openNewTab sends a PUT to /json/new', async () => {
    const seen: string[] = [];
    const server = await serve((req, res) => { seen.push(`${req.method} ${req.url}`); res.end('{}'); });
    expect(await openNewTab(server.url)).toBe(true);
    expect(seen).toEqual(['PUT /json/new?about:blank']);
    await server.close();
  });
});
