import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { exec } from './exec.js';
import { logger } from './logger.js';

/** `.git` ya presente en la raíz: el usuario inicializó el repo antes de generar (`--here`). */
export function isGitRepo(root: string): boolean {
  return existsSync(resolve(root, '.git'));
}

/**
 * Deja el workspace recién generado commiteado.
 *
 * Si `root` ya es un repo git (el caso `init` en un directorio con `git init -b main`
 * hecho a mano), NO se vuelve a inicializar: se commitea sobre la rama actual, sin
 * tocar remotes, ramas ni historia previa.
 *
 * Nunca aborta la generación: en un runner de CI sin identidad configurada,
 * el commit corta con `fatal: empty ident name` y el workspace ya está
 * completo — tirar abajo toda la generación por el commit no tiene sentido.
 */
export function initGitRepo(root: string, message: string): void {
  try {
    if (!isGitRepo(root)) {
      exec('git init', { cwd: root, silent: true });
    } else {
      logger.info('Existing git repository detected — committing on the current branch.');
    }
    exec('git add -A', { cwd: root, silent: true });
    exec(`git commit -m "${message}"`, { cwd: root, silent: true });
  } catch {
    logger.warn(
      'Initial commit skipped — git is missing or has no identity here ' +
        '(`git config user.email`). The workspace is complete: commit it yourself.',
    );
  }
}
