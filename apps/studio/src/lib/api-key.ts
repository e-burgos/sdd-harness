const KEY = 'sdd-studio.apiKey';

export interface StoredApiKey {
  apiKey: string;
  remembered: boolean;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/** The key never leaves this browser except over the loopback WebSocket to the local bridge. */
export function loadApiKey(session: Store = sessionStorage, local: Store = localStorage): StoredApiKey | null {
  const fromSession = safe(() => session.getItem(KEY), null);
  if (fromSession) return { apiKey: fromSession, remembered: false };
  const fromLocal = safe(() => local.getItem(KEY), null);
  return fromLocal ? { apiKey: fromLocal, remembered: true } : null;
}

/** Tab-only (sessionStorage) by default; localStorage only when the user opts in to "remember". */
export function saveApiKey(apiKey: string, remember: boolean, session: Store = sessionStorage, local: Store = localStorage): void {
  clearApiKey(session, local);
  safe(() => (remember ? local : session).setItem(KEY, apiKey), undefined);
}

export function clearApiKey(session: Store = sessionStorage, local: Store = localStorage): void {
  safe(() => session.removeItem(KEY), undefined);
  safe(() => local.removeItem(KEY), undefined);
}

export const isPlausibleApiKey = (value: string): boolean => /^\S{20,512}$/.test(value);
