import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import {
  generateIdeaFiles,
  IDEA_FILENAME,
  CONFIG_STUB_FILENAME,
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
