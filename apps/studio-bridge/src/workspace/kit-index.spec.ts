import { mkdir, mkdtemp, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KitIndex as KitIndexSchema, MAX_KIT_ENTRIES } from '@sdd-studio/protocol';
import { KitIndexer, buildKitIndex, changedKitSections, isKitPath } from './kit-index';

let root: string;

const put = async (relative: string, content = 'x'): Promise<string> => {
  const absolute = path.join(root, relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content);
  return absolute;
};

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'kit-index-'));
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(root, { recursive: true, force: true });
});

describe('buildKitIndex', () => {
  it('skips entries whose path or group exceed the protocol bounds', async () => {
    await put(`sdd/context/apps/${'a'.repeat(130)}/constitution.md`);
    await put(`sdd/context/tools/${'d'.repeat(250)}/updates/${'e'.repeat(250)}.md`);
    await put('sdd/documentation/es/guia.md');
    const { index } = await buildKitIndex(root);
    expect(index.entries.map((e) => e.path)).toEqual(['sdd/documentation/es/guia.md']);
    expect(KitIndexSchema.safeParse(index).success).toBe(true);
  });

  it('returns an empty valid index when sdd/ is missing', async () => {
    const { index } = await buildKitIndex(root);
    expect(index.entries).toEqual([]);
    expect(index.truncated).toBe(false);
    expect(KitIndexSchema.safeParse(index).success).toBe(true);
  });

  it('enumerates every section with its role and group', async () => {
    await put('sdd/documentation/es/guia.md');
    await put('sdd/documentation/en/guide.md');
    await put('sdd/documentation/fr/ignored.md');
    await put('sdd/schemas/tools.schema.json');
    await put('sdd/context/constitution.md');
    await put('sdd/context/context_prompt.md');
    await put('sdd/context/updates/2026-01-01-a.md');
    await put('sdd/context/apps/studio/constitution.md');
    await put('sdd/context/libs/protocol/updates/2026-01-02-b.md');
    await put('sdd/context/tools/cli/context_prompt.md');
    await put('sdd/memory/lessons.md');
    await put('sdd/memory/journal/2026-01-01-x.md');
    await put('sdd/schema.json');
    await put('sdd/api.json');
    await put('sdd/components.json');
    const { index } = await buildKitIndex(root);
    const byPath = Object.fromEntries(index.entries.map((entry) => [entry.path, entry]));
    expect(byPath['sdd/documentation/es/guia.md']).toMatchObject({ section: 'docs', role: 'doc', group: 'es' });
    expect(byPath['sdd/documentation/en/guide.md']).toMatchObject({ section: 'docs', group: 'en' });
    expect(byPath['sdd/documentation/fr/ignored.md']).toBeUndefined();
    expect(byPath['sdd/schemas/tools.schema.json']).toMatchObject({ section: 'schemas', role: 'schema', group: null });
    expect(byPath['sdd/context/constitution.md']).toMatchObject({ section: 'context', role: 'base', group: 'global' });
    expect(byPath['sdd/context/updates/2026-01-01-a.md']).toMatchObject({ role: 'update', group: 'global' });
    expect(byPath['sdd/context/apps/studio/constitution.md']).toMatchObject({ role: 'base', group: 'apps/studio' });
    expect(byPath['sdd/context/libs/protocol/updates/2026-01-02-b.md']).toMatchObject({
      role: 'update',
      group: 'libs/protocol',
    });
    expect(byPath['sdd/context/tools/cli/context_prompt.md']).toMatchObject({ group: 'tools/cli' });
    expect(byPath['sdd/memory/lessons.md']).toMatchObject({ section: 'memory', role: 'lessons' });
    expect(byPath['sdd/memory/journal/2026-01-01-x.md']).toMatchObject({ role: 'journal' });
    for (const name of ['schema', 'api', 'components']) {
      expect(byPath[`sdd/${name}.json`]).toMatchObject({ section: 'registries', role: 'registry', group: null });
    }
    expect(KitIndexSchema.safeParse(index).success).toBe(true);
  });

  it('orders entries by path and reports size and ISO mtime', async () => {
    await put('sdd/schemas/b.json', '12345');
    await put('sdd/schemas/a.json');
    const { index } = await buildKitIndex(root);
    expect(index.entries.map((entry) => entry.path)).toEqual(['sdd/schemas/a.json', 'sdd/schemas/b.json']);
    expect(index.entries[1]?.size).toBe(5);
    expect(new Date(index.entries[1]?.mtime ?? '').toISOString()).toBe(index.entries[1]?.mtime);
  });

  it('ignores dotfiles, non-matching extensions, directories and symlinks', async () => {
    await put('sdd/schemas/ok.json');
    await put('sdd/schemas/.hidden.json');
    await put('sdd/schemas/readme.txt');
    await mkdir(path.join(root, 'sdd/schemas/nested.json'), { recursive: true });
    const outside = await put('outside.json');
    await symlink(outside, path.join(root, 'sdd/schemas/link.json'));
    await put('sdd/context/.secret/constitution.md');
    const { index } = await buildKitIndex(root);
    expect(index.entries.map((entry) => entry.path)).toEqual(['sdd/schemas/ok.json']);
  });

  it('truncates at the maximum entry count', async () => {
    await mkdir(path.join(root, 'sdd/memory/journal'), { recursive: true });
    const total = MAX_KIT_ENTRIES + 5;
    await Promise.all(
      Array.from({ length: total }, (_, i) =>
        writeFile(path.join(root, 'sdd/memory/journal', `e-${String(i).padStart(5, '0')}.md`), ''),
      ),
    );
    const { index } = await buildKitIndex(root);
    expect(index.entries).toHaveLength(MAX_KIT_ENTRIES);
    expect(index.truncated).toBe(true);
    expect(KitIndexSchema.safeParse(index).success).toBe(true);
  });

  it('changes only the fingerprint of the touched section', async () => {
    await put('sdd/schemas/a.json');
    await put('sdd/memory/lessons.md');
    const before = await buildKitIndex(root);
    const lessons = await put('sdd/memory/lessons.md', 'changed content');
    const later = new Date(Date.now() + 5000);
    await utimes(lessons, later, later);
    const after = await buildKitIndex(root);
    expect(changedKitSections(before.fingerprints, after.fingerprints)).toEqual(['memory']);
    expect(after.index.revision).not.toBe(before.index.revision);
  });

  it('keeps the revision stable when nothing changes', async () => {
    await put('sdd/schemas/a.json');
    const first = await buildKitIndex(root);
    const second = await buildKitIndex(root);
    expect(second.index.revision).toBe(first.index.revision);
    expect(second.fingerprints).toEqual(first.fingerprints);
  });
});

describe('isKitPath', () => {
  it('accepts paths under kit roots and rejects the rest', () => {
    expect(isKitPath(root, path.join(root, 'sdd/memory/journal/a.md'))).toBe(true);
    expect(isKitPath(root, path.join(root, 'sdd/schema.json'))).toBe(true);
    expect(isKitPath(root, path.join(root, 'sdd/specs/x/spec.md'))).toBe(false);
    expect(isKitPath(root, path.join(root, 'apps/a.ts'))).toBe(false);
    expect(isKitPath(root, path.join(root, '..', 'elsewhere'))).toBe(false);
  });
});

describe('KitIndexer', () => {
  it('does not walk the tree until the first index request', async () => {
    const onChanged = vi.fn();
    const indexer = new KitIndexer({ root, onChanged });
    expect(indexer.isArmed()).toBe(false);
    indexer.notifyPath(path.join(root, 'sdd/memory/lessons.md'));
    await indexer.recompute();
    expect(onChanged).not.toHaveBeenCalled();
    await indexer.index();
    expect(indexer.isArmed()).toBe(true);
    indexer.close();
  });

  it('shares one build across concurrent first requests', async () => {
    await put('sdd/schemas/a.json');
    const indexer = new KitIndexer({ root, onChanged: vi.fn() });
    const [a, b] = await Promise.all([indexer.index(), indexer.index()]);
    expect(a).toBe(b);
    indexer.close();
  });

  it('emits kit.changed after a debounced path notification', async () => {
    await put('sdd/memory/lessons.md');
    const onChanged = vi.fn();
    const indexer = new KitIndexer({ root, onChanged, debounceMs: 20, rescanMs: 60_000 });
    const initial = await indexer.index();
    await put('sdd/memory/journal/new.md');
    indexer.notifyPath(path.join(root, 'sdd/memory/journal/new.md'));
    indexer.notifyPath(path.join(root, 'sdd/memory/journal/new.md'));
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    const change = onChanged.mock.calls[0]?.[0] as { sections: string[]; revision: string };
    expect(change.sections).toEqual(['memory']);
    expect(change.revision).not.toBe(initial.revision);
    expect((await indexer.index()).entries.some((entry) => entry.path.endsWith('new.md'))).toBe(true);
    indexer.close();
  });

  it('ignores notifications outside the kit roots', async () => {
    await put('sdd/memory/lessons.md');
    const onChanged = vi.fn();
    const indexer = new KitIndexer({ root, onChanged, debounceMs: 10, rescanMs: 60_000 });
    await indexer.index();
    await put('sdd/specs/x/spec.md');
    indexer.notifyPath(path.join(root, 'sdd/specs/x/spec.md'));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(onChanged).not.toHaveBeenCalled();
    indexer.close();
  });

  it('detects changes on the periodic rescan, including ignored directories', async () => {
    await put('sdd/documentation/es/a.md');
    const onChanged = vi.fn();
    const indexer = new KitIndexer({ root, onChanged, rescanMs: 25 });
    await indexer.index();
    await put('sdd/documentation/es/b.md');
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onChanged.mock.calls[0]?.[0].sections).toEqual(['docs']);
    indexer.close();
  });

  it('does not emit when a rescan finds nothing new', async () => {
    await put('sdd/schemas/a.json');
    const onChanged = vi.fn();
    const indexer = new KitIndexer({ root, onChanged, rescanMs: 60_000 });
    await indexer.index();
    await indexer.recompute();
    expect(onChanged).not.toHaveBeenCalled();
    indexer.close();
  });

  it('stops emitting after close', async () => {
    await put('sdd/schemas/a.json');
    const onChanged = vi.fn();
    const indexer = new KitIndexer({ root, onChanged, rescanMs: 20, debounceMs: 10 });
    await indexer.index();
    indexer.close();
    await put('sdd/schemas/b.json');
    indexer.notifyPath(path.join(root, 'sdd/schemas/b.json'));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(onChanged).not.toHaveBeenCalled();
  });
});
