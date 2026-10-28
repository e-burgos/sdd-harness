import type { KitEntry } from '@sdd-studio/protocol';
import { contextEntries, contextScopeCount, journalEntries, kitSelectionOf, parseKitSelection, prettyJson, resolveDoc, type KitView } from './kit-model';

const entry = (section: string, role: string, group: string | null, path: string): KitEntry => ({ section, role, group, path, size: 1, mtime: '2026-01-01T00:00:00Z' });

describe('kit selection ids', () => {
  const views: KitView[] = [
    { kind: 'capabilities', which: 'skills' },
    { kind: 'capabilities', which: 'agents' },
    { kind: 'tools' },
    { kind: 'doc', doc: 'how-to' },
    { kind: 'schemas' },
    { kind: 'context' },
    { kind: 'memory', which: 'journal' },
  ];

  it.each(views)('round-trips %o', (view) => {
    expect(parseKitSelection(kitSelectionOf(view))).toEqual(view);
  });

  it('rejects unknown ids', () => {
    expect(parseKitSelection(null)).toBeNull();
    expect(parseKitSelection('doc:unknown')).toBeNull();
    expect(parseKitSelection('memory:other')).toBeNull();
  });
});

describe('resolveDoc', () => {
  const entries = [entry('docs', 'doc', 'es', 'sdd/documentation/es/README.md'), entry('docs', 'doc', 'en', 'sdd/documentation/en/README.md'), entry('docs', 'doc', 'en', 'sdd/documentation/en/INSTALL.md')];

  it('prefers the UI language', () => {
    expect(resolveDoc(entries, 'readme', 'en')).toEqual({ path: 'sdd/documentation/en/README.md', language: 'en', fallback: false });
  });

  it('falls back to the other language and says so', () => {
    expect(resolveDoc(entries, 'install', 'es')).toEqual({ path: 'sdd/documentation/en/INSTALL.md', language: 'en', fallback: true });
  });

  it('returns null when the document is in no language', () => {
    expect(resolveDoc(entries, 'how-to', 'es')).toBeNull();
  });

  it('guesses the conventional path while the index is unavailable', () => {
    expect(resolveDoc(null, 'how-to', 'es')?.path).toBe('sdd/documentation/es/HOW-TO-USE-SDD.md');
  });
});

describe('context and memory ordering', () => {
  const entries = [
    entry('context', 'update', 'apps/studio', 'sdd/context/apps/studio/updates/2026-02.md'),
    entry('context', 'base', 'apps/studio', 'sdd/context/apps/studio/constitution.md'),
    entry('context', 'update', 'global', 'sdd/context/updates/2026-01.md'),
    entry('context', 'base', 'global', 'sdd/context/constitution.md'),
    entry('memory', 'journal', null, 'sdd/memory/journal/2026-01-01-a.md'),
    entry('memory', 'journal', null, 'sdd/memory/journal/2026-03-01-b.md'),
  ];

  it('lists global first, base before fragments, fragments by name', () => {
    expect(contextEntries(entries).map((e) => e.path)).toEqual([
      'sdd/context/constitution.md',
      'sdd/context/updates/2026-01.md',
      'sdd/context/apps/studio/constitution.md',
      'sdd/context/apps/studio/updates/2026-02.md',
    ]);
    expect(contextScopeCount(entries)).toBe(2);
  });

  it('lists the newest journal entry first', () => {
    expect(journalEntries(entries).map((e) => e.path)[0]).toBe('sdd/memory/journal/2026-03-01-b.md');
  });
});

describe('prettyJson', () => {
  it('indents valid json and leaves invalid text as it is', () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(prettyJson('not json')).toBe('not json');
  });
});
