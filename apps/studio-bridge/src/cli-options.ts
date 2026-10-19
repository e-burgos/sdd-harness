import { BridgeStartError } from './main';

export function parsePort(raw: string): number {
  const port = /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new BridgeStartError(`Invalid port: ${raw} (use a number between 0 and 65535)`);
  }
  return port;
}

export function parseEngine(raw: string): 'claude' | 'fake' {
  if (raw === 'claude' || raw === 'fake') return raw;
  throw new BridgeStartError(`Invalid engine: ${raw} (use claude or fake)`);
}

export function parseWebUrl(raw: string): string {
  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {
    url = null;
  }
  if (!url || !/^https?:$/.test(url.protocol) || raw.includes('?') || raw.includes('#')) {
    throw new BridgeStartError(`Invalid web URL: ${raw} (use http(s)://host without ? or #)`);
  }
  return raw;
}

export function parseToken(raw: string): string {
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(raw)) {
    throw new BridgeStartError('Invalid token: use at least 16 characters [A-Za-z0-9_-].');
  }
  return raw;
}
