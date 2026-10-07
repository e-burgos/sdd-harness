export interface PairingInfo {
  port: number;
  token: string;
}

export interface PairingWindow {
  location: { hash: string; pathname: string; search: string };
  history: { replaceState(data: unknown, unused: string, url: string): void };
  sessionStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
}

export const PAIRING_KEY = 'sdd-studio:pairing';

function valid(port: unknown, token: unknown): token is string {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535 && typeof token === 'string' && token.length > 0;
}

export function parsePairing(hash: string): PairingInfo | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const port = Number(params.get('bridge'));
  const token = params.get('token');
  return valid(port, token) ? { port, token } : null;
}

/** Lee el emparejamiento del fragmento (y lo saca de la URL) o de sessionStorage. */
export function resolvePairing(win: PairingWindow): PairingInfo | null {
  const fromHash = parsePairing(win.location.hash);
  if (fromHash) {
    try {
      win.sessionStorage.setItem(PAIRING_KEY, JSON.stringify(fromHash));
    } catch {
      // Sin sessionStorage (modo privado estricto): sigue funcionando hasta recargar.
    }
    win.history.replaceState(null, '', win.location.pathname + win.location.search);
    return fromHash;
  }
  try {
    const raw = win.sessionStorage.getItem(PAIRING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { port?: unknown; token?: unknown };
    return valid(parsed.port, parsed.token) ? { port: parsed.port as number, token: parsed.token } : null;
  } catch {
    return null;
  }
}

export const bridgeUrl = (p: PairingInfo): string => `ws://127.0.0.1:${p.port}`;
