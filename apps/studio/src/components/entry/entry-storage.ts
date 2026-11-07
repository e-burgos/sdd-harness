import { isEntryPath, REQUIREMENTS, type EntryPath, type RequirementId } from './entry-model';

export const ENTRY_STORAGE_KEY = 'sdd-studio:entry';

export interface StoredEntry {
  path: EntryPath | null;
  checked: readonly RequirementId[];
}

const EMPTY: StoredEntry = { path: null, checked: [] };

export function readStoredEntry(): StoredEntry {
  try {
    const raw = window.sessionStorage.getItem(ENTRY_STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as { path?: unknown; checked?: unknown };
    const checked = Array.isArray(parsed.checked) ? REQUIREMENTS.filter((id) => (parsed.checked as unknown[]).includes(id)) : [];
    return { path: isEntryPath(parsed.path) ? parsed.path : null, checked };
  } catch {
    return EMPTY;
  }
}

export function storeEntry(entry: StoredEntry): void {
  try {
    window.sessionStorage.setItem(ENTRY_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    return;
  }
}
