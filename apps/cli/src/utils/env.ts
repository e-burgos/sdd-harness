import { resolve } from 'node:path';
import { logger } from './logger.js';

/**
 * Con NX_WORKSPACE_ROOT_PATH apuntando a otro directorio (típico en una sesión de IDE cuyo
 * directorio primario es otro repo), cualquier `nx …` corrido acá ejecuta los targets de ESE
 * workspace y reporta éxito. Se avisa en la primera línea de init/add/update y se devuelve
 * el resultado para que el caller decida (el gate de verificación no puede confiar en nx así).
 */
export function warnIfNxRootMismatch(cwd: string = process.cwd()): boolean {
  const nxRoot = process.env['NX_WORKSPACE_ROOT_PATH'];
  if (!nxRoot || resolve(nxRoot) === resolve(cwd)) return false;
  logger.warn(
    `NX_WORKSPACE_ROOT_PATH=${nxRoot} is not this directory (${resolve(cwd)}) — any \`nx\` command run here targets THAT workspace. Unset it (\`unset NX_WORKSPACE_ROOT_PATH\`) before lint/test/build.`,
  );
  return true;
}
