import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileIndex } from './file-index';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'sdd-file-index-'));
});
afterEach(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

const touch = async (rel: string, content = 'x') => {
  await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await writeFile(path.join(root, rel), content);
};
const touchAll = (files: string[]) => Promise.all(files.map((file) => touch(file)));
const gitInit = () => execFileSync('git', ['init', '-q'], { cwd: root });
const pathsOf = async (index: ReturnType<typeof createFileIndex>, query: string, limit = 50) =>
  (await index.search(query, limit)).files.map((f) => f.path);

describe('file index exclusions and secrets', () => {
  const files = [
    'src/app.ts', '.env', '.env.local', '.env.production', '.env.example', '.env.sample', '.env.template',
    'keys/id_rsa', 'keys/id_rsa.pub', 'keys/id_ed25519', 'certs/site.pem', 'certs/site.key', 'certs/a.p12', 'certs/a.pfx', 'certs/a.keystore',
    '.npmrc', '.netrc', 'node_modules/pkg/index.js', 'dist/out.js', 'coverage/lcov.info', '.next/cache.js', '.nx/cache.json',
    '.sdd-studio/threads.json', '.claude/worktrees/wt/src/app.ts', '.claude/agents/a.md',
  ];
  const hidden = [
    '.env', '.env.local', '.env.production', 'keys/id_rsa', 'keys/id_rsa.pub', 'keys/id_ed25519', 'certs/site.pem', 'certs/site.key',
    'certs/a.p12', 'certs/a.pfx', 'certs/a.keystore', '.npmrc', '.netrc', 'node_modules/pkg/index.js', 'dist/out.js', 'coverage/lcov.info',
    '.next/cache.js', '.nx/cache.json', '.sdd-studio/threads.json', '.claude/worktrees/wt/src/app.ts',
  ];
  const shown = ['.env.example', '.env.sample', '.env.template', 'src/app.ts', '.claude/agents/a.md'];

  it.each([
    ['git', true],
    ['walk', false],
  ])('hides secrets and generated folders with the %s source', async (source, useGit) => {
    await touchAll(files);
    if (useGit) gitInit();
    const index = createFileIndex(root);
    const seen = new Set((await Promise.all(['e', 'a', 's', 'k', 'n', 'd', 'c', 'x', '.'].map((q) => pathsOf(index, q)))).flat());
    for (const file of hidden) expect(seen.has(file), file).toBe(false);
    for (const file of shown) expect(seen.has(file), file).toBe(true);
    expect((await index.search('app', 5)).source).toBe(source);
  });
});

describe('file index source selection', () => {
  it('falls back to the walk outside a git repo and does not follow directory symlinks', async () => {
    await touch('real/inside.ts');
    await symlink('/etc', path.join(root, 'linked-dir'));
    const index = createFileIndex(root);
    expect(await index.search('hosts', 10)).toMatchObject({ files: [], source: 'walk' });
    expect(await pathsOf(index, 'inside')).toEqual(['real/inside.ts']);
  });

  it('respects .gitignore in a git repo', async () => {
    gitInit();
    await touchAll(['kept.ts', 'ignored.ts']);
    await writeFile(path.join(root, '.gitignore'), 'ignored.ts\n');
    expect(await pathsOf(createFileIndex(root), 'ts')).toEqual(['kept.ts']);
  });

  it('drops symlinks that resolve outside the root and fills the page with the next entries', async () => {
    gitInit();
    await symlink('/etc/hosts', path.join(root, 'aaa-hosts-link.txt'));
    await touch('zzz-hosts.txt');
    const result = await createFileIndex(root).search('hosts', 1);
    expect(result.files).toEqual([{ path: 'zzz-hosts.txt' }]);
  });

  it('keeps a symlink that resolves inside the root', async () => {
    await touch('docs/guide.md');
    await symlink(path.join(root, 'docs', 'guide.md'), path.join(root, 'guide-link.md'));
    expect(await pathsOf(createFileIndex(root), 'guide')).toEqual(['docs/guide.md', 'guide-link.md']);
  });

  it('ignores listed names with traversal, absolute, backslash or NUL content', async () => {
    const index = createFileIndex(root, {
      listGit: async () => ['ok/file.ts', '../escape.ts', 'a/../b.ts', '/abs/x.ts', 'a\\b.ts', 'n\0ul.ts', 'a//b.ts', './c.ts', `${'x'.repeat(1030)}.ts`],
    });
    await touch('ok/file.ts');
    expect(await pathsOf(index, 'ts')).toEqual(['ok/file.ts']);
  });
});

describe('file index ranking and paging', () => {
  const listed = ['docs/readme.md', 'readme.md', 'src/read/me.ts', 'a/b/r-e-a-d-m-e.txt', 'src/other.ts'];
  const index = () => createFileIndex(root, { listGit: async () => listed });
  beforeEach(() => touchAll(listed));

  it('ranks basename prefix, basename substring, path substring and subsequence, shorter paths first', async () => {
    const files = ['x/dir-foo/zzz.ts', 'x/foo-bar.ts', 'foobar.ts', 'x/a-foo.ts', 'f/o/o.txt'];
    await touchAll(files);
    const idx = createFileIndex(root, { listGit: async () => files });
    expect(await pathsOf(idx, 'foo')).toEqual(['foobar.ts', 'x/foo-bar.ts', 'x/a-foo.ts', 'x/dir-foo/zzz.ts', 'f/o/o.txt']);
  });

  it('is case insensitive and empty queries return nothing', async () => {
    expect(await pathsOf(index(), 'READ')).toContain('readme.md');
    expect((await index().search('   ', 5)).files).toEqual([]);
  });

  it('flags truncation only when more matches remain', async () => {
    expect(await index().search('readme', 1)).toMatchObject({ truncated: true });
    expect(await index().search('readme', 50)).toMatchObject({ truncated: false });
  });

  it('a query with .. is only a string to match against names', async () => {
    expect(await pathsOf(index(), '../../etc/passwd')).toEqual([]);
  });
});

describe('file index cache', () => {
  it('runs git once for searches within the ttl and again after it expires', async () => {
    let clock = 0;
    const listGit = vi.fn(async () => ['a.ts']);
    await touch('a.ts');
    const index = createFileIndex(root, { listGit, now: () => clock });
    await Promise.all([index.search('a', 5), index.search('a', 5)]);
    clock = 14_999;
    await index.search('a', 5);
    expect(listGit).toHaveBeenCalledTimes(1);
    clock = 15_000;
    await index.search('a', 5);
    expect(listGit).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed listing', async () => {
    const listGit = vi.fn<(root: string) => Promise<string[] | null>>().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(['a.ts']);
    await touch('a.ts');
    const index = createFileIndex(root, { listGit });
    await expect(index.search('a', 5)).rejects.toMatchObject({ code: 'internal', message: 'file index unavailable' });
    expect(await pathsOf(index, 'a')).toEqual(['a.ts']);
  });
});
