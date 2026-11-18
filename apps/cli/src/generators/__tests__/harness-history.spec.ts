import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PUBLISHED_HARNESS_HASHES, isPublishedHarnessContent } from '../harness-history.js';
import { hashContent } from '../kit-manifest.js';

const repoRoot = resolve(__dirname, '../../../../..');
const show = (ref: string, file: string): string | null => {
  try {
    return execFileSync('git', ['show', `${ref}:apps/cli/templates/sdd/dual-harness/${file}`], {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
};

describe('harness-history', () => {
  it('cada hash es sha256 en hexadecimal y los tres archivos tienen entradas', () => {
    expect(Object.keys(PUBLISHED_HARNESS_HASHES).sort()).toEqual([
      'dual-harness/AGENTS.md',
      'dual-harness/CLAUDE.md',
      'dual-harness/GEMINI.md',
    ]);
    for (const hashes of Object.values(PUBLISHED_HARNESS_HASHES)) {
      expect(hashes.length).toBeGreaterThan(0);
      for (const hash of hashes) expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it.each(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'])('contiene el hash de %s tal como lo publicó v0.20.0', (file) => {
    const content = show('v0.20.0', file);
    if (content === null) return;
    expect(isPublishedHarnessContent(`dual-harness/${file}`, hashContent(Buffer.from(content, 'utf-8')))).toBe(true);
    expect(
      isPublishedHarnessContent(`dual-harness/${file}`, hashContent(Buffer.from(content.replace(/\n/g, '\r\n'), 'utf-8'))),
    ).toBe(true);
  });
});
