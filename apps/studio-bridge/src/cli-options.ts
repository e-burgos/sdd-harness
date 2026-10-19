import { BridgeStartError } from './main';

export function parsePort(raw: string): number {
  const port = /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new BridgeStartError(`Puerto inválido: ${raw} (usá un número entre 0 y 65535)`);
  }
  return port;
}

export function parseEngine(raw: string): 'claude' | 'fake' {
  if (raw === 'claude' || raw === 'fake') return raw;
  throw new BridgeStartError(`Motor inválido: ${raw} (usá claude o fake)`);
}

export function parseWebUrl(raw: string): string {
  let url: URL | null = null;
  try {
    url = new URL(raw);
  } catch {
    url = null;
  }
  if (!url || !/^https?:$/.test(url.protocol) || raw.includes('?') || raw.includes('#')) {
    throw new BridgeStartError(`URL de la web inválida: ${raw} (usá http(s)://host sin ? ni #)`);
  }
  return raw;
}

export function parseToken(raw: string): string {
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(raw)) {
    throw new BridgeStartError('Token inválido: usá al menos 16 caracteres [A-Za-z0-9_-].');
  }
  return raw;
}
