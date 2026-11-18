import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import fs from 'fs-extra';

vi.mock('../../utils/exec.js', () => ({
  exec: vi.fn(() => ''),
  execSilent: vi.fn(() => ''),
}));

import { generateSDD } from '../sdd.generator.js';
import { updateSDD } from '../update.generator.js';
import { hashContent, harnessIsHybrid, HARNESS_CORE_SINCE } from '../kit-manifest.js';
import { ABSORBED_HEADING } from '../project-md.js';

const KIT_DIR = resolve(__dirname, '../../../templates/sdd');
const gitShow = (ref: string, path: string): string | null => {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], {
      cwd: resolve(__dirname, '../../../../..'),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
};
const OLD_CLAUDE = gitShow('v0.20.0', 'apps/cli/templates/sdd/dual-harness/CLAUDE.md');

const SEPARATOR = '\n\n---\n\n';
const absorb = (head: string, text: string) => `${head}${SEPARATOR}${ABSORBED_HEADING}\n\n${text}\n`;

describe('update sdd — núcleo del arnés, project.md y --split-project', () => {
  let ws: string;
  const dual = (name: string) => resolve(ws, 'sdd/dual-harness', name);
  const kitFile = (name: string) => fs.readFileSync(resolve(KIT_DIR, 'dual-harness', name), 'utf-8');
  const projectMd = () => fs.readFile(dual('project.md'), 'utf-8');

  const setManifest = async (version: string | null, hashes: Record<string, string> = {}) => {
    const path = resolve(ws, 'sdd/kit.json');
    if (version === null) {
      await fs.remove(path);
      return;
    }
    const manifest = await fs.readJSON(path);
    manifest.kit_version = version;
    for (const [rel, text] of Object.entries(hashes)) {
      manifest.files[rel] = hashContent(Buffer.from(text, 'utf-8'));
    }
    await fs.writeJSON(path, manifest, { spaces: 2 });
  };

  beforeEach(async () => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-split-'));
    await generateSDD(ws, {
      projectName: 'split-target',
      description: 'Repo to exercise project.md.',
      packageScope: '@split-target',
      apps: [{ name: 'portal', type: 'react' }],
      libs: [],
      services: [],
    });
    await fs.writeJSON(resolve(ws, 'package.json'), { name: 'split-target', version: '1.0.0', private: true });
  });

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true });
  });

  describe('regla híbrida por versión del manifiesto', () => {
    it('el umbral es 0.23.0 y sin manifiesto el arnés es híbrido', () => {
      expect(HARNESS_CORE_SINCE).toBe('0.23.0');
      expect(harnessIsHybrid(null)).toBe(true);
      expect(harnessIsHybrid('0.22.9')).toBe(true);
      expect(harnessIsHybrid('0.23.0')).toBe(false);
      expect(harnessIsHybrid('1.0.0')).toBe(false);
    });

    it('manifiesto < 0.23.0: un archivo distinto del kit recibe .new y no se pisa', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': '# viejo\n' });
      await fs.writeFile(dual('CLAUDE.md'), '# viejo\n');
      const report = await updateSDD(ws);
      expect(report.conflicts).toContain('dual-harness/CLAUDE.md');
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toBe('# viejo\n');
      expect(await fs.pathExists(`${dual('CLAUDE.md')}.new`)).toBe(true);
      expect(report.harnessCoreNotice).toBe(true);
    });

    it('manifiesto >= 0.23.0: un archivo sin modificar se reemplaza y uno modificado recibe .new', async () => {
      await setManifest('0.23.0', {
        'dual-harness/CLAUDE.md': '# núcleo viejo\n',
        'dual-harness/AGENTS.md': '# núcleo viejo\n',
      });
      await fs.writeFile(dual('CLAUDE.md'), '# núcleo viejo\n');
      await fs.writeFile(dual('AGENTS.md'), '# editado a mano\n');

      const report = await updateSDD(ws);

      expect(report.updated).toContain('dual-harness/CLAUDE.md');
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toBe(kitFile('CLAUDE.md'));
      expect(report.conflicts).toContain('dual-harness/AGENTS.md');
      expect(await fs.readFile(dual('AGENTS.md'), 'utf-8')).toBe('# editado a mano\n');
      expect(await fs.pathExists(`${dual('AGENTS.md')}.new`)).toBe(true);
      expect(report.harnessCoreNotice).toBe(false);
    });

    it('constitution, context_prompt y pricing siguen híbridos con cualquier versión', async () => {
      await setManifest('0.23.0');
      const constitution = resolve(ws, 'sdd/context/constitution.md');
      await fs.writeFile(constitution, '# propia\n');
      const report = await updateSDD(ws);
      expect(report.updated).not.toContain('context/constitution.md');
      expect(await fs.readFile(constitution, 'utf-8')).toBe('# propia\n');
    });
  });

  describe('propiedad de project.md y verify.json', () => {
    it('update no toca project.md y siembra verify.json una sola vez', async () => {
      await fs.writeFile(dual('project.md'), '# mío\n\nreglas del repo\n');
      await fs.remove(resolve(ws, 'sdd/verify.json'));

      const first = await updateSDD(ws);
      expect(first.added).toContain('verify.json');
      expect(await fs.pathExists(resolve(ws, 'sdd/verify.json'))).toBe(true);
      expect(await projectMd()).toBe('# mío\n\nreglas del repo\n');
      expect(await fs.pathExists(`${dual('project.md')}.new`)).toBe(false);

      await fs.writeFile(resolve(ws, 'sdd/verify.json'), '{"$schema":"./schemas/verify.schema.json","_description":"mío"}\n');
      const second = await updateSDD(ws);
      expect(second.added).not.toContain('verify.json');
      expect(await fs.readFile(resolve(ws, 'sdd/verify.json'), 'utf-8')).toContain('"mío"');
    });

    it('project.md no entra al manifiesto', async () => {
      await fs.writeFile(dual('project.md'), '# mío\n');
      await updateSDD(ws);
      const manifest = await fs.readJSON(resolve(ws, 'sdd/kit.json'));
      expect(Object.keys(manifest.files)).not.toContain('dual-harness/project.md');
    });
  });

  describe('avisos', () => {
    it('sin --split-project avisa del texto absorbido y no lo mueve', async () => {
      await setManifest('0.22.0');
      const content = absorb('# viejo kit\n', 'regla propia');
      await fs.writeFile(dual('CLAUDE.md'), content);
      const report = await updateSDD(ws);
      expect(report.absorbedInHarness).toEqual(['dual-harness/CLAUDE.md']);
      expect(report.splitProject).toBeNull();
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toBe(content);
      expect(await fs.pathExists(dual('project.md'))).toBe(false);
    });

    it('la nota del núcleo aparece solo viniendo de < 0.23.0 o sin manifiesto', async () => {
      await setManifest('0.22.0');
      expect((await updateSDD(ws)).harnessCoreNotice).toBe(true);
      await setManifest('0.23.0');
      expect((await updateSDD(ws)).harnessCoreNotice).toBe(false);
      await setManifest(null);
      expect((await updateSDD(ws)).harnessCoreNotice).toBe(true);
    });
  });

  describe('--split-project', () => {
    it('(a)+(b) cabeza igual al baseline viejo: mueve el texto y reemplaza por el núcleo nuevo', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': '# kit viejo\n' });
      await fs.writeFile(dual('CLAUDE.md'), absorb('# kit viejo\n', 'regla propia del equipo'));

      const report = await updateSDD(ws, { splitProject: true });

      const entry = report.splitProject?.find((e) => e.file === 'dual-harness/CLAUDE.md');
      expect(entry?.outcome).toBe('moved');
      expect(entry?.movedBytes).toBeGreaterThan(0);
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toBe(kitFile('CLAUDE.md'));
      expect(await projectMd()).toContain('regla propia del equipo');
      expect(report.conflicts).not.toContain('dual-harness/CLAUDE.md');
    });

    it.skipIf(OLD_CLAUDE === null)('una cabeza igual a una versión publicada vieja se reemplaza aunque el baseline del manifiesto sea otro', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': 'un kit más nuevo\n' });
      const absorbedText = 'regla propia\n\nsegundo párrafo';
      await fs.writeFile(dual('CLAUDE.md'), absorb(OLD_CLAUDE as string, absorbedText));

      const report = await updateSDD(ws, { splitProject: true });

      expect(report.splitProject?.find((e) => e.file === 'dual-harness/CLAUDE.md')?.outcome).toBe('moved');
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toBe(kitFile('CLAUDE.md'));
      const project = await projectMd();
      expect(project.endsWith(`${absorbedText}\n`)).toBe(true);
      expect(project).not.toContain(ABSORBED_HEADING);
      expect(project).not.toContain('---');
    });

    it.skipIf(OLD_CLAUDE === null)('una cabeza publicada con un carácter cambiado se queda y recibe .new', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': 'un kit más nuevo\n' });
      const touched = (OLD_CLAUDE as string).replace('SDD', 'SDX');
      await fs.writeFile(dual('CLAUDE.md'), absorb(touched, 'texto'));

      const report = await updateSDD(ws, { splitProject: true });

      expect(report.splitProject?.find((e) => e.file === 'dual-harness/CLAUDE.md')?.outcome).toBe('kept-new');
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toContain('SDX');
      expect(await fs.pathExists(`${dual('CLAUDE.md')}.new`)).toBe(true);
      expect(await projectMd()).toContain('texto');
    });

    it('manifiesto 0.9.2 (baseline = archivo instalado): un archivo personalizado sin encabezado no se pisa', async () => {
      const custom = '# personalizado por el equipo\n';
      await setManifest('0.9.2', { 'dual-harness/CLAUDE.md': custom });
      await fs.writeFile(dual('CLAUDE.md'), custom);

      const report = await updateSDD(ws, { splitProject: true });

      expect(report.splitProject?.find((e) => e.file === 'dual-harness/CLAUDE.md')?.outcome).toBe('kept-new');
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toBe(custom);
      expect(await fs.pathExists(`${dual('CLAUDE.md')}.new`)).toBe(true);
    });

    it('el encabezado dos veces (doble absorción vieja): se mueve todo lo posterior al primero sin perder nada', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': '# kit viejo\n' });
      const doubled = `${absorb('# kit viejo\n', 'primera tanda')}${SEPARATOR}${ABSORBED_HEADING}\n\nsegunda tanda\n`;
      await fs.writeFile(dual('CLAUDE.md'), doubled);

      await updateSDD(ws, { splitProject: true });

      const project = await projectMd();
      expect(project).toContain('primera tanda');
      expect(project).toContain('segunda tanda');
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toBe(kitFile('CLAUDE.md'));
    });

    it('(b) cabeza igual al kit nuevo también se reemplaza', async () => {
      await setManifest(null);
      await fs.writeFile(dual('GEMINI.md'), absorb(kitFile('GEMINI.md'), 'texto g'));
      const report = await updateSDD(ws, { splitProject: true });
      expect(report.splitProject?.find((e) => e.file === 'dual-harness/GEMINI.md')?.outcome).toBe('moved');
      expect(await fs.readFile(dual('GEMINI.md'), 'utf-8')).toBe(kitFile('GEMINI.md'));
      expect(await projectMd()).toContain('texto g');
    });

    it('(c) cabeza modificada: se queda, el kit va al lado como .new y el texto ya está en project.md', async () => {
      await setManifest('0.22.0', { 'dual-harness/AGENTS.md': '# kit viejo\n' });
      await fs.writeFile(dual('AGENTS.md'), absorb('# kit viejo\n\nediciones en el kit', 'texto a'));

      const report = await updateSDD(ws, { splitProject: true });

      const entry = report.splitProject?.find((e) => e.file === 'dual-harness/AGENTS.md');
      expect(entry?.outcome).toBe('kept-new');
      const kept = await fs.readFile(dual('AGENTS.md'), 'utf-8');
      expect(kept).not.toContain(ABSORBED_HEADING);
      expect(kept).toContain('ediciones en el kit');
      expect(kept).not.toContain('texto a');
      expect(await projectMd()).toContain('texto a');
      expect(await fs.pathExists(`${dual('AGENTS.md')}.new`)).toBe(true);
    });

    it('instalación sin manifiesto: la cabeza no se puede probar intacta, queda .new y el texto se mueve igual', async () => {
      await setManifest(null);
      await fs.writeFile(dual('CLAUDE.md'), absorb('# kit viejo\n', 'texto legacy'));
      const report = await updateSDD(ws, { splitProject: true });
      expect(report.splitProject?.find((e) => e.file === 'dual-harness/CLAUDE.md')?.outcome).toBe('kept-new');
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toBe('# kit viejo\n');
      expect(await projectMd()).toContain('texto legacy');
      expect(await fs.pathExists(`${dual('CLAUDE.md')}.new`)).toBe(true);
    });

    it('archivo instalado con CRLF: la cabeza se compara con el baseline sin fines de línea', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': '# kit viejo\nlinea dos\n' });
      await fs.writeFile(dual('CLAUDE.md'), absorb('# kit viejo\nlinea dos\n', 'texto crlf').replace(/\n/g, '\r\n'));
      const report = await updateSDD(ws, { splitProject: true });
      expect(report.splitProject?.find((e) => e.file === 'dual-harness/CLAUDE.md')?.outcome).toBe('moved');
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toBe(kitFile('CLAUDE.md'));
      expect(await projectMd()).toContain('texto crlf');
    });

    it('sin encabezado: igual al baseline viejo se reemplaza; distinto recibe .new; igual al kit nuevo no hace nada', async () => {
      await setManifest('0.22.0', {
        'dual-harness/CLAUDE.md': '# kit viejo\n',
        'dual-harness/AGENTS.md': '# otro kit viejo\n',
      });
      await fs.writeFile(dual('CLAUDE.md'), '# kit viejo\n');
      await fs.writeFile(dual('AGENTS.md'), '# editado por el equipo\n');

      const report = await updateSDD(ws, { splitProject: true });
      const by = (f: string) => report.splitProject?.find((e) => e.file === `dual-harness/${f}`);
      expect(by('CLAUDE.md')?.outcome).toBe('replaced');
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toBe(kitFile('CLAUDE.md'));
      expect(by('AGENTS.md')?.outcome).toBe('kept-new');
      expect(await fs.readFile(dual('AGENTS.md'), 'utf-8')).toBe('# editado por el equipo\n');
      expect(by('GEMINI.md')?.outcome).toBe('nothing');
      expect(await fs.pathExists(dual('project.md'))).toBe(false);
    });

    it('contribuciones idénticas aparecen una vez y las distintas bajo ## De <archivo>', async () => {
      await setManifest('0.22.0', {
        'dual-harness/CLAUDE.md': '# kit viejo\n',
        'dual-harness/AGENTS.md': '# kit viejo\n',
        'dual-harness/GEMINI.md': '# kit viejo\n',
      });
      await fs.writeFile(dual('CLAUDE.md'), absorb('# kit viejo\n', 'comun a todos'));
      await fs.writeFile(dual('AGENTS.md'), absorb('# kit viejo\n', 'comun a todos'));
      await fs.writeFile(dual('GEMINI.md'), absorb('# kit viejo\n', 'solo gemini'));

      await updateSDD(ws, { splitProject: true });

      const project = await projectMd();
      expect(project.split('comun a todos').length - 1).toBe(1);
      expect(project).toContain('## De AGENTS.md, CLAUDE.md');
      expect(project).toContain('## De GEMINI.md');
      expect(project).toContain('solo gemini');
    });

    it('un project.md escrito por el dev se conserva y solo se agrega lo que no estaba', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': '# kit viejo\n' });
      await fs.writeFile(dual('project.md'), '# del dev\n\nregla ya presente\n');
      await fs.writeFile(dual('CLAUDE.md'), absorb('# kit viejo\n', 'regla ya presente'));
      await updateSDD(ws, { splitProject: true });
      expect(await projectMd()).toBe('# del dev\n\nregla ya presente\n');
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toBe(kitFile('CLAUDE.md'));
    });

    it('correrlo dos veces es un no-op la segunda', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': '# kit viejo\n' });
      await fs.writeFile(dual('CLAUDE.md'), absorb('# kit viejo\n', 'texto único'));
      await updateSDD(ws, { splitProject: true });
      const projectAfterFirst = await projectMd();
      const claudeAfterFirst = await fs.readFile(dual('CLAUDE.md'), 'utf-8');

      const second = await updateSDD(ws, { splitProject: true });

      expect(second.splitProject?.every((e) => e.outcome === 'nothing')).toBe(true);
      expect(await projectMd()).toBe(projectAfterFirst);
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toBe(claudeAfterFirst);
      expect(projectAfterFirst.split('texto único').length - 1).toBe(1);
    });

    it('sin la bandera nunca se divide aunque solo haya cambios en el kit', async () => {
      await setManifest('0.22.0');
      await fs.writeFile(dual('CLAUDE.md'), absorb('# kit viejo\n', 'se queda'));
      await updateSDD(ws);
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toContain('se queda');
    });
  });
  describe('auditoría — correcciones', () => {
    const splitEntry = (report: Awaited<ReturnType<typeof updateSDD>>) =>
      report.splitProject?.find((e) => e.file === 'dual-harness/CLAUDE.md');

    it('un fragmento de otra frase no cuenta como presente: la regla se mueve y no se pierde', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': '# kit viejo\n' });
      await fs.writeFile(
        dual('project.md'),
        '# mío\n\n- Nunca hagas deploy los viernes sin aprobación del líder técnico.\n\nNo usar pnpm.\n',
      );
      await fs.writeFile(dual('CLAUDE.md'), absorb('# kit viejo\n', 'Nunca hagas deploy los viernes'));
      await updateSDD(ws, { splitProject: true });
      const project = await projectMd();
      expect(project.split('Nunca hagas deploy los viernes').length - 1).toBe(2);
      expect(project.trimEnd().endsWith('Nunca hagas deploy los viernes')).toBe(true);
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).not.toContain('Nunca hagas deploy los viernes');
    });

    it('«pnpm» no queda cubierto por «No usar pnpm.»', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': '# kit viejo\n' });
      await fs.writeFile(dual('project.md'), '# mío\n\nNo usar pnpm.\n');
      await fs.writeFile(dual('CLAUDE.md'), absorb('# kit viejo\n', 'pnpm'));
      await updateSDD(ws, { splitProject: true });
      expect((await projectMd()).trimEnd().endsWith('\n\npnpm')).toBe(true);
    });

    it('un bloque ya presente entero no se repite y se informa como ya presente (0 bytes)', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': '# kit viejo\n' });
      await fs.writeFile(dual('project.md'), '# mío\n\nregla A\n\nregla B\n\nregla C\n');
      await fs.writeFile(dual('CLAUDE.md'), absorb('# kit viejo\n', 'regla A\n\nregla B'));
      const report = await updateSDD(ws, { splitProject: true });
      expect(await projectMd()).toBe('# mío\n\nregla A\n\nregla B\n\nregla C\n');
      expect(splitEntry(report)?.movedBytes).toBe(0);
      expect(splitEntry(report)?.hadAbsorbed).toBe(true);
      expect(splitEntry(report)?.outcome).toBe('moved');
    });

    it('bloques presentes pero no contiguos o en otro orden se agregan', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': '# kit viejo\n' });
      await fs.writeFile(dual('project.md'), '# mío\n\nregla A\n\nintermedio\n\nregla B\n');
      await fs.writeFile(dual('CLAUDE.md'), absorb('# kit viejo\n', 'regla A\n\nregla B'));
      await updateSDD(ws, { splitProject: true });
      expect((await projectMd()).split('regla A').length - 1).toBe(2);
    });

    it('cabeza vacía (el dev borró el cuerpo del kit): se instala el núcleo, no un archivo vacío', async () => {
      await setManifest('0.22.0');
      await fs.writeFile(dual('CLAUDE.md'), `${ABSORBED_HEADING}\n\nregla del dev\n`);
      const report = await updateSDD(ws, { splitProject: true });
      expect(splitEntry(report)?.outcome).toBe('moved');
      expect(await fs.readFile(dual('CLAUDE.md'), 'utf-8')).toBe(kitFile('CLAUDE.md'));
      expect(await projectMd()).toContain('regla del dev');
    });

    it.skipIf(process.platform === 'win32')('un hardlink a sdd/dual-harness/CLAUDE.md sobrevive al reemplazo y ve el contenido nuevo', async () => {
      await setManifest('0.23.0', { 'dual-harness/CLAUDE.md': '# núcleo viejo\n' });
      await fs.writeFile(dual('CLAUDE.md'), '# núcleo viejo\n');
      const linked = resolve(ws, 'CLAUDE.md');
      await fs.remove(linked);
      await fs.link(dual('CLAUDE.md'), linked);

      await updateSDD(ws);

      expect(fs.statSync(linked).ino).toBe(fs.statSync(dual('CLAUDE.md')).ino);
      expect(await fs.readFile(linked, 'utf-8')).toBe(kitFile('CLAUDE.md'));
      expect(await fs.pathExists(`${linked}.new`)).toBe(false);
    });

    it.skipIf(process.platform === 'win32')('--split-project también reemplaza en el lugar', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': '# kit viejo\n' });
      await fs.writeFile(dual('CLAUDE.md'), absorb('# kit viejo\n', 'regla'));
      const linked = resolve(ws, 'CLAUDE.md');
      await fs.remove(linked);
      await fs.link(dual('CLAUDE.md'), linked);
      await updateSDD(ws, { splitProject: true });
      expect(fs.statSync(linked).ino).toBe(fs.statSync(dual('CLAUDE.md')).ino);
      expect(await fs.readFile(linked, 'utf-8')).toBe(kitFile('CLAUDE.md'));
    });

    it('un .new viejo idéntico al kit se borra cuando el archivo ya es el kit; uno distinto se conserva', async () => {
      await setManifest('0.23.0');
      await fs.writeFile(dual('CLAUDE.md'), kitFile('CLAUDE.md'));
      await fs.writeFile(`${dual('CLAUDE.md')}.new`, kitFile('CLAUDE.md'));
      await fs.writeFile(dual('AGENTS.md'), kitFile('AGENTS.md'));
      await fs.writeFile(`${dual('AGENTS.md')}.new`, '# otra cosa\n');
      await updateSDD(ws);
      expect(await fs.pathExists(`${dual('CLAUDE.md')}.new`)).toBe(false);
      expect(await fs.pathExists(`${dual('AGENTS.md')}.new`)).toBe(true);
    });

    it('--split-project deja sin .new viejo al archivo que quedó igual al kit', async () => {
      await setManifest('0.22.0', { 'dual-harness/CLAUDE.md': '# kit viejo\n' });
      await fs.writeFile(dual('CLAUDE.md'), absorb('# kit viejo\n', 'regla'));
      await fs.writeFile(`${dual('CLAUDE.md')}.new`, kitFile('CLAUDE.md'));
      await updateSDD(ws, { splitProject: true });
      expect(await fs.pathExists(`${dual('CLAUDE.md')}.new`)).toBe(false);
    });

    it('un kit_version numérico en kit.json no rompe el update y se trata como instalación legacy', async () => {
      const path = resolve(ws, 'sdd/kit.json');
      const manifest = await fs.readJSON(path);
      manifest.kit_version = 0.23;
      await fs.writeJSON(path, manifest);
      const report = await updateSDD(ws);
      expect(report.legacyMode).toBe(true);
      expect(report.harnessCoreNotice).toBe(true);
    });
  });
});