import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import {
  generateIdeaFiles,
  IDEA_FILENAME,
  CONFIG_STUB_FILENAME,
  readIdeaSummary,
} from '../idea.generator.js';
import { CONFIG_SCHEMA_FILENAME } from '../../config/json-schema.js';
import { HarnessConfigSchema } from '../../config/schema.js';

describe('idea.generator', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(resolve(tmpdir(), 'harness-idea-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('greenfield: crea idea, stub de config y JSON schema', async () => {
    const report = await generateIdeaFiles(tmpDir, 'una app de turnos');

    expect(report.mode).toBe('greenfield');
    expect(report.created.sort()).toEqual(
      [IDEA_FILENAME, CONFIG_STUB_FILENAME, CONFIG_SCHEMA_FILENAME].sort(),
    );

    const idea = fs.readFileSync(resolve(tmpDir, IDEA_FILENAME), 'utf-8');
    expect(idea).toContain('una app de turnos');
    expect(idea).toContain('init --config');
    expect(idea).toContain('sdd-hermes');
  });

  it('greenfield: el stub valida contra el schema zod salvo el TODO de descripción', async () => {
    await generateIdeaFiles(tmpDir, 'idea');

    const stub = fs.readJSONSync(resolve(tmpDir, CONFIG_STUB_FILENAME));
    expect(HarnessConfigSchema.safeParse(stub).success).toBe(true);
    expect(stub.$schema).toBe(`./${CONFIG_SCHEMA_FILENAME}`);
  });

  it('workspace SDD: solo crea el archivo de idea con el protocolo de gaps', async () => {
    fs.ensureDirSync(resolve(tmpDir, 'sdd'));
    fs.writeJSONSync(resolve(tmpDir, 'sdd/global.json'), { project: 'x' });

    const report = await generateIdeaFiles(tmpDir, 'sumar reportes');

    expect(report.mode).toBe('sdd-workspace');
    expect(report.created).toEqual([IDEA_FILENAME]);
    const idea = fs.readFileSync(resolve(tmpDir, IDEA_FILENAME), 'utf-8');
    expect(idea).toContain('harness add app|service');
    expect(idea).not.toContain('init --config');
  });

  it('no pisa archivos existentes sin force', async () => {
    fs.writeFileSync(resolve(tmpDir, IDEA_FILENAME), 'previa', 'utf-8');

    const report = await generateIdeaFiles(tmpDir, 'nueva idea');

    expect(report.skipped).toContain(IDEA_FILENAME);
    expect(fs.readFileSync(resolve(tmpDir, IDEA_FILENAME), 'utf-8')).toBe(
      'previa',
    );

    const forced = await generateIdeaFiles(tmpDir, 'nueva idea', {
      force: true,
    });
    expect(forced.created).toContain(IDEA_FILENAME);
    expect(
      fs.readFileSync(resolve(tmpDir, IDEA_FILENAME), 'utf-8'),
    ).toContain('nueva idea');
  });

  it('rechaza idea vacía', async () => {
    await expect(generateIdeaFiles(tmpDir, '   ')).rejects.toThrow(
      'cannot be empty',
    );
  });
});

// v0.11.0 — harness.idea.md es la bitácora de FASE 1 (evidencia + decisiones), el protocolo
// alcanza sin la skill sdd-hermes, y --author baja a sdd.author del stub.
describe('idea.generator v0.11.0', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(resolve(tmpdir(), 'harness-idea11-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('el idea file trae evidencia, decisiones y un protocolo autosuficiente', async () => {
    await generateIdeaFiles(tmpDir, 'catálogo de plataforma', { author: 'eburgos' });
    const idea = fs.readFileSync(resolve(tmpDir, IDEA_FILENAME), 'utf-8');
    expect(idea).toContain('## Evidencia del descubrimiento');
    expect(idea).toContain('| Fuente | Estado de acceso | Dato medido | Fecha |');
    expect(idea).toContain('## Decisiones del dev');
    expect(idea).toContain('Autor: `eburgos`');
    // matriz necesidad → pieza, regla standalone vs nx y el init en el cwd, sin depender de la skill
    expect(idea).toContain('| Persistencia relacional');
    expect(idea).toContain('"mode": "standalone"');
    expect(idea).toContain('init --config ./harness.config.json -y');
    expect(idea).toContain('--here');
    expect(idea).toContain('NX_WORKSPACE_ROOT_PATH');
  });

  it('--author baja a sdd.author del stub y el stub sigue validando', async () => {
    await generateIdeaFiles(tmpDir, 'idea', { author: 'eburgos' });
    const stub = fs.readJSONSync(resolve(tmpDir, CONFIG_STUB_FILENAME));
    expect(stub.sdd).toEqual({ author: 'eburgos', modules: [] });
    expect(stub.apps[0].port).toBe(3000);
    expect(HarnessConfigSchema.safeParse(stub).success).toBe(true);

    await expect(
      generateIdeaFiles(tmpDir, 'idea', { author: 'Not Valid', force: true }),
    ).rejects.toThrow(/--author/);
  });

  it('readIdeaSummary devuelve idea, filas de evidencia y decisiones reales (ignora los ejemplos)', async () => {
    await generateIdeaFiles(tmpDir, 'una app de turnos');
    const path = resolve(tmpDir, IDEA_FILENAME);
    let content = fs.readFileSync(path, 'utf-8');
    content = content.replace(
      '| ------ | ---------------- | ----------- | ----- |\n',
      '| ------ | ---------------- | ----------- | ----- |\n| repo interno | accesible | 42 endpoints | 2026-09-02 |\n| API legacy | bloqueado (sin VPN) | — | 2026-09-02 |\n',
    );
    content = content.replace(
      '## Decisiones del dev',
      '## Decisiones del dev\n\n- [2026-09-02] Sin auth propia: SSO corporativo.',
    );
    fs.writeFileSync(path, content, 'utf-8');

    const summary = await readIdeaSummary(tmpDir);
    expect(summary.idea).toBe('una app de turnos');
    expect(summary.registeredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(summary.evidence).toEqual([
      '| repo interno | accesible | 42 endpoints | 2026-09-02 |',
      '| API legacy | bloqueado (sin VPN) | — | 2026-09-02 |',
    ]);
    expect(summary.decisions).toEqual(['- [2026-09-02] Sin auth propia: SSO corporativo.']);

    await expect(readIdeaSummary(resolve(tmpDir, 'nowhere'))).rejects.toThrow(/not found/);
  });
});
