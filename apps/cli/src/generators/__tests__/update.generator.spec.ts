import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateSDD } from '../sdd.generator.js';
import { updateSDD } from '../update.generator.js';

vi.mock('../../utils/exec.js', () => ({
  exec: vi.fn(() => ''),
  execSilent: vi.fn(() => ''),
}));

const sha256 = (content: string) =>
  createHash('sha256').update(content).digest('hex');

describe('update.generator', () => {
  let ws: string;

  beforeEach(async () => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-update-'));
    await generateSDD(ws, {
      projectName: 'update-target',
      description: 'Repo to exercise harness update sdd.',
      packageScope: '@update-target',
      apps: [{ name: 'portal', type: 'react' }],
      libs: [],
      services: [],
    });
    await fs.writeJSON(resolve(ws, 'package.json'), {
      name: 'update-target',
      version: '1.0.0',
      private: true,
    });
  });

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true });
  });

  it('instala el manifest con hashes al generar', async () => {
    const manifest = await fs.readJSON(resolve(ws, 'sdd/kit.json'));
    expect(manifest.kit_version).toBeDefined();
    expect(manifest.files['agents/sdd-orchestrator.agent.md']).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.files['global.json']).toBeUndefined();
    expect(manifest.files['specs/index.json']).toBeUndefined();
    expect(manifest.files['catalog.json']).toBeUndefined();
  });

  it('kit al día: no cambia nada y no genera conflictos', async () => {
    const report = await updateSDD(ws);
    expect(report.legacyMode).toBe(false);
    expect(report.updated).toEqual([]);
    expect(report.conflicts).toEqual([]);
    expect(report.added).toEqual([]);
  });

  it('preserva archivos customizados y skills propias; nunca toca los datos', async () => {
    const agentPath = resolve(ws, 'sdd/agents/sdd-planner.agent.md');
    await fs.appendFile(agentPath, '\n## Regla local del equipo\n');
    const customized = await fs.readFile(agentPath, 'utf-8');

    await fs.ensureDir(resolve(ws, 'sdd/skills/mi-skill-propia'));
    await fs.writeFile(
      resolve(ws, 'sdd/skills/mi-skill-propia/skill.md'),
      '---\nname: mi-skill-propia\n---\n',
    );

    const globalBefore = await fs.readFile(resolve(ws, 'sdd/global.json'), 'utf-8');

    const report = await updateSDD(ws);

    expect(report.keptCustom).toContain('agents/sdd-planner.agent.md');
    expect(await fs.readFile(agentPath, 'utf-8')).toBe(customized);
    expect(
      await fs.pathExists(resolve(ws, 'sdd/skills/mi-skill-propia/skill.md')),
    ).toBe(true);
    expect(await fs.readFile(resolve(ws, 'sdd/global.json'), 'utf-8')).toBe(
      globalBefore,
    );
  });

  it('actualiza archivos no tocados cuando el kit cambió, y marca conflicto cuando cambiaron ambos', async () => {
    const manifestPath = resolve(ws, 'sdd/kit.json');
    const manifest = await fs.readJSON(manifestPath);

    // Simular kit viejo: el archivo instalado y su baseline difieren del kit nuevo
    const updatablePath = resolve(ws, 'sdd/HOW-TO-USE-SDD.md');
    await fs.writeFile(updatablePath, 'contenido de la version vieja\n');
    manifest.files['HOW-TO-USE-SDD.md'] = sha256('contenido de la version vieja\n');

    // Conflicto: el usuario editó Y el kit nuevo también difiere del baseline
    const conflictPath = resolve(ws, 'sdd/README.md');
    await fs.writeFile(conflictPath, 'edicion local del usuario\n');
    manifest.files['README.md'] = sha256('otro contenido baseline viejo\n');

    await fs.writeJSON(manifestPath, manifest, { spaces: 2 });

    const report = await updateSDD(ws);

    expect(report.updated).toContain('HOW-TO-USE-SDD.md');
    expect(await fs.readFile(updatablePath, 'utf-8')).not.toContain('version vieja');

    expect(report.conflicts).toContain('README.md');
    expect(await fs.readFile(conflictPath, 'utf-8')).toBe('edicion local del usuario\n');
    expect(await fs.pathExists(`${conflictPath}.new`)).toBe(true);
  });

  it('modo legacy (sin manifest): reemplaza kit puro, jamás pisa los híbridos', async () => {
    await fs.remove(resolve(ws, 'sdd/kit.json'));

    const dualPath = resolve(ws, 'sdd/dual-harness/AGENTS.md');
    await fs.writeFile(dualPath, '# Arnés con instrucciones absorbidas\n');

    const agentPath = resolve(ws, 'sdd/agents/sdd-reviewer.agent.md');
    await fs.writeFile(agentPath, 'version vieja del agente\n');

    const report = await updateSDD(ws);

    expect(report.legacyMode).toBe(true);
    expect(await fs.readFile(dualPath, 'utf-8')).toBe(
      '# Arnés con instrucciones absorbidas\n',
    );
    expect(report.conflicts).toContain('dual-harness/AGENTS.md');
    expect(await fs.pathExists(`${dualPath}.new`)).toBe(true);

    expect(report.updated).toContain('agents/sdd-reviewer.agent.md');
    expect(await fs.readFile(agentPath, 'utf-8')).not.toBe('version vieja del agente\n');

    expect(await fs.pathExists(resolve(ws, 'sdd/kit.json'))).toBe(true);
  });

  it('falla claro si no hay instalación SDD', async () => {
    const empty = mkdtempSync(resolve(tmpdir(), 'harness-noupdate-'));
    await expect(updateSDD(empty)).rejects.toThrow('No SDD installation');
    rmSync(empty, { recursive: true, force: true });
  });
});
