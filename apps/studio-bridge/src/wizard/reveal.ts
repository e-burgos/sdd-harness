import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { openCommand } from '../open-browser';
import { PathError } from '../workspace/paths';
import { containingBase, nativeRealpath, type PathPlatform } from './fs-paths';

export type SpawnOpener = (cmd: string, args: string[]) => void;

const detachedOpener: SpawnOpener = (cmd, args) => {
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.on('error', () => undefined);
  child.unref();
};

export async function revealPath(
  target: string,
  ctx: { bases: string[]; platform?: NodeJS.Platform; open?: SpawnOpener },
): Promise<void> {
  const platform = ctx.platform ?? process.platform;
  const pathPlatform: PathPlatform = platform === 'win32' ? 'win32' : 'posix';
  let real: string;
  try {
    real = await nativeRealpath(target);
  } catch {
    throw new PathError('not-found', 'folder does not exist');
  }
  const base = containingBase(real, ctx.bases, pathPlatform);
  if (!base || base.relation === 'equal') throw new PathError('bad-path', 'outside the allowed folders');
  if (!(await stat(real)).isDirectory()) throw new PathError('bad-path', 'not a directory');
  const { cmd, args } = openCommand(platform, real);
  (ctx.open ?? detachedOpener)(cmd, args);
}
