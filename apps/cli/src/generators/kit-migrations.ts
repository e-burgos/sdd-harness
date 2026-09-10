import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import fs from 'fs-extra';
import { hashFile } from './kit-manifest.js';

/**
 * Renames y cambios breaking que el kit hizo en su propio vocabulario. El update es el
 * único lugar del sistema que sabe DE QUÉ versión venís (después, `kit.json` ya quedó
 * pisado con la nueva), así que es el único que puede avisar a tiempo.
 *
 * Esto REPORTA, no corrige: la misma palabra suele tener más de un uso en un repo real
 * — el veredicto del gate, el vocabulario propio de un equipo, la prosa de un ciclo ya
 * cerrado — y esa distinción es criterio humano, no una regex. Una entrada se borra de
 * la tabla un par de releases después de su `since`.
 */
type KitMigration = {
  since: string;
  summary: string;
  pattern: RegExp;
  caveat: string;
};

const KIT_MIGRATIONS: KitMigration[] = [
  {
    since: '0.14.0',
    summary:
      'the SPEC GATE verdict is printed in English: APROBADO/BLOQUEADO → APPROVED/BLOCKED',
    pattern: /\b(APROBADO|BLOQUEADO)\b/g,
    caveat:
      'Not every hit is stale: the word may be your own vocabulary (a reviewer verdict) or closed history (a cycle logged as APROBADO). Neither should be rewritten.',
  },
];

export type MigrationNotice = {
  since: string;
  summary: string;
  caveat: string;
  hits: { file: string; count: number }[];
};

/** Sólo texto: evita leer imágenes o fuentes del visor. */
const SCANNABLE = /\.(md|json|ya?ml|txt|mjs|js|sh|ps1|toml)$/i;
const MAX_LISTED = 12;

function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * Busca el vocabulario viejo SOLO en lo que el update no reescribe: los datos del repo y
 * los archivos del kit que el equipo editó. Un archivo byte-idéntico al que shippeó el kit
 * ya viene renombrado, así que no puede tener referencias viejas.
 */
export async function collectMigrationNotices(
  root: string,
  fromVersion: string,
  toVersion: string,
  newManifest: Record<string, string>,
): Promise<MigrationNotice[]> {
  const due = KIT_MIGRATIONS.filter(
    (m) =>
      compareVersions(fromVersion, m.since) < 0 &&
      compareVersions(toVersion, m.since) >= 0,
  );
  if (!due.length) return [];

  const sddDir = resolve(root, 'sdd');
  const candidates = (await walk(sddDir)).filter((path) => {
    const rel = relative(sddDir, path).split('\\').join('/');
    if (!SCANNABLE.test(rel) || rel.endsWith('.new')) return false;
    const shipped = newManifest[rel];
    return !(shipped && hashFile(path) === shipped);
  });

  // `.github/copilot-instructions.md` es archivo real (los lectores server-side de GitHub
  // no siguen symlinks) y editable: entra al escaneo aunque viva fuera de sdd/.
  const copilot = resolve(root, '.github/copilot-instructions.md');
  if (await fs.pathExists(copilot)) candidates.push(copilot);

  const notices: MigrationNotice[] = [];
  for (const migration of due) {
    const hits: { file: string; count: number }[] = [];
    for (const path of candidates) {
      let content: string;
      try {
        content = readFileSync(path, 'utf8');
      } catch {
        continue;
      }
      const count = content.match(migration.pattern)?.length ?? 0;
      if (count) {
        hits.push({
          file: relative(root, path).split('\\').join('/'),
          count,
        });
      }
    }
    if (hits.length) {
      hits.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));
      notices.push({
        since: migration.since,
        summary: migration.summary,
        caveat: migration.caveat,
        hits,
      });
    }
  }
  return notices;
}

export const MIGRATION_MAX_LISTED = MAX_LISTED;
