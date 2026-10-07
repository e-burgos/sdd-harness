import { symlink, writeFile } from 'node:fs/promises';
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

  it.each(['../x', 'sdd/../package.json', '/etc/passwd', 'C:/x', 'C:\\x', 'sdd/.secret', 'other/x', 'sdd//x', ''])(
    'rejects %j',
    async (rel) => {
      await expect(resolveSddPath(root, rel)).rejects.toMatchObject({ code: 'bad-path' });
    },
  );

  it('reports missing files as not-found', async () => {
    await expect(resolveSddPath(root, 'sdd/nope.json')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('rejects a symlink that escapes sdd/', async () => {
    await writeFile(path.join(root, 'outside.txt'), 'secret');
    try {
      await symlink(path.join(root, 'outside.txt'), path.join(root, 'sdd', 'link.txt'));
    } catch {
      return; // Windows sin privilegio de symlink: el caso no aplica.
    }
    await expect(resolveSddPath(root, 'sdd/link.txt')).rejects.toBeInstanceOf(PathError);
  });
});
