import { parsePairing } from '@/lib/bridge/pairing';

export type BridgeLinkResult = { ok: true; href: string } | { ok: false; reason: 'empty' | 'format' | 'origin' };

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const WORKSPACE_PATHS = new Set(['/w', '/w/']);

function parseUrl(text: string): URL | null {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

function isLocalUiLink(url: URL, port: number): boolean {
  return url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname) && url.port === String(port) && WORKSPACE_PATHS.has(url.pathname);
}

function isSiteLink(url: URL, siteOrigin: string): boolean {
  return url.origin === siteOrigin && WORKSPACE_PATHS.has(url.pathname);
}

export function validateBridgeLink(input: string, siteOrigin: string): BridgeLinkResult {
  const text = input.trim();
  if (text === '') return { ok: false, reason: 'empty' };
  const url = parseUrl(text);
  const pairing = url ? parsePairing(url.hash) : null;
  if (!url || !pairing || url.username !== '' || url.password !== '') return { ok: false, reason: 'format' };
  if (!isSiteLink(url, siteOrigin) && !isLocalUiLink(url, pairing.port)) return { ok: false, reason: 'origin' };
  return { ok: true, href: url.href };
}

export interface NavigationWindow {
  location: { href: string; assign(url: string): void; reload(): void };
}

function differsOnlyInHash(target: string, current: string): boolean {
  const strip = (href: string) => href.split('#')[0];
  return strip(target) === strip(current);
}

export function openBridgeLink(href: string, win: NavigationWindow = window): void {
  const sameDocument = differsOnlyInHash(href, win.location.href);
  win.location.assign(href);
  if (sameDocument) win.location.reload();
}
