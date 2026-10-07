import { realpath } from 'node:fs/promises';
import path from 'node:path';

export class PathError extends Error {
  constructor(
    readonly code: 'bad-path' | 'not-found',
    message: string,
  ) {
    super(message);
  }
}

/** Resuelve `rel` (posix, relativo a la raíz) sólo si queda dentro de `sdd/` sin escapar. */
export async function resolveSddPath(root: string, rel: string): Promise<string> {
  if (typeof rel !== 'string' || rel.length === 0 || rel.length > 512) {
    throw new PathError('bad-path', 'ruta vacía o demasiado larga');
  }
  const norm = rel.replace(/\\/g, '/');
  if (norm.startsWith('/') || /^[A-Za-z]:/.test(norm)) throw new PathError('bad-path', 'ruta absoluta');
  const parts = norm.split('/');
  if (parts.length < 2 || parts[0] !== 'sdd') throw new PathError('bad-path', 'fuera de sdd/');
  if (parts.some((p) => p === '' || p.startsWith('.'))) throw new PathError('bad-path', 'segmento inválido');
  let rootReal: string;
  let sddReal: string;
  try {
    rootReal = await realpath(root);
    sddReal = await realpath(path.join(root, 'sdd'));
  } catch {
    throw new PathError('not-found', 'no existe sdd/');
  }
  if (!sddReal.startsWith(rootReal + path.sep)) throw new PathError('bad-path', 'sdd/ escapa de la raíz');
  let real: string;
  try {
    real = await realpath(path.join(root, ...parts));
  } catch {
    throw new PathError('not-found', `no existe: ${norm}`);
  }
  if (real !== sddReal && !real.startsWith(sddReal + path.sep)) {
    throw new PathError('bad-path', 'la ruta escapa de sdd/');
  }
  if (path.relative(sddReal, real).split(path.sep).some((p) => p.startsWith('.'))) {
    throw new PathError('bad-path', 'segmento inválido tras resolver');
  }
  return real;
}
