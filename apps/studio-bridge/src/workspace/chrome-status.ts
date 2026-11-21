import type { ClaudeBrowserState, ClaudeBrowserStatus } from '@sdd-studio/protocol';
import { openNewTab, studioChrome, probeUrl, STUDIO_CHROME_URL, StudioChromeError, type StudioChromeService } from './studio-chrome';

export interface ChromeCheckDeps {
  browserEnabled: () => boolean;
  browserUrl: () => string | null;
  probe: (baseUrl: string) => Promise<boolean>;
  studio: Pick<StudioChromeService, 'ensure'>;
  now: () => Date;
}

export const defaultChromeCheckDeps = (browserEnabled: () => boolean, browserUrl: () => string | null = () => null): ChromeCheckDeps => ({
  browserEnabled,
  browserUrl,
  probe: (baseUrl) => probeUrl(baseUrl),
  studio: studioChrome,
  now: () => new Date(),
});

const status = (deps: ChromeCheckDeps, state: ClaudeBrowserState, detail: string | null): ClaudeBrowserStatus => ({
  state,
  checkedAt: deps.now().toISOString(),
  detail: detail === null ? null : detail.slice(0, 300),
});

export async function checkChrome(deps: ChromeCheckDeps): Promise<ClaudeBrowserStatus> {
  if (!deps.browserEnabled()) return status(deps, 'off', null);
  const devUrl = deps.browserUrl();
  if (devUrl) {
    const reachable = await deps.probe(devUrl);
    return reachable ? status(deps, 'connected', null) : status(deps, 'chrome-closed', `No responde ${devUrl}`);
  }
  if (await deps.probe(STUDIO_CHROME_URL)) return status(deps, 'connected', null);
  try {
    await deps.studio.ensure();
  } catch (error) {
    if (error instanceof StudioChromeError && error.code === 'no-binary') return status(deps, 'unknown', 'No se encontró Google Chrome');
    return status(deps, 'chrome-closed', error instanceof Error ? error.message : 'Chrome no abrió');
  }
  return (await deps.probe(STUDIO_CHROME_URL)) ? status(deps, 'connected', null) : status(deps, 'chrome-closed', 'Chrome no respondió tras abrirlo');
}

export interface ChromeStatusService {
  current(): ClaudeBrowserStatus | null;
  check(): Promise<ClaudeBrowserStatus>;
  subscribe(listener: (status: ClaudeBrowserStatus) => void): () => void;
}

export function createChromeStatus(deps: ChromeCheckDeps): ChromeStatusService {
  let last: ClaudeBrowserStatus | null = null;
  let inflight: Promise<ClaudeBrowserStatus> | null = null;
  const listeners = new Set<(status: ClaudeBrowserStatus) => void>();

  const run = async (): Promise<ClaudeBrowserStatus> => {
    const next = await checkChrome(deps);
    const changed = last === null || last.state !== next.state;
    last = next;
    if (changed) for (const listener of listeners) listener(next);
    return next;
  };

  return {
    current: () => last,
    check: () => {
      inflight ??= run().finally(() => {
        inflight = null;
      });
      return inflight;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export interface OpenStudioChromeDeps {
  studio: Pick<StudioChromeService, 'ensure'>;
  openTab: () => Promise<boolean>;
}

export const defaultOpenStudioChromeDeps = (studio: Pick<StudioChromeService, 'ensure'> = studioChrome): OpenStudioChromeDeps => ({
  studio,
  openTab: () => openNewTab(),
});

export async function openStudioChrome(deps: OpenStudioChromeDeps): Promise<{ opened: boolean }> {
  try {
    const { launched } = await deps.studio.ensure();
    if (launched) return { opened: true };
    return { opened: await deps.openTab() };
  } catch {
    return { opened: false };
  }
}
