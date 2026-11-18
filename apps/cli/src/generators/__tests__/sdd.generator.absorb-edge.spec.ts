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

import { generateSDD, teamContribution, toPackageName } from '../sdd.generator.js';
import { novelContributions } from '../project-md.js';

const ABSORBED =
  '## Instrucciones previas del proyecto (absorbidas al instalar SDD)';
const SIG = '## ⛔ SPEC GATE — REGLA GLOBAL INVIOLABLE';

// Casos límite de la review de #45.
describe('teamContribution — casos límite', () => {
  const oldKit = `# Proyecto SDD\n\ncuerpo viejo\n\n${SIG}\n\nreglas viejas\n`;

  it('no re-agrega la cola ya rescatada del dual-harness anterior', () => {
    const rescued = 'texto del equipo';
    const root = `# Kit nuevo\n\n${ABSORBED}\n\n${rescued}\n`;
    expect(teamContribution(root, '# Kit viejo\n', rescued)).toBeNull();
    expect(
      teamContribution(root.replace(/\n/g, '\r\n'), '# Kit viejo\n', rescued),
    ).toBeNull();
  });

  it('conserva sólo lo nuevo si la raíz agregó algo a lo ya rescatado', () => {
    const root = `# Kit nuevo\n\n${ABSORBED}\n\nA\n\nB nuevo\n`;
    expect(teamContribution(root, '# Kit viejo\n', 'A')).toBe('B nuevo');
  });

  it('sin sección absorbida previa, se conserva la cola de la raíz', () => {
    const root = `# Kit\n\n${ABSORBED}\n\nA\n`;
    expect(teamContribution(root, '# Otro\n', null)).toBe('A');
  });

  it('una copia de una versión anterior del kit (sin encabezado) no se absorbe', () => {
    expect(
      teamContribution(oldKit, '# Proyecto SDD\n\ncuerpo nuevo\n'),
    ).toBeNull();
  });

  it('una copia vieja del kit con texto absorbido aporta sólo ese texto', () => {
    expect(
      teamContribution(`${oldKit}\n---\n\n${ABSORBED}\n\nmio\n`, '# Nuevo\n'),
    ).toBe('mio');
  });

  it('sin sdd/ (kitContent null) una copia del kit tampoco entra entera', () => {
    expect(teamContribution(oldKit, null)).toBeNull();
    expect(teamContribution(`${oldKit}\n${ABSORBED}\n\nmio\n`, null)).toBe(
      'mio',
    );
  });

  it('reconoce el symlink degradado con ./ delante', () => {
    expect(teamContribution('./sdd/dual-harness/AGENTS.md', null)).toBeNull();
    expect(
      teamContribution('.\\sdd\\dual-harness\\AGENTS.md', null),
    ).toBeNull();
  });
});

describe('generateSDD — re-ejecuciones no duplican el texto del equipo', () => {
  let root: string;
  const OPTS = {
    projectName: 'legacy-repo',
    description: 'Repo existente.',
    packageScope: '@legacy-repo',
    apps: [{ name: 'legacy-repo', type: 'app' }],
    libs: [],
    services: [],
  };
  const INSTALL = {
    layout: 'standalone' as const,
    mergePackageJson: true,
    absorbExistingHarness: true,
  };

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), 'harness-absorb2-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('con la raíz como copia real (link fallido) el texto del equipo queda una vez, corrida tras corrida', async () => {
    await fs.writeFile(
      resolve(root, 'AGENTS.md'),
      '# Reglas\n\nunico-marcador-equipo\n',
      'utf-8',
    );
    for (let i = 0; i < 3; i++) await generateSDD(root, OPTS, INSTALL);
    const dual = await fs.readFile(
      resolve(root, 'sdd/dual-harness/AGENTS.md'),
      'utf-8',
    );
    expect(dual).not.toContain('unico-marcador-equipo');
    expect(dual).not.toContain(ABSORBED);
    const project = await fs.readFile(
      resolve(root, 'sdd/dual-harness/project.md'),
      'utf-8',
    );
    expect(project.split('unico-marcador-equipo').length - 1).toBe(1);
    expect(project.split('# Instrucciones propias del proyecto').length - 1).toBe(1);
  });
});

describe('teamContribution — copias del núcleo nuevo', () => {
  const oldKit = `# Proyecto SDD\n\ncuerpo viejo\n\n${SIG}\n\nreglas viejas\n`;
  const newCore = fs.readFileSync(
    resolve(__dirname, '../../../templates/sdd/dual-harness/CLAUDE.md'),
    'utf-8',
  );

  it('copia de un kit viejo distinto del instalado: no aporta nada', () => {
    expect(teamContribution(oldKit, newCore)).toBeNull();
  });

  it('copia idéntica del núcleo nuevo con otro núcleo instalado: no aporta nada', () => {
    expect(teamContribution(newCore, oldKit)).toBeNull();
    expect(teamContribution(newCore, null)).toBeNull();
  });

  it('copia del núcleo nuevo con una línea cambiada: no aporta el núcleo', () => {
    const touched = newCore.replace('REGLA UNO', 'REGLA UNA');
    expect(touched).not.toBe(newCore);
    expect(teamContribution(touched, oldKit)).toBeNull();
  });

  it('copia del núcleo nuevo con un párrafo del dev al final: se absorbe sólo el párrafo, sin los imports', () => {
    const own = teamContribution(`${newCore.trimEnd()}\n\nNunca hagas deploy los viernes.\n`, oldKit);
    expect(own).toBe('Nunca hagas deploy los viernes.');
    const sameInstalled = teamContribution(`${newCore.trimEnd()}\n\nNunca hagas deploy los viernes.\n`, newCore);
    expect(sameInstalled).toBe('Nunca hagas deploy los viernes.');
    expect(own).not.toContain('@');
  });

  it('la copia vieja del kit con cola del dev sigue aportando sólo la cola', () => {
    expect(teamContribution(`${oldKit}\n---\n\n${ABSORBED}\n\nmio\n`, newCore)).toBe('mio');
  });
});

describe('novelContributions — presencia por bloques', () => {
  it('un fragmento de otra frase no es presente; el bloque entero sí', () => {
    const existing = '# p\n\n- Nunca hagas deploy los viernes sin aprobación.\n\nNo usar pnpm.\n';
    const contributions = new Map([
      ['a', 'Nunca hagas deploy los viernes'],
      ['b', 'pnpm'],
      ['c', 'No usar pnpm.'],
    ]);
    expect(novelContributions(existing, contributions).map(([f]) => f)).toEqual(['a', 'b']);
  });
});

describe('toPackageName', () => {
  it('turns a directory-style name into a valid npm package name', () => {
    expect(toPackageName('Mi_Proyecto')).toBe('mi_proyecto');
    expect(toPackageName('My Repo!!')).toBe('my-repo');
    expect(toPackageName('###')).toBe('project');
  });
});
