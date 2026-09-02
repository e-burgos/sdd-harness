import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
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

describe('utils/git initGitRepo sobre un repo existente (init --here)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'harness-git-existing-'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // BUG-1: init hacía `git init` de nuevo dentro del subdirectorio y el repo del padre
  // quedaba vacío. Ahora se commitea sobre la rama actual del repo que ya existe.
  it('no re-inicializa: commitea en la rama actual del repo existente', () => {
    execSync('git init -q -b feature/prep', { cwd: dir });
    execSync('git -c user.email=t@t -c user.name=t commit -q --allow-empty -m "first"', { cwd: dir });
    writeFileSync(resolve(dir, 'package.json'), '{}\n');

    initGitRepo(dir, 'chore: initial workspace setup');

    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: dir, encoding: 'utf-8' }).trim();
    expect(branch).toBe('feature/prep');
    const log = execSync('git log --oneline', { cwd: dir, encoding: 'utf-8' });
    expect(log.split('\n').filter(Boolean).length).toBeGreaterThanOrEqual(1);
    expect(log).toContain('first');
  });
});
