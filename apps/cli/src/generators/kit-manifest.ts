import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import fs from 'fs-extra';
import { version } from '../version.js';

export const KIT_MANIFEST_FILE = 'kit.json';

/**
 * Frontera de propiedad dentro de sdd/ (la base del update seguro):
 * - kit-owned: reemplazable en un update (con detección de modificación local).
 * - data: del usuario — el update JAMÁS los toca.
 * - generated: regenerables después del update.
 */
const DATA_PREFIXES = [
  'specs/',
  'fixes/',
  'context/apps/',
  'context/libs/',
  'context/tools/',
  'memory/journal/',
];

const DATA_FILES = new Set([
  'global.json',
  'tasks.json',
  'api.json',
  'schema.json',
  'components.json',
  'fixes.json',
]);

const GENERATED_FILES = new Set(['catalog.json']);

/**
 * Archivos del kit que arrancan como plantilla pero el usuario completa o el
 * instalador absorbe contenido previo. En modo legacy (sin manifest) nunca se
 * sobreescriben; con manifest los gobierna el hash como a cualquier otro.
 */
const HYBRID_FILES = new Set([
  'context/constitution.md',
  'context/context_prompt.md',
  'dual-harness/AGENTS.md',
  'dual-harness/CLAUDE.md',
  'memory/lessons.md',
  'pricing.json',
]);

export type KitManifest = {
  kit_version: string;
  installed_at: string;
  files: Record<string, string>;
};

export function isKitOwned(relPath: string): boolean {
  if (relPath === KIT_MANIFEST_FILE) return false;
  if (DATA_FILES.has(relPath)) return false;
  if (GENERATED_FILES.has(relPath)) return false;
  return !DATA_PREFIXES.some((p) => relPath.startsWith(p));
}

export function isGenerated(relPath: string): boolean {
  return GENERATED_FILES.has(relPath);
}

export function isHybrid(relPath: string): boolean {
  return HYBRID_FILES.has(relPath);
}

export function hashFile(path: string): string {
  return createHash('sha256').update(fs.readFileSync(path)).digest('hex');
}

export async function listKitFiles(kitDir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else out.push(relative(kitDir, full));
    }
  };
  await walk(kitDir);
  return out.filter(isKitOwned).sort();
}

export async function computeManifest(kitDir: string): Promise<KitManifest> {
  const files: Record<string, string> = {};
  for (const rel of await listKitFiles(kitDir)) {
    files[rel] = hashFile(resolve(kitDir, rel));
  }
  return {
    kit_version: version,
    installed_at: new Date().toISOString().slice(0, 10),
    files,
  };
}

export async function writeManifest(sddDir: string): Promise<void> {
  const manifest = await computeManifest(sddDir);
  await fs.writeJSON(resolve(sddDir, KIT_MANIFEST_FILE), manifest, {
    spaces: 2,
  });
}

export async function readManifest(sddDir: string): Promise<KitManifest | null> {
  const path = resolve(sddDir, KIT_MANIFEST_FILE);
  if (!(await fs.pathExists(path))) return null;
  try {
    const manifest = await fs.readJSON(path);
    return manifest?.files ? manifest : null;
  } catch {
    return null;
  }
}
