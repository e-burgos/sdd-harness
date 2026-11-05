import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { CliLocatorError, locateHarnessCli } from '../cli-locator';

const dirs: string[] = [];
afterEach(async () => {
  while (dirs.length) await rm(dirs.pop()!, { recursive: true, force: true });
});

async function fakePackage(manifest: Record<string, unknown>, withBin: boolean) {
  const dir = await mkdtemp(path.join(tmpdir(), 'cli-locator-'));
  dirs.push(dir);
  await mkdir(path.join(dir, 'bin'), { recursive: true });
  await mkdir(path.join(dir, 'dist'), { recursive: true });
  await writeFile(path.join(dir, 'package.json'), JSON.stringify(manifest));
  await writeFile(path.join(dir, 'dist', 'index.js'), '');
  if (withBin) await writeFile(path.join(dir, 'bin', 'harness.mjs'), '');
  return { dir, resolve: () => pathToFileURL(path.join(dir, 'dist', 'index.js')).href };
}

describe('locateHarnessCli', () => {
  it('walks up from the entry to the package and joins the harness bin', async () => {
    const pkg = await fakePackage({ name: '@e-burgos/sdd-harness', version: '9.9.9', bin: { harness: './bin/harness.mjs' } }, true);
    expect(locateHarnessCli(pkg.resolve)).toEqual({ bin: path.join(pkg.dir, 'bin', 'harness.mjs'), version: '9.9.9' });
  });

  it('fails when the binary is missing', async () => {
    const pkg = await fakePackage({ name: '@e-burgos/sdd-harness', version: '9.9.9', bin: { harness: './bin/harness.mjs' } }, false);
    expect(() => locateHarnessCli(pkg.resolve)).toThrow(CliLocatorError);
  });

  it('fails when the package is not installed', () => {
    expect(() =>
      locateHarnessCli(() => {
        throw new Error('not found');
      }),
    ).toThrow(CliLocatorError);
  });

  it('resolves the installed workspace package', () => {
    const located = locateHarnessCli();
    expect(located.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(path.basename(located.bin)).toBe('harness.mjs');
  });
});
