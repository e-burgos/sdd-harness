import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../..', import.meta.url));
const CLI_IMPORT = /(?:from\s+|import\(\s*|require\(\s*|import\s+)['"]@e-burgos\/sdd-harness/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|mjs)$/.test(entry.name) && entry.name !== 'no-cli-import.spec.ts' ? [full] : [];
  });
}

describe('bridge/CLI boundary', () => {
  it('no bridge source imports @e-burgos/sdd-harness', () => {
    const offenders = sourceFiles(SRC).filter((file) => CLI_IMPORT.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
