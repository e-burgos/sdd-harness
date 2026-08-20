import { resolve, dirname } from 'node:path';
import fs from 'fs-extra';
import { getTemplatesDir } from '../utils/fs.js';
import { exec } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import {
  computeManifest,
  hashFile,
  isGenerated,
  isHybrid,
  listDataPlaceholders,
  listKitFiles,
  readManifest,
  writeManifest,
} from './kit-manifest.js';
import { ensureHarnessPackageJson } from './sdd.generator.js';

export type UpdateReport = {
  legacyMode: boolean;
  updated: string[];
  added: string[];
  conflicts: string[];
  removedStale: string[];
  keptCustom: string[];
  validateOk: boolean | null;
};

/**
 * Actualiza el kit SDD instalado al que trae esta versión de la CLI,
 * preservando TODO lo del usuario:
 * - Los datos (global.json, specs/, fixes/, context de subproyectos,
 *   registros) jamás se tocan.
 * - Archivos del kit sin modificar localmente → se reemplazan.
 * - Archivos del kit modificados localmente → se preservan y la versión nueva
 *   queda al lado como <archivo>.new (el reporte lista los conflictos).
 * - Sin manifest previo (instalación legacy) → modo conservador: los híbridos
 *   (dual-harness, constitution/context_prompt globales) nunca se pisan.
 */
export async function updateSDD(root: string): Promise<UpdateReport> {
  const sddDir = resolve(root, 'sdd');
  if (!(await fs.pathExists(resolve(sddDir, 'global.json')))) {
    throw new Error(
      'No SDD installation found (sdd/global.json missing). Run `harness configure sdd` first.',
    );
  }

  const kitDir = resolve(getTemplatesDir(), 'sdd');
  const oldManifest = await readManifest(sddDir);
  const newManifest = await computeManifest(kitDir);

  const report: UpdateReport = {
    legacyMode: oldManifest === null,
    updated: [],
    added: [],
    conflicts: [],
    removedStale: [],
    keptCustom: [],
    validateOk: null,
  };

  for (const rel of await listKitFiles(kitDir)) {
    const src = resolve(kitDir, rel);
    const dest = resolve(sddDir, rel);
    const newHash = newManifest.files[rel];

    if (!(await fs.pathExists(dest))) {
      await fs.ensureDir(dirname(dest));
      await fs.copy(src, dest);
      report.added.push(rel);
      continue;
    }

    const currentHash = hashFile(dest);
    if (currentHash === newHash) continue;

    const baseHash = oldManifest?.files[rel];
    // Los híbridos nunca se reemplazan en silencio: si llegaron hasta acá es porque
    // difieren del kit, así que o son del usuario o son suyos a medias. Confiar en el
    // baseline no alcanza — los manifests escritos antes de v0.9.3 anotaron el hash del
    // archivo instalado, así que un híbrido customizado se lee como "sin modificar".
    const userModified =
      isHybrid(rel) || (oldManifest !== null && currentHash !== baseHash);

    if (!userModified) {
      await fs.copy(src, dest);
      report.updated.push(rel);
      continue;
    }

    if (baseHash !== undefined && newHash === baseHash) {
      report.keptCustom.push(rel);
      continue;
    }

    await fs.copy(src, `${dest}.new`);
    report.conflicts.push(rel);
  }

  if (oldManifest) {
    for (const rel of Object.keys(oldManifest.files)) {
      if (newManifest.files[rel]) continue;
      const dest = resolve(sddDir, rel);
      if (!(await fs.pathExists(dest))) continue;
      if (hashFile(dest) === oldManifest.files[rel]) {
        await fs.remove(dest);
        report.removedStale.push(rel);
      } else {
        report.keptCustom.push(rel);
      }
    }
  }

  // Los directorios de datos que el kit scaffoldea (memory/journal/) solo llegan
  // por su .gitkeep; nunca se pisa nada, solo se crea lo que falta.
  for (const rel of await listDataPlaceholders(kitDir)) {
    const dest = resolve(sddDir, rel);
    if (await fs.pathExists(dirname(dest))) continue;
    await fs.ensureDir(dirname(dest));
    await fs.copy(resolve(kitDir, rel), dest);
    report.added.push(rel);
  }

  await fs.copy(resolve(kitDir, 'catalog.json'), resolve(sddDir, 'catalog.json'));
  await writeManifest(sddDir, newManifest);

  const pkgJson = await fs.readJSON(resolve(root, 'package.json')).catch(() => null);
  const projectName = pkgJson?.name?.replace(/^@[^/]+\//, '') ?? 'project';
  await ensureHarnessPackageJson(root, projectName);

  if (await fs.pathExists(resolve(root, 'nx.json'))) {
    await fs.writeFile(resolve(root, '.nxignore'), 'sdd/templates\n', 'utf-8');
  }

  runQuiet(root, 'node sdd/scripts/rebuild-catalog.mjs');
  runSetupAgents(root);

  try {
    exec('node sdd/scripts/validate-sdd.mjs', { cwd: root, silent: true });
    report.validateOk = true;
  } catch {
    report.validateOk = false;
  }

  return report;
}

function runQuiet(root: string, command: string): void {
  try {
    exec(command, { cwd: root, silent: true });
  } catch {
    logger.warn(`Could not run \`${command}\` automatically.`);
  }
}

function runSetupAgents(root: string): void {
  try {
    if (process.platform === 'win32') {
      exec(
        'powershell -ExecutionPolicy Bypass -File sdd/scripts/setup-agents.ps1',
        { cwd: root, silent: true },
      );
    } else {
      exec('bash sdd/scripts/setup-agents.sh', { cwd: root, silent: true });
    }
  } catch {
    logger.warn('Could not refresh harness symlinks. Run `pnpm setup:agents`.');
  }
}
