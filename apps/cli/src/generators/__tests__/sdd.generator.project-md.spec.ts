import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

vi.mock('../../utils/exec.js', () => ({
  exec: vi.fn(() => {
    throw new Error('Command failed: setup-agents');
  }),
  execSilent: vi.fn(() => ''),
}));

import { generateSDD } from '../sdd.generator.js';
import { ABSORBED_HEADING } from '../project-md.js';

const KIT_DUAL = resolve(__dirname, '../../../templates/sdd/dual-harness');

describe('configure sdd — lo absorbido va a sdd/dual-harness/project.md', () => {
  let root: string;
  const OPTS = {
    projectName: 'legacy-repo',
    description: 'Repo existente.',
    packageScope: '@legacy-repo',
    apps: [{ name: 'legacy-repo', type: 'app' }],
    libs: [],
    services: [],
  };
  const INSTALL = { layout: 'standalone' as const, mergePackageJson: true, absorbExistingHarness: true };
  const project = () => fs.readFile(resolve(root, 'sdd/dual-harness/project.md'), 'utf-8');

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), 'harness-projectmd-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('los tres archivos del kit quedan idénticos al kit y las copias de la raíz también', async () => {
    await fs.writeFile(resolve(root, 'AGENTS.md'), '# Reglas\n\nregla uno\n', 'utf-8');
    await generateSDD(root, OPTS, INSTALL);
    for (const file of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) {
      const kit = await fs.readFile(resolve(KIT_DUAL, file), 'utf-8');
      expect(await fs.readFile(resolve(root, 'sdd/dual-harness', file), 'utf-8')).toBe(kit);
      expect(await fs.readFile(resolve(root, file), 'utf-8')).toBe(kit);
    }
    expect(await project()).toContain('regla uno');
  });

  it('abre con título y la línea de propiedad', async () => {
    await fs.writeFile(resolve(root, 'AGENTS.md'), 'regla uno\n', 'utf-8');
    await generateSDD(root, OPTS, INSTALL);
    const text = await project();
    expect(text.startsWith('# Instrucciones propias del proyecto\n')).toBe(true);
    expect(text).toContain('harness update sdd');
  });

  it('contribuciones idénticas aparecen una vez, sin subtítulo', async () => {
    for (const file of ['AGENTS.md', 'CLAUDE.md']) {
      await fs.writeFile(resolve(root, file), '# Mismo texto\n\nregla compartida\n', 'utf-8');
    }
    await generateSDD(root, OPTS, INSTALL);
    const text = await project();
    expect(text.split('regla compartida').length - 1).toBe(1);
    expect(text).not.toContain('## De ');
  });

  it('contribuciones distintas van bajo ## De <archivo>', async () => {
    await fs.writeFile(resolve(root, 'AGENTS.md'), 'regla de agents\n', 'utf-8');
    await fs.writeFile(resolve(root, 'CLAUDE.md'), 'regla de claude\n', 'utf-8');
    await generateSDD(root, OPTS, INSTALL);
    const text = await project();
    expect(text).toContain('## De AGENTS.md\n\nregla de agents');
    expect(text).toContain('## De CLAUDE.md\n\nregla de claude');
  });

  it('no crea project.md si no hay nada que absorber', async () => {
    await generateSDD(root, OPTS, INSTALL);
    expect(await fs.pathExists(resolve(root, 'sdd/dual-harness/project.md'))).toBe(false);
  });

  it('un project.md del dev sobrevive al reset y solo se le agrega lo nuevo', async () => {
    await generateSDD(root, OPTS, INSTALL);
    await fs.writeFile(resolve(root, 'sdd/dual-harness/project.md'), '# mío\n\nregla del dev\n', 'utf-8');
    await fs.writeFile(resolve(root, 'GEMINI.md'), 'regla nueva\n', 'utf-8');
    await generateSDD(root, OPTS, INSTALL);
    const text = await project();
    expect(text.startsWith('# mío\n\nregla del dev')).toBe(true);
    expect(text).toContain('regla nueva');
    await generateSDD(root, OPTS, INSTALL);
    expect(await project()).toBe(text);
  });

  it('re-correr configure es idempotente aunque la raíz quede como copia real', async () => {
    await fs.writeFile(resolve(root, 'CLAUDE.md'), 'regla única\n', 'utf-8');
    await generateSDD(root, OPTS, INSTALL);
    const first = await project();
    await generateSDD(root, OPTS, INSTALL);
    await generateSDD(root, OPTS, INSTALL);
    expect(await project()).toBe(first);
  });

  it('el texto absorbido por una versión anterior del kit (encabezado en sdd/dual-harness) se rescata a project.md', async () => {
    await generateSDD(root, OPTS, INSTALL);
    const legacy = `${await fs.readFile(resolve(KIT_DUAL, 'CLAUDE.md'), 'utf-8')}\n\n---\n\n${ABSORBED_HEADING}\n\ntexto de una instalación vieja\n`;
    await fs.writeFile(resolve(root, 'sdd/dual-harness/CLAUDE.md'), legacy, 'utf-8');
    await fs.remove(resolve(root, 'CLAUDE.md'));
    await fs.symlink('sdd/dual-harness/CLAUDE.md', resolve(root, 'CLAUDE.md'));

    await generateSDD(root, OPTS, INSTALL);

    expect(await project()).toContain('texto de una instalación vieja');
    const claude = await fs.readFile(resolve(root, 'sdd/dual-harness/CLAUDE.md'), 'utf-8');
    expect(claude).toBe(await fs.readFile(resolve(KIT_DUAL, 'CLAUDE.md'), 'utf-8'));
  });
});
