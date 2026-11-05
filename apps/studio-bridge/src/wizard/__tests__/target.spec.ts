import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nativeRealpath, validatePathShape, type PathPlatform } from '../fs-paths';
import { checkTarget, isGeneratable, type TargetContext } from '../target';

const TOLERATED = ['.git', '.gitignore', 'README.md', 'harness.config.json', 'harness.idea.md'];
const hostPlatform: PathPlatform = process.platform === 'win32' ? 'win32' : 'posix';

let base: string;
let outside: string;
let ctx: TargetContext;
beforeEach(async () => {
  base = await nativeRealpath(await mkdtemp(path.join(tmpdir(), 'target-base-')));
  outside = await nativeRealpath(await mkdtemp(path.join(tmpdir(), 'target-outside-')));
  ctx = { bases: [base], projectRoot: null, platform: hostPlatform, tolerated: TOLERATED };
});
afterEach(async () => {
  await chmod(path.join(base, 'locked'), 0o755).catch(() => undefined);
  await rm(base, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

describe.each<[PathPlatform, string, string, string | null]>([
  ['posix', 'absolute', '/home/dev/proj', null],
  ['posix', 'relative', 'proj/app', 'relative'],
  ['posix', 'dot segment', '/home/dev/../etc', 'dot-segment'],
  ['posix', 'current dir segment', '/home/dev/./proj', 'dot-segment'],
  ['posix', 'NUL', '/home/dev/pro\0j', 'bad-char'],
  ['posix', 'too long', `/${'a'.repeat(1024)}`, 'too-long'],
  ['posix', 'colon is a valid posix char', '/home/dev/a:b', null],
  ['posix', 'reserved names are valid on posix', '/home/dev/CON', null],
  ['win32', 'drive path', 'C:\\Users\\dev\\proj', null],
  ['win32', 'drive path with forward slashes', 'C:/Users/dev/proj', null],
  ['win32', 'UNC', '\\\\server\\share\\proj', 'unc'],
  ['win32', 'device path', '\\\\?\\C:\\proj', 'unc'],
  ['win32', 'drive-relative', 'C:proj', 'relative'],
  ['win32', 'rooted without drive', '\\Users\\dev', 'relative'],
  ['win32', 'dot segment', 'C:\\Users\\..\\Windows', 'dot-segment'],
  ['win32', 'forbidden char', 'C:\\Users\\de?v', 'bad-char'],
  ['win32', 'colon in segment', 'C:\\Users\\a:b', 'bad-char'],
  ['win32', 'reserved name', 'C:\\Users\\NUL', 'reserved-name'],
  ['win32', 'reserved name with extension', 'C:\\Users\\com1.txt', 'reserved-name'],
  ['win32', 'trailing dot', 'C:\\Users\\proj.', 'bad-char'],
  ['win32', 'trailing space', 'C:\\Users\\proj ', 'bad-char'],
])('validatePathShape (%s)', (platform, label, input, expected) => {
  it(`${label} -> ${expected ?? 'ok'}`, () => {
    expect(validatePathShape(input, platform)).toBe(expected);
  });
});

describe('checkTarget', () => {
  it('rejects malformed input as invalid without touching the filesystem', async () => {
    expect(await checkTarget('relative/dir', ctx)).toMatchObject({ state: 'invalid', reason: 'relative', resolvedPath: null });
    expect(await checkTarget(`${base}${path.sep}a${path.sep}..${path.sep}b`, ctx)).toMatchObject({ state: 'invalid', reason: 'dot-segment' });
  });

  it('reports a missing folder as creatable, with a fingerprint and no confirmation', async () => {
    const target = path.join(base, 'a', 'b', 'new-project');
    const check = await checkTarget(target, ctx);
    expect(check).toMatchObject({ state: 'missing', resolvedPath: target, needsConfirmation: false, insideProject: false });
    expect(check.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(isGeneratable(check)).toBe(true);
  });

  it('reports an empty folder', async () => {
    const target = path.join(base, 'empty');
    await mkdir(target);
    expect(await checkTarget(target, ctx)).toMatchObject({ state: 'empty', needsConfirmation: false, entries: { count: 0, sample: [], conflicting: [], notable: [] } });
  });

  it('reports tolerated content with confirmation and notable entries', async () => {
    const target = path.join(base, 'tolerated');
    await mkdir(path.join(target, '.git'), { recursive: true });
    await writeFile(path.join(target, 'README.md'), '');
    await writeFile(path.join(target, 'harness.config.json'), '{}');
    const check = await checkTarget(target, ctx);
    expect(check).toMatchObject({ state: 'tolerated', needsConfirmation: true, entries: { count: 3, notable: ['.git', 'harness.config.json'] } });
    expect(isGeneratable(check)).toBe(true);
  });

  it('blocks non tolerated content, including sdd/', async () => {
    const target = path.join(base, 'busy');
    await mkdir(path.join(target, 'sdd'), { recursive: true });
    await writeFile(path.join(target, 'package.json'), '{}');
    await writeFile(path.join(target, 'README.md'), '');
    const check = await checkTarget(target, ctx);
    expect(check).toMatchObject({ state: 'conflicting', needsConfirmation: false, fingerprint: null, entries: { conflicting: ['package.json', 'sdd'] } });
    expect(isGeneratable(check)).toBe(false);
  });

  it('caps the conflicting and sample lists at ten names', async () => {
    const target = path.join(base, 'many');
    await mkdir(target);
    for (let i = 0; i < 15; i++) await writeFile(path.join(target, `f${String(i).padStart(2, '0')}.txt`), '');
    const { entries } = await checkTarget(target, ctx);
    expect(entries).toMatchObject({ count: 15 });
    expect(entries!.conflicting).toHaveLength(10);
    expect(entries!.sample).toHaveLength(10);
  });

  it('rejects a file as not-directory, and a path below a file', async () => {
    const file = path.join(base, 'file.txt');
    await writeFile(file, '');
    expect(await checkTarget(file, ctx)).toMatchObject({ state: 'not-directory', reason: 'file' });
    expect(await checkTarget(path.join(file, 'child'), ctx)).toMatchObject({ state: 'not-directory', reason: 'ancestor' });
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('rejects a non writable folder and a non writable parent', async () => {
    const locked = path.join(base, 'locked');
    await mkdir(path.join(locked, 'inner'), { recursive: true });
    await chmod(locked, 0o555);
    expect(await checkTarget(path.join(locked, 'inner'), ctx)).toMatchObject({ state: 'empty' });
    expect(await checkTarget(path.join(locked, 'new'), ctx)).toMatchObject({ state: 'not-writable', reason: 'parent' });
    await chmod(path.join(locked, 'inner'), 0o555);
    expect(await checkTarget(path.join(locked, 'inner'), ctx)).toMatchObject({ state: 'not-writable', reason: 'target' });
    await chmod(path.join(locked, 'inner'), 0o755);
  });

  it('rejects paths outside the allowed bases and the base itself', async () => {
    expect(await checkTarget(path.join(outside, 'proj'), ctx)).toMatchObject({ state: 'outside-allowed', reason: 'outside' });
    expect(await checkTarget(base, ctx)).toMatchObject({ state: 'outside-allowed', reason: 'base-itself' });
    expect(await checkTarget(path.parse(base).root, ctx)).toMatchObject({ state: 'outside-allowed' });
  });

  it('accepts any of several bases', async () => {
    const both = { ...ctx, bases: [base, outside] };
    expect(await checkTarget(path.join(outside, 'proj'), both)).toMatchObject({ state: 'missing' });
  });

  it.skipIf(process.platform === 'win32')('resolves a symlink that escapes the base through realpath', async () => {
    await symlink(outside, path.join(base, 'escape'));
    expect(await checkTarget(path.join(base, 'escape', 'proj'), ctx)).toMatchObject({ state: 'outside-allowed', reason: 'outside', resolvedPath: path.join(outside, 'proj') });
  });

  it.skipIf(process.platform === 'win32')('resolves a symlink that stays inside the base to its real folder', async () => {
    const real = path.join(base, 'real');
    await mkdir(real);
    await symlink(real, path.join(base, 'alias'));
    expect(await checkTarget(path.join(base, 'alias', 'proj'), ctx)).toMatchObject({ state: 'missing', resolvedPath: path.join(real, 'proj') });
  });

  it('flags a target inside the connected project and asks for confirmation even when empty or missing', async () => {
    const project = path.join(base, 'project');
    await mkdir(path.join(project, 'sub'), { recursive: true });
    const inProject = { ...ctx, projectRoot: project };
    expect(await checkTarget(path.join(project, 'sub'), inProject)).toMatchObject({ state: 'empty', insideProject: true, needsConfirmation: true });
    expect(await checkTarget(path.join(project, 'new'), inProject)).toMatchObject({ state: 'missing', insideProject: true, needsConfirmation: true });
    expect(await checkTarget(path.join(base, 'elsewhere'), inProject)).toMatchObject({ insideProject: false, needsConfirmation: false });
  });

  it('never reports insideProject in launcher mode and blocks a target that contains the project', async () => {
    const project = path.join(base, 'parent', 'project');
    await mkdir(project, { recursive: true });
    expect(await checkTarget(path.join(base, 'parent'), ctx)).toMatchObject({ state: 'conflicting', insideProject: false });
    expect(await checkTarget(path.join(base, 'parent'), { ...ctx, projectRoot: project })).toMatchObject({ state: 'conflicting', needsConfirmation: false });
  });

  it('keeps the fingerprint stable and changes it when the folder changes', async () => {
    const target = path.join(base, 'fp');
    await mkdir(path.join(target, '.git'), { recursive: true });
    const first = await checkTarget(target, ctx);
    expect((await checkTarget(target, ctx)).fingerprint).toBe(first.fingerprint);
    await writeFile(path.join(target, 'README.md'), '');
    const second = await checkTarget(target, ctx);
    expect(second.state).toBe('tolerated');
    expect(second.fingerprint).not.toBe(first.fingerprint);
    await writeFile(path.join(target, 'package.json'), '{}');
    expect((await checkTarget(target, ctx)).state).toBe('conflicting');
  });
});
