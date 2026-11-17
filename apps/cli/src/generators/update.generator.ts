import { resolve, dirname } from 'node:path';
import fs from 'fs-extra';
import { getTemplatesDir } from '../utils/fs.js';
import { exec } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import {
  BASELINE_TRUSTED_SINCE,
  HARNESS_FILES,
  compareKitVersions,
  computeManifest,
  harnessIsHybrid,
  hashContent,
  hashFile,
  isGenerated,
  isHybrid,
  isKitOwned,
  listDataPlaceholders,
  listKitFiles,
  readManifest,
  writeManifest,
  type KitManifest,
} from './kit-manifest.js';
import { isPublishedHarnessContent } from './harness-history.js';
import { fold, mergeIntoProjectMd, readProjectMd, splitAbsorbed } from './project-md.js';
import { ensureHarnessPackageJson } from './sdd.generator.js';
import {
  collectMigrationNotices,
  type MigrationNotice,
} from './kit-migrations.js';
import { version as cliVersion } from '../version.js';

export type UpdateReport = {
  legacyMode: boolean;
  updated: string[];
  added: string[];
  conflicts: string[];
  removedStale: string[];
  keptCustom: string[];
  validateOk: boolean | null;
  /** Vocabulario que el kit renombró y quedó viejo en archivos que el update no toca. */
  migrations: MigrationNotice[];
  /** El repo viene de un kit anterior al núcleo delgado: los archivos del arnés eran híbridos. */
  harnessCoreNotice: boolean;
  /** Archivos del arnés que todavía llevan texto absorbido (aviso cuando no se pidió --split-project). */
  absorbedInHarness: string[];
  /** Resultado por archivo de `--split-project`; null si no se pidió. */
  splitProject: SplitProjectResult[] | null;
};

export type SplitProjectOutcome = 'moved' | 'replaced' | 'kept-new' | 'kept' | 'nothing';

export type SplitProjectResult = {
  file: string;
  movedBytes: number;
  outcome: SplitProjectOutcome;
};

export type UpdateOptions = { splitProject?: boolean };

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
export async function updateSDD(
  root: string,
  options: UpdateOptions = {},
): Promise<UpdateReport> {
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
    migrations: [],
    harnessCoreNotice: harnessIsHybrid(oldManifest?.kit_version),
    absorbedInHarness: [],
    splitProject: null,
  };

  const installedKitVersion = oldManifest?.kit_version ?? null;
  if (options.splitProject) {
    report.splitProject = await splitProjectInstructions(root, kitDir, oldManifest, newManifest);
  } else {
    report.absorbedInHarness = await harnessFilesWithAbsorbedText(sddDir);
  }

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
      isHybrid(rel, installedKitVersion) || (oldManifest !== null && currentHash !== baseHash);

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
      // Un archivo que dejó de ser kit-owned (pasó a data) sale del manifiesto nuevo sin
      // que el kit lo haya dado de baja: borrarlo acá destruiría datos del usuario. El
      // barrido existe solo para los archivos del kit que un release eliminó.
      if (!isKitOwned(rel)) continue;
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

  // Data files whose initial content ships with the kit: seeded once when missing and
  // never rewritten afterwards. `tools.json` is new since v0.12 (so rtk comes up enabled
  // on older kits); `memory/lessons.md` is the project's distilled memory — the kit only
  // provides its starting point, and a release touching that seed must never land a
  // `.new` next to real accumulated lessons.
  for (const rel of ['tools.json', 'verify.json', 'memory/lessons.md']) {
    const dest = resolve(sddDir, rel);
    if (await fs.pathExists(dest)) continue;
    await fs.ensureDir(dirname(dest));
    await fs.copy(resolve(kitDir, rel), dest);
    report.added.push(rel);
  }

  for (const entry of report.splitProject ?? []) {
    if (entry.outcome === 'kept' && report.conflicts.includes(entry.file)) {
      entry.outcome = 'kept-new';
    }
  }

  await fs.copy(resolve(kitDir, 'catalog.json'), resolve(sddDir, 'catalog.json'));

  // Antes de pisar el manifiesto: es el último momento en que se sabe de qué versión
  // venía este repo. Sin manifest la instalación es anterior a v0.9.x, o sea, por debajo
  // de cualquier migración registrada.
  report.migrations = await collectMigrationNotices(
    root,
    oldManifest?.kit_version ?? '0.0.0',
    cliVersion,
    newManifest.files,
  );

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

async function harnessFilesWithAbsorbedText(sddDir: string): Promise<string[]> {
  const found: string[] = [];
  for (const rel of HARNESS_FILES) {
    const path = resolve(sddDir, rel);
    if (!(await fs.pathExists(path))) continue;
    if (splitAbsorbed(await fs.readFile(path, 'utf-8'))) found.push(rel);
  }
  return found;
}

async function splitProjectInstructions(
  root: string,
  kitDir: string,
  oldManifest: KitManifest | null,
  newManifest: KitManifest,
): Promise<SplitProjectResult[]> {
  const sddDir = resolve(root, 'sdd');
  const entries: { rel: string; dest: string; content: string; absorbed: string | null; head: string }[] = [];
  const results = new Map<string, SplitProjectResult>();

  for (const rel of HARNESS_FILES) {
    results.set(rel, { file: rel, movedBytes: 0, outcome: 'nothing' });
    const dest = resolve(sddDir, rel);
    if (!(await fs.pathExists(dest))) continue;
    const content = await fs.readFile(dest, 'utf-8');
    const parts = splitAbsorbed(content);
    entries.push({
      rel,
      dest,
      content,
      absorbed: parts ? parts.absorbed : null,
      head: parts ? parts.head : content,
    });
  }

  const contributions = new Map<string, string>();
  for (const e of entries) {
    if (e.absorbed) contributions.set(e.rel.split('/').pop() as string, e.absorbed);
  }
  await mergeIntoProjectMd(root, contributions);
  const projectNow = fold((await readProjectMd(root)) ?? '');
  for (const e of entries) {
    if (e.absorbed && !projectNow.includes(fold(e.absorbed))) {
      throw new Error(
        `Could not move the instructions of sdd/${e.rel} to sdd/dual-harness/project.md; nothing was removed.`,
      );
    }
  }

  for (const e of entries) {
    const result = results.get(e.rel) as SplitProjectResult;
    const hadText = e.absorbed !== null;
    result.movedBytes = e.absorbed ? Buffer.byteLength(e.absorbed) : 0;
    const headHash = hashContent(Buffer.from(e.head, 'utf-8'));
    const baselineTrusted =
      oldManifest !== null && compareKitVersions(oldManifest.kit_version, BASELINE_TRUSTED_SINCE) >= 0;
    const pristineBaseline =
      (baselineTrusted && oldManifest?.files[e.rel] === headHash) ||
      isPublishedHarnessContent(e.rel, headHash);
    const isNewKit = newManifest.files[e.rel] === headHash;

    if (isNewKit && !hadText) continue;
    if (pristineBaseline || isNewKit) {
      await fs.copy(resolve(kitDir, e.rel), e.dest);
      result.outcome = hadText ? 'moved' : 'replaced';
      continue;
    }
    if (hadText) await fs.writeFile(e.dest, e.head.replace(/\s+$/, '') + '\n', 'utf-8');
    result.outcome = 'kept';
  }
  return [...results.values()];
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
