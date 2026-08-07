import { resolve } from 'node:path';
import fs from 'fs-extra';
import { getTemplatesDir } from '../utils/fs.js';
import { exec } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import { writeManifest } from './kit-manifest.js';
import type { WorkspaceOptions } from './workspace.generator.js';

/**
 * Cómo se instala el kit según la forma del repo destino:
 * - layout 'nx':         monorepo Nx (apps/, libs/, tools/) — el modo clásico.
 * - layout 'standalone': una sola app con el código en la raíz del repo. Se
 *   registra como app lógica única `apps/<nombre>` en los registros SDD (los
 *   schemas exigen ese patrón y el validador nunca chequea que exista en
 *   disco), con su contexto en sdd/context/apps/<nombre>/.
 */
export interface SDDInstallConfig {
  layout?: 'nx' | 'standalone';
  /** Inyecta scripts sdd:* + setup:agents y ajv/ajv-formats en el package.json (lo crea si falta). */
  mergePackageJson?: boolean;
  /** Absorbe AGENTS.md/CLAUDE.md preexistentes dentro de sdd/dual-harness antes de symlink-ear. */
  absorbExistingHarness?: boolean;
}

/**
 * Instala el sistema SDD portable.
 *
 * El kit de templates/sdd/ se copia verbatim: sdd/global.json es el único
 * archivo que lleva nombre y descripción del proyecto (validate-sdd.mjs falla
 * si se filtran a cualquier otro archivo del kit), así que no hace falta
 * renderizar templates.
 */
export async function generateSDD(
  root: string,
  opts: WorkspaceOptions,
  install: SDDInstallConfig = {},
): Promise<void> {
  const layout = install.layout ?? 'nx';
  const kitDir = resolve(getTemplatesDir(), 'sdd');
  const destDir = resolve(root, 'sdd');

  const previousHarness = install.absorbExistingHarness
    ? await readExistingHarnessFiles(root)
    : new Map<string, string>();

  if (await fs.pathExists(destDir)) {
    await fs.remove(destDir);
  }
  await fs.copy(kitDir, destDir);
  // Baseline para `harness update sdd`: hash de cada archivo kit-owned tal
  // como se instaló — permite distinguir "modificado por el usuario" de
  // "cambiado por el kit" en futuros updates.
  await writeManifest(destDir);

  await writeGlobalJson(root, opts, layout);

  for (const app of opts.apps) {
    await createSubprojectContext(root, 'apps', app.name, app.type, layout);
  }
  for (const lib of opts.libs) {
    await createSubprojectContext(root, 'libs', lib.name, lib.type, layout);
  }

  if (layout === 'nx') {
    // sdd/templates trae blueprints con project.json; sin esto Nx los registra
    // como proyectos reales y CI explota por executors inexistentes.
    await fs.writeFile(resolve(root, '.nxignore'), 'sdd/templates\n', 'utf-8');
  }

  if (install.mergePackageJson) {
    await ensureHarnessPackageJson(root, opts.projectName);
  }

  for (const [file, content] of previousHarness) {
    await absorbIntoDualHarness(root, file, content);
  }

  runSetupAgents(root);
}

/**
 * Registra una app o lib en sdd/global.json (sección monorepo) y crea su
 * contexto de subproyecto. Usado por `harness add app` en workspaces existentes.
 */
export async function registerSubprojectInSDD(
  root: string,
  category: 'apps' | 'libs',
  name: string,
  type: string,
): Promise<void> {
  const globalPath = resolve(root, 'sdd/global.json');
  if (await fs.pathExists(globalPath)) {
    const globalJson = await fs.readJSON(globalPath);
    if (category === 'apps') {
      globalJson.monorepo.apps[name] = `apps/${name} — ${type}`;
      await fs.writeJSON(globalPath, globalJson, { spaces: 2 });
    }
  }
  await createSubprojectContext(root, category, name, type, 'nx');
}

/**
 * Garantiza que el package.json raíz tenga los scripts del arnés SDD
 * (tomados del propio kit, para no duplicar valores) y las devDependencies
 * que el validador necesita. Crea un package.json mínimo si el repo no tiene
 * (repos Java/Python puros).
 */
export async function ensureHarnessPackageJson(
  root: string,
  projectName: string,
): Promise<void> {
  const pkgPath = resolve(root, 'package.json');
  const kitPkg = await fs.readJSON(
    resolve(getTemplatesDir(), 'sdd/templates/nx-workspace/package.json'),
  );

  const pkg = (await fs.pathExists(pkgPath))
    ? await fs.readJSON(pkgPath)
    : { name: projectName, version: '0.1.0', private: true };

  pkg.scripts = pkg.scripts ?? {};
  for (const [key, value] of Object.entries<string>(kitPkg.scripts)) {
    if (key === 'setup:agents' || key.startsWith('sdd:')) {
      pkg.scripts[key] = pkg.scripts[key] ?? value;
    }
  }

  pkg.devDependencies = pkg.devDependencies ?? {};
  for (const dep of ['ajv', 'ajv-formats']) {
    pkg.devDependencies[dep] =
      pkg.devDependencies[dep] ?? kitPkg.devDependencies[dep];
  }

  await fs.writeJSON(pkgPath, pkg, { spaces: 2 });
}

async function readExistingHarnessFiles(
  root: string,
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    const path = resolve(root, file);
    if (!(await fs.pathExists(path))) continue;
    const stat = await fs.lstat(path);
    if (stat.isSymbolicLink()) continue;
    found.set(file, await fs.readFile(path, 'utf-8'));
    await fs.remove(path);
  }
  return found;
}

async function absorbIntoDualHarness(
  root: string,
  file: string,
  content: string,
): Promise<void> {
  const target = resolve(root, 'sdd/dual-harness', file);
  await fs.appendFile(
    target,
    `\n\n---\n\n## Instrucciones previas del proyecto (absorbidas al instalar SDD)\n\n${content.trim()}\n`,
    'utf-8',
  );
  logger.info(
    `Existing ${file} content preserved inside sdd/dual-harness/${file}`,
  );
}

async function writeGlobalJson(
  root: string,
  opts: WorkspaceOptions,
  layout: 'nx' | 'standalone',
): Promise<void> {
  const apps: Record<string, string> = {};
  for (const app of opts.apps) {
    apps[app.name] =
      layout === 'standalone'
        ? `. — ${app.type} (standalone: código en la raíz del repo)`
        : `apps/${app.name} — ${app.type}`;
  }

  // La forma debe cumplir sdd/schemas/global.schema.json (additionalProperties: false).
  await fs.writeJSON(
    resolve(root, 'sdd/global.json'),
    {
      $schema: './schemas/global.schema.json',
      project: opts.projectName,
      description: opts.description,
      version: '0.1.0',
      completed_modules: [],
      in_progress_modules: [],
      pending_modules: [],
      monorepo: {
        tool: layout === 'standalone' ? 'none (standalone repo)' : 'Nx',
        package_manager: 'pnpm',
        apps,
        libs:
          layout === 'standalone'
            ? 'n/a — repo standalone, sin libs'
            : 'libs/ — Shared libraries',
      },
    },
    { spaces: 2 },
  );
}

async function createSubprojectContext(
  root: string,
  category: 'apps' | 'libs' | 'tools',
  name: string,
  type: string,
  layout: 'nx' | 'standalone',
): Promise<void> {
  const dir = resolve(root, 'sdd/context', category, name);
  await fs.ensureDir(resolve(dir, 'updates'));
  await fs.writeFile(resolve(dir, 'updates/.gitkeep'), '', 'utf-8');

  const locationNote =
    layout === 'standalone'
      ? `> ⚠ **Repo standalone:** el código de esta app vive en la **raíz del repositorio**, no en \`${category}/${name}/\`. El identificador \`${category}/${name}\` es la convención con la que los registros SDD (global.json, specs, ciclos) refieren a este único subproyecto lógico.\n\n`
      : '';

  const constitutionPath = resolve(dir, 'constitution.md');
  if (!(await fs.pathExists(constitutionPath))) {
    await fs.writeFile(
      constitutionPath,
      `# Constitución — ${category}/${name}

> Versión 1.0 | Última actualización: cycle-0 (inicial)
> **PLANTILLA:** completar las secciones marcadas con \`[...]\` en el primer ciclo que toque este subproyecto.

${locationNote}## 1. Propósito

- **Tipo:** ${type}
- **Rol en el sistema:** [Qué problema resuelve este subproyecto y para quién.]

## 2. Stack tecnológico

- [Framework / librerías principales y versión]

## 3. Estructura y patrones

- [Estructura de carpetas y patrones de diseño adoptados]

## 4. Convenciones propias

- [Naming, testing, límites de dependencia con otros subproyectos]

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en \`updates/\` —
> este archivo base solo lo modifica la consolidación (ver \`sdd/context/context_prompt.md\` sección 6).
`,
      'utf-8',
    );
  }

  const contextPromptPath = resolve(dir, 'context_prompt.md');
  if (!(await fs.pathExists(contextPromptPath))) {
    await fs.writeFile(
      contextPromptPath,
      `# Context Prompt — ${category}/${name}

> Entry point para agentes que trabajen sobre \`${category}/${name}\`.
> Leer junto con \`constitution.md\` de este directorio **+ \`updates/*.md\` en orden de nombre**.

${locationNote}- **Tipo:** ${type}
- **Estado:** recién generado — sin ciclos SDD completados todavía.
- [Completar en el primer ciclo: módulos existentes, endpoints/componentes clave, cómo correr y testear.]
`,
      'utf-8',
    );
  }
}

function runSetupAgents(root: string): void {
  try {
    if (process.platform === 'win32') {
      exec(
        'powershell -ExecutionPolicy Bypass -File sdd/scripts/setup-agents.ps1',
        { cwd: root },
      );
    } else {
      exec('bash sdd/scripts/setup-agents.sh', { cwd: root });
    }
  } catch {
    logger.warn(
      'Could not run setup-agents automatically. Run `pnpm setup:agents` in the workspace to create the .claude/.github symlinks and root AGENTS.md/CLAUDE.md.',
    );
  }
}
