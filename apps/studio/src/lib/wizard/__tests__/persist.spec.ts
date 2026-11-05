import {
  WIZARD_GENERATION_KEY,
  WIZARD_STATE_KEY,
  clearWizardSession,
  loadGenerationPointer,
  loadOrInitialState,
  loadPendingIdea,
  loadWizardState,
  saveGenerationPointer,
  savePendingIdea,
  saveWizardState,
} from '../persist';
import { initialWizardState } from '../state';
import { memoryStorage } from './fake-client';
import { run, scoped } from './fixtures';

describe('wizard state persistence', () => {
  it('round-trips the state including the stash', () => {
    const storage = memoryStorage();
    const state = run(
      [
        { type: 'project', patch: { name: 'demo', description: 'd' } },
        { type: 'app-add', appType: 'react' },
        { type: 'app-add', appType: 'nestjs' },
        { type: 'change', change: { type: 'scope', scope: 'front' } },
      ],
      scoped('fullstack', 'nx'),
    );
    saveWizardState(state, storage);
    expect(loadWizardState(storage)).toEqual(state);
    expect(state.stash.apps).toHaveLength(1);
  });

  it('falls back to the initial state on missing, corrupt or foreign data', () => {
    const storage = memoryStorage();
    expect(loadWizardState(storage)).toBeNull();
    storage.setItem(WIZARD_STATE_KEY, '{not json');
    expect(loadWizardState(storage)).toBeNull();
    storage.setItem(WIZARD_STATE_KEY, JSON.stringify({ v: 99, state: initialWizardState() }));
    expect(loadWizardState(storage)).toBeNull();
    storage.setItem(WIZARD_STATE_KEY, JSON.stringify({ v: 1, state: { scope: 'weird' } }));
    expect(loadOrInitialState(storage)).toEqual(initialWizardState());
  });

  it('works without a storage', () => {
    expect(() => saveWizardState(initialWizardState(), null)).not.toThrow();
    expect(loadWizardState(null)).toBeNull();
  });

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => saveWizardState(initialWizardState(), broken)).not.toThrow();
    expect(loadWizardState(broken)).toBeNull();
    expect(() => clearWizardSession(broken)).not.toThrow();
  });
});

describe('generation pointer', () => {
  it('stores only the pointer fields and never the confirmation fingerprint', () => {
    const storage = memoryStorage();
    const withFingerprint = {
      generationId: 'g1',
      target: '/tmp/p',
      lastSeq: 7,
      lastStatus: 'running',
      fingerprint: 'abcdef0123456789',
    };
    saveGenerationPointer(withFingerprint, storage);
    const raw = storage.getItem(WIZARD_GENERATION_KEY) ?? '';
    expect(raw).not.toContain('fingerprint');
    expect(raw).not.toContain('abcdef0123456789');
    expect(JSON.parse(raw)).toEqual({ generationId: 'g1', target: '/tmp/p', lastSeq: 7, lastStatus: 'running' });
    expect(loadGenerationPointer(storage)).toEqual({ generationId: 'g1', target: '/tmp/p', lastSeq: 7, lastStatus: 'running' });
  });

  it('keeps the fingerprint out of every wizard key', () => {
    const storage = memoryStorage();
    saveWizardState(initialWizardState(), storage);
    saveGenerationPointer({ generationId: 'g', target: '/t', lastSeq: 0, lastStatus: 'running' }, storage);
    savePendingIdea('idea', storage);
    expect([...storage.data.values()].join('')).not.toMatch(/fingerprint/i);
  });

  it('rejects a malformed pointer', () => {
    const storage = memoryStorage();
    storage.setItem(WIZARD_GENERATION_KEY, JSON.stringify({ generationId: 'g', target: '/t', lastSeq: -1, lastStatus: 'x' }));
    expect(loadGenerationPointer(storage)).toBeNull();
    storage.setItem(WIZARD_GENERATION_KEY, JSON.stringify({ generationId: 3 }));
    expect(loadGenerationPointer(storage)).toBeNull();
  });
});

describe('pending idea and session reset', () => {
  it('keeps the idea until the session is cleared', () => {
    const storage = memoryStorage();
    savePendingIdea('Armá la primera spec', storage);
    expect(loadPendingIdea(storage)).toBe('Armá la primera spec');
    saveWizardState(initialWizardState(), storage);
    saveGenerationPointer({ generationId: 'g', target: '/t', lastSeq: 0, lastStatus: 'running' }, storage);
    clearWizardSession(storage);
    expect(storage.data.size).toBe(0);
    expect(loadPendingIdea(storage)).toBeNull();
  });
});
