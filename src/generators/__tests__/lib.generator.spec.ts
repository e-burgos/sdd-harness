import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import { generateLib } from '../lib.generator.js';

describe('lib.generator', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(resolve(tmpdir(), 'harness-lib-'));
    // Simular estructura de workspace con libs/
    fs.ensureDirSync(resolve(tmpDir, 'libs'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('genera shared-types con project.json y tsconfig', async () => {
    await generateLib(
      tmpDir,
      { name: 'shared-types', type: 'shared-types' },
      '@test',
    );

    const libDir = resolve(tmpDir, 'libs/shared-types');
    expect(fs.existsSync(resolve(libDir, 'project.json'))).toBe(true);
    expect(fs.existsSync(resolve(libDir, 'tsconfig.json'))).toBe(true);
    expect(fs.existsSync(resolve(libDir, 'tsconfig.lib.json'))).toBe(true);
    expect(fs.existsSync(resolve(libDir, 'src'))).toBe(true);

    const projectJson = JSON.parse(
      fs.readFileSync(resolve(libDir, 'project.json'), 'utf-8'),
    );
    expect(projectJson.name).toBe('shared-types');
    expect(projectJson.projectType).toBe('library');
  });

  it('genera shared-utils con index.ts', async () => {
    await generateLib(
      tmpDir,
      { name: 'shared-utils', type: 'shared-utils' },
      '@test',
    );

    const libDir = resolve(tmpDir, 'libs/shared-utils');
    expect(fs.existsSync(resolve(libDir, 'project.json'))).toBe(true);
    expect(fs.existsSync(resolve(libDir, 'src'))).toBe(true);
  });

  it('genera ui-kit con estructura correcta', async () => {
    await generateLib(tmpDir, { name: 'ui-kit', type: 'ui-kit' }, '@myproject');

    const libDir = resolve(tmpDir, 'libs/ui-kit');
    expect(fs.existsSync(resolve(libDir, 'project.json'))).toBe(true);

    const projectJson = JSON.parse(
      fs.readFileSync(resolve(libDir, 'project.json'), 'utf-8'),
    );
    expect(projectJson.name).toBe('ui-kit');
  });

  it('genera api-client', async () => {
    await generateLib(
      tmpDir,
      { name: 'api-client', type: 'api-client' },
      '@myapp',
    );

    const libDir = resolve(tmpDir, 'libs/api-client');
    expect(fs.existsSync(resolve(libDir, 'project.json'))).toBe(true);
    expect(fs.existsSync(resolve(libDir, 'src'))).toBe(true);
  });

  it('genera config lib', async () => {
    await generateLib(tmpDir, { name: 'config', type: 'config' }, '@myapp');

    const libDir = resolve(tmpDir, 'libs/config');
    expect(fs.existsSync(resolve(libDir, 'project.json'))).toBe(true);
  });
});
