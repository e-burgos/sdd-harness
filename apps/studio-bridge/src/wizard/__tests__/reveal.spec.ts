import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nativeRealpath } from '../fs-paths';
import { revealPath } from '../reveal';

let base: string;
let outside: string;
beforeEach(async () => {
  base = await nativeRealpath(await mkdtemp(path.join(tmpdir(), 'reveal-base-')));
  outside = await nativeRealpath(await mkdtemp(path.join(tmpdir(), 'reveal-outside-')));
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

const opener = () => {
  const calls: { cmd: string; args: string[] }[] = [];
  return { calls, open: (cmd: string, args: string[]) => void calls.push({ cmd, args }) };
};

describe('revealPath', () => {
  it('opens a folder inside the allowed bases with the platform opener', async () => {
    const project = path.join(base, 'project');
    await mkdir(project);
    const spy = opener();
    await revealPath(project, { bases: [base], platform: 'darwin', open: spy.open });
    expect(spy.calls).toEqual([{ cmd: 'open', args: [project] }]);
    await revealPath(project, { bases: [base], platform: 'win32', open: spy.open });
    expect(spy.calls[1]).toEqual({ cmd: 'rundll32', args: ['url.dll,FileProtocolHandler', project] });
  });

  it('refuses folders outside the bases and the base itself', async () => {
    const spy = opener();
    await expect(revealPath(outside, { bases: [base], open: spy.open })).rejects.toMatchObject({ code: 'bad-path' });
    await expect(revealPath(base, { bases: [base], open: spy.open })).rejects.toMatchObject({ code: 'bad-path' });
    expect(spy.calls).toEqual([]);
  });

  it('refuses a missing path and a file', async () => {
    const spy = opener();
    await writeFile(path.join(base, 'file.txt'), '');
    await expect(revealPath(path.join(base, 'missing'), { bases: [base], open: spy.open })).rejects.toMatchObject({ code: 'not-found' });
    await expect(revealPath(path.join(base, 'file.txt'), { bases: [base], open: spy.open })).rejects.toMatchObject({ code: 'bad-path' });
  });

  it.skipIf(process.platform === 'win32')('resolves symlinks before checking the bases', async () => {
    await symlink(outside, path.join(base, 'escape'));
    const spy = opener();
    await expect(revealPath(path.join(base, 'escape'), { bases: [base], open: spy.open })).rejects.toMatchObject({ code: 'bad-path' });
    expect(spy.calls).toEqual([]);
  });
});
