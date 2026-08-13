import { exec } from './exec.js';
import { logger } from './logger.js';

/**
 * `git init` + commit inicial del workspace recién generado.
 *
 * Nunca aborta la generación: en un runner de CI sin identidad configurada,
 * `git commit` corta con `fatal: empty ident name` y el workspace ya está
 * completo — tirar abajo toda la generación por el commit no tiene sentido.
 */
export function initGitRepo(root: string, message: string): void {
  try {
    exec('git init', { cwd: root, silent: true });
    exec('git add -A', { cwd: root, silent: true });
    exec(`git commit -m "${message}"`, { cwd: root, silent: true });
  } catch {
    logger.warn(
      'Initial commit skipped — git is missing or has no identity here ' +
        '(`git config user.email`). The workspace is complete: commit it yourself.',
    );
  }
}
