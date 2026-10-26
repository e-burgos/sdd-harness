import type { AuthPreference } from '@sdd-studio/protocol';

const KEY = 'sdd-studio.authPreference';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function loadAuthPreference(store?: Store): AuthPreference | null {
  try {
    const value = (store ?? localStorage).getItem(KEY);
    return value === 'subscription' || value === 'api-key' ? value : null;
  } catch {
    return null;
  }
}

export function saveAuthPreference(preference: AuthPreference, store?: Store): void {
  try {
    (store ?? localStorage).setItem(KEY, preference);
  } catch {
    return;
  }
}
