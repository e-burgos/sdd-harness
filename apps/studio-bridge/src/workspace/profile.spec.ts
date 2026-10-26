import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProfileError, writeProfile } from './profile';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'profile-'));
  await mkdir(path.join(root, 'sdd'));
});
afterEach(() => rm(root, { recursive: true, force: true }));

const globalFile = () => path.join(root, 'sdd', 'global.json');
const readGlobal = async () => JSON.parse(await readFile(globalFile(), 'utf8')) as Record<string, unknown>;

describe('writeProfile', () => {
  it('adds the profile and keeps every other field', async () => {
    await writeFile(globalFile(), JSON.stringify({ project: 'p', version: '1', pending_modules: [] }));
    await writeProfile(root, 'solo');
    expect(await readGlobal()).toEqual({ project: 'p', version: '1', pending_modules: [], profile: 'solo' });
  });

  it('switches an existing profile in place and ends the file with a newline', async () => {
    await writeFile(globalFile(), JSON.stringify({ project: 'p', profile: 'team', version: '1' }, null, 2));
    await writeProfile(root, 'solo');
    const raw = await readFile(globalFile(), 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(Object.keys(JSON.parse(raw))).toEqual(['project', 'profile', 'version']);
    expect((await readGlobal()).profile).toBe('solo');
  });

  it('leaves no temporary file behind', async () => {
    await writeFile(globalFile(), '{}');
    await writeProfile(root, 'team');
    expect(await readdir(path.join(root, 'sdd'))).toEqual(['global.json']);
  });

  it('reports a missing global.json as not-found', async () => {
    await expect(writeProfile(root, 'solo')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('refuses a global.json that is not a JSON object and does not touch it', async () => {
    for (const content of ['not json', '[]', '"x"']) {
      await writeFile(globalFile(), content);
      await expect(writeProfile(root, 'solo')).rejects.toBeInstanceOf(ProfileError);
      expect(await readFile(globalFile(), 'utf8')).toBe(content);
    }
  });
});
