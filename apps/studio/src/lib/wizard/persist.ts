import { initialWizardState, type WizardState } from './state';

export const WIZARD_STATE_KEY = 'sdd-studio:wizard:state';
export const WIZARD_GENERATION_KEY = 'sdd-studio:wizard:generation';
export const WIZARD_IDEA_KEY = 'sdd-studio:wizard:idea';
export const WIZARD_GITHUB_SKIP_KEY = 'sdd-studio:wizard:github-skipped';

const STATE_VERSION = 1;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface GenerationPointer {
  generationId: string;
  target: string;
  lastSeq: number;
  lastStatus: string;
}

export function sessionStore(): StorageLike | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function read(storage: StorageLike | null, key: string): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(storage: StorageLike | null, key: string, value: unknown): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

function remove(storage: StorageLike | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    return;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const isApp = (value: unknown): boolean =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.type) &&
  (value.role === 'frontend' || value.role === 'backend') &&
  isString(value.name) &&
  isString(value.portText) &&
  typeof value.tucuUi === 'boolean' &&
  typeof value.ml === 'boolean' &&
  (value.shell === null || isString(value.shell));
const isLib = (value: unknown): boolean => isRecord(value) && isString(value.type) && isString(value.name);

function isWizardState(value: unknown): value is WizardState {
  if (!isRecord(value) || !isRecord(value.project) || !isRecord(value.stash)) return false;
  const { project, stash } = value;
  return (
    (value.scope === null || value.scope === 'fullstack' || value.scope === 'front' || value.scope === 'back') &&
    (value.mode === null || value.mode === 'nx' || value.mode === 'standalone') &&
    isString(project.name) &&
    isString(project.description) &&
    isString(project.packageScope) &&
    typeof project.packageScopeTouched === 'boolean' &&
    Array.isArray(value.apps) &&
    value.apps.every(isApp) &&
    Array.isArray(value.libs) &&
    value.libs.every(isLib) &&
    isStringArray(value.services) &&
    (value.profile === null || value.profile === 'team' || value.profile === 'solo') &&
    isString(value.author) &&
    isStringArray(value.modules) &&
    typeof value.nextAppId === 'number' &&
    Array.isArray(stash.apps) &&
    stash.apps.every(isApp) &&
    Array.isArray(stash.libs) &&
    stash.libs.every(isLib)
  );
}

export function saveWizardState(state: WizardState, storage: StorageLike | null = sessionStore()): void {
  write(storage, WIZARD_STATE_KEY, { v: STATE_VERSION, state });
}

export function loadWizardState(storage: StorageLike | null = sessionStore()): WizardState | null {
  const stored = read(storage, WIZARD_STATE_KEY);
  if (!isRecord(stored) || stored.v !== STATE_VERSION || !isWizardState(stored.state)) return null;
  return stored.state;
}

export const clearWizardState = (storage: StorageLike | null = sessionStore()): void => remove(storage, WIZARD_STATE_KEY);

export const loadOrInitialState = (storage: StorageLike | null = sessionStore()): WizardState => loadWizardState(storage) ?? initialWizardState();

export function saveGenerationPointer(pointer: GenerationPointer, storage: StorageLike | null = sessionStore()): void {
  write(storage, WIZARD_GENERATION_KEY, {
    generationId: pointer.generationId,
    target: pointer.target,
    lastSeq: pointer.lastSeq,
    lastStatus: pointer.lastStatus,
  });
}

export function loadGenerationPointer(storage: StorageLike | null = sessionStore()): GenerationPointer | null {
  const stored = read(storage, WIZARD_GENERATION_KEY);
  if (
    !isRecord(stored) ||
    !isString(stored.generationId) ||
    !isString(stored.target) ||
    typeof stored.lastSeq !== 'number' ||
    !Number.isInteger(stored.lastSeq) ||
    stored.lastSeq < 0 ||
    !isString(stored.lastStatus)
  ) {
    return null;
  }
  return { generationId: stored.generationId, target: stored.target, lastSeq: stored.lastSeq, lastStatus: stored.lastStatus };
}

export const clearGenerationPointer = (storage: StorageLike | null = sessionStore()): void => remove(storage, WIZARD_GENERATION_KEY);

export const savePendingIdea = (idea: string, storage: StorageLike | null = sessionStore()): void => write(storage, WIZARD_IDEA_KEY, { idea });

export function loadPendingIdea(storage: StorageLike | null = sessionStore()): string | null {
  const stored = read(storage, WIZARD_IDEA_KEY);
  return isRecord(stored) && isString(stored.idea) ? stored.idea : null;
}

export const clearPendingIdea = (storage: StorageLike | null = sessionStore()): void => remove(storage, WIZARD_IDEA_KEY);

export const saveGithubSkipped = (generationId: string, storage: StorageLike | null = sessionStore()): void => write(storage, WIZARD_GITHUB_SKIP_KEY, { generationId });

export function isGithubSkipped(generationId: string, storage: StorageLike | null = sessionStore()): boolean {
  const stored = read(storage, WIZARD_GITHUB_SKIP_KEY);
  return isRecord(stored) && stored.generationId === generationId;
}

export function clearWizardSession(storage: StorageLike | null = sessionStore()): void {
  remove(storage, WIZARD_GITHUB_SKIP_KEY);
  clearWizardState(storage);
  clearGenerationPointer(storage);
  clearPendingIdea(storage);
}
