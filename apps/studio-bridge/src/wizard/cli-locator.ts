import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HARNESS_PACKAGE_NAME = '@e-burgos/sdd-harness';

export interface HarnessCli {
  bin: string;
  version: string;
}

export class CliLocatorError extends Error {}

const defaultResolve = (specifier: string): string => import.meta.resolve(specifier);

interface Manifest {
  name?: string;
  version?: string;
  bin?: string | Record<string, string>;
}

function harnessCandidates(entry: string): { dir: string; manifest: Manifest }[] {
  const found: { dir: string; manifest: Manifest }[] = [];
  for (let dir = path.dirname(entry); ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'package.json');
    if (existsSync(file)) {
      const manifest = JSON.parse(readFileSync(file, 'utf8')) as Manifest;
      if (manifest.name === HARNESS_PACKAGE_NAME) found.push({ dir, manifest });
    }
    if (path.dirname(dir) === dir) return found;
  }
}

let cached: HarnessCli | null = null;

export function locateHarnessCli(resolveSpecifier?: (specifier: string) => string): HarnessCli {
  if (!resolveSpecifier && cached) return cached;
  let entry: string;
  try {
    entry = fileURLToPath((resolveSpecifier ?? defaultResolve)(HARNESS_PACKAGE_NAME));
  } catch (error) {
    throw new CliLocatorError(`${HARNESS_PACKAGE_NAME} is not installed next to the bridge: ${error instanceof Error ? error.message : String(error)}`);
  }
  for (const { dir, manifest } of harnessCandidates(entry)) {
    const relativeBin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.harness;
    if (!relativeBin || !manifest.version) continue;
    const bin = path.join(dir, relativeBin);
    if (!existsSync(bin)) continue;
    const located = { bin, version: manifest.version };
    if (!resolveSpecifier) cached = located;
    return located;
  }
  throw new CliLocatorError(`harness binary of ${HARNESS_PACKAGE_NAME} not found from ${entry}`);
}
