import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { initGitRepo } from '../git.js';

describe('utils/git initGitRepo', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'harness-git-'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('inicializa el repo del workspace generado', () => {
    writeFileSync(resolve(dir, 'package.json'), '{}\n');
    initGitRepo(dir, 'chore: initial setup');
    expect(existsSync(resolve(dir, '.git'))).toBe(true);
  });

  // El commit inicial no puede tumbar la generación: en un runner sin identidad
  // git corta con "empty ident name" y el workspace ya está completo.
  it('no propaga el error cuando git falla', () => {
    expect(() =>
      initGitRepo(resolve(dir, 'does-not-exist'), 'chore: initial setup'),
    ).not.toThrow();
  });
});
