import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MAX_DIR_ENTRIES } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listDirs, type DirsContext } from '../dirs';
import { nativeRealpath } from '../fs-paths';

let base: string;
let outside: string;
let ctx: DirsContext;
beforeEach(async () => {
  base = await nativeRealpath(await mkdtemp(path.join(tmpdir(), 'dirs-base-')));
  outside = await nativeRealpath(await mkdtemp(path.join(tmpdir(), 'dirs-outside-')));
  ctx = { bases: [base], start: base, platform: process.platform === 'win32' ? 'win32' : 'posix', showHidden: false };
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

describe('listDirs', () => {
  it('lists only directories, sorted, hiding dot folders by default', async () => {
    await mkdir(path.join(base, 'b'));
    await mkdir(path.join(base, 'a'));
    await mkdir(path.join(base, '.hidden'));
    await writeFile(path.join(base, 'file.txt'), '');
    expect((await listDirs(undefined, ctx)).entries).toEqual([
      { name: 'a', symlink: false },
      { name: 'b', symlink: false },
    ]);
    expect((await listDirs(undefined, { ...ctx, showHidden: true })).entries.map((e) => e.name)).toEqual(['.hidden', 'a', 'b']);
  });

  it('starts at the suggested folder and offers the parent only inside the bases', async () => {
    await mkdir(path.join(base, 'a'));
    const root = await listDirs(undefined, ctx);
    expect(root).toMatchObject({ path: base, parent: null, truncated: false });
    expect(await listDirs(path.join(base, 'a'), ctx)).toMatchObject({ path: path.join(base, 'a'), parent: base });
  });

  it('rejects paths outside the bases, malformed paths, files and missing folders', async () => {
    await writeFile(path.join(base, 'file.txt'), '');
    await expect(listDirs(outside, ctx)).rejects.toMatchObject({ code: 'bad-path' });
    await expect(listDirs('relative', ctx)).rejects.toMatchObject({ code: 'bad-path' });
    await expect(listDirs(`${base}${path.sep}a${path.sep}..${path.sep}b`, ctx)).rejects.toMatchObject({ code: 'bad-path' });
    await expect(listDirs(path.join(base, 'file.txt'), ctx)).rejects.toMatchObject({ code: 'bad-path' });
    await expect(listDirs(path.join(base, 'missing'), ctx)).rejects.toMatchObject({ code: 'not-found' });
  });

  it.skipIf(process.platform === 'win32')('flags symlinks to directories, drops broken ones and refuses to enter an escaping one', async () => {
    await symlink(outside, path.join(base, 'escape'));
    await symlink(path.join(base, 'nowhere'), path.join(base, 'broken'));
    expect((await listDirs(undefined, ctx)).entries).toEqual([{ name: 'escape', symlink: true }]);
    await expect(listDirs(path.join(base, 'escape'), ctx)).rejects.toMatchObject({ code: 'bad-path' });
  });

  it('truncates at MAX_DIR_ENTRIES', async () => {
    await Promise.all(Array.from({ length: MAX_DIR_ENTRIES + 5 }, (_, i) => mkdir(path.join(base, `d${String(i).padStart(4, '0')}`))));
    const listing = await listDirs(undefined, ctx);
    expect(listing.entries).toHaveLength(MAX_DIR_ENTRIES);
    expect(listing.truncated).toBe(true);
  });
});
