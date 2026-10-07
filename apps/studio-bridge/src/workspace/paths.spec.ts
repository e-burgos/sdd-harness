import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixture } from '../test-utils/fixture';
import { PathError, resolveSddPath } from './paths';

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await copyFixture()));
afterEach(() => cleanup());

describe('resolveSddPath', () => {
  it('resolves a file under sdd/', async () => {
    const p = await resolveSddPath(root, 'sdd/global.json');
    expect(p.endsWith(path.join('sdd', 'global.json'))).toBe(true);
  });

  it.each(['../x', 'sdd/../package.json', '/etc/passwd', 'C:/x', 'C:\\x', 'sdd/.secret', 'other/x', 'sdd//x', 'sdd', ''])(
    'rejects %j',
    async (rel) => {
      await expect(resolveSddPath(root, rel)).rejects.toMatchObject({ code: 'bad-path' });
    },
  );

  it('reports missing files as not-found', async () => {
    await expect(resolveSddPath(root, 'sdd/nope.json')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('rejects a symlink that escapes sdd/', async (ctx) => {
    await writeFile(path.join(root, 'outside.txt'), 'secret');
    try {
      await symlink(path.join(root, 'outside.txt'), path.join(root, 'sdd', 'link.txt'));
    } catch {
      return ctx.skip();
    }
    await expect(resolveSddPath(root, 'sdd/link.txt')).rejects.toBeInstanceOf(PathError);
  });

  it('rejects a symlinked sdd/ that points outside the root', async (ctx) => {
    const outside = await mkdtemp(path.join(tmpdir(), 'sdd outside '));
    try {
      await cp(path.join(root, 'sdd'), outside, { recursive: true });
      await rm(path.join(root, 'sdd'), { recursive: true });
      try {
        await symlink(outside, path.join(root, 'sdd'), 'dir');
      } catch {
        return ctx.skip();
      }
      await expect(resolveSddPath(root, 'sdd/global.json')).rejects.toMatchObject({ code: 'bad-path' });
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('rejects a symlink inside sdd/ that reaches a dot segment', async (ctx) => {
    await mkdir(path.join(root, 'sdd', '.hidden'));
    await writeFile(path.join(root, 'sdd', '.hidden', 'secret.json'), '{}');
    try {
      await symlink(path.join(root, 'sdd', '.hidden', 'secret.json'), path.join(root, 'sdd', 'link.json'));
    } catch {
      return ctx.skip();
    }
    await expect(resolveSddPath(root, 'sdd/link.json')).rejects.toMatchObject({ code: 'bad-path' });
  });

  it('reports a missing sdd/ as not-found', async () => {
    await rm(path.join(root, 'sdd'), { recursive: true });
    await expect(resolveSddPath(root, 'sdd/global.json')).rejects.toMatchObject({ code: 'not-found' });
  });
});
