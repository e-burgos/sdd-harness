import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { MAX_DIR_ENTRIES, type DirListing } from '@sdd-studio/protocol';
import { PathError } from '../workspace/paths';
import { containingBase, nativeRealpath, validatePathShape, type PathPlatform } from './fs-paths';

export interface DirsContext {
  bases: string[];
  start: string;
  platform: PathPlatform;
  showHidden: boolean;
}

const isDirectory = (target: string) => stat(target).then((info) => info.isDirectory(), () => false);

export async function listDirs(input: string | undefined, ctx: DirsContext): Promise<DirListing> {
  const requested = input ?? ctx.start;
  const shapeFailure = validatePathShape(requested, ctx.platform);
  if (shapeFailure) throw new PathError('bad-path', `invalid path (${shapeFailure})`);

  let resolved: string;
  try {
    resolved = await nativeRealpath(path.resolve(requested));
  } catch {
    throw new PathError('not-found', 'directory does not exist');
  }
  if (!containingBase(resolved, ctx.bases, ctx.platform)) throw new PathError('bad-path', 'outside the allowed folders');
  if (!(await isDirectory(resolved))) throw new PathError('bad-path', 'not a directory');

  const dirents = await readdir(resolved, { withFileTypes: true });
  const candidates = dirents
    .filter((dirent) => ctx.showHidden || !dirent.name.startsWith('.'))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const entries: DirListing['entries'] = [];
  let truncated = false;
  for (const dirent of candidates) {
    const symlink = dirent.isSymbolicLink();
    if (!(symlink ? await isDirectory(path.join(resolved, dirent.name)) : dirent.isDirectory())) continue;
    if (entries.length === MAX_DIR_ENTRIES) {
      truncated = true;
      break;
    }
    entries.push({ name: dirent.name, symlink });
  }

  const parentPath = path.dirname(resolved);
  const parent = parentPath !== resolved && containingBase(parentPath, ctx.bases, ctx.platform) ? parentPath : null;
  return { path: resolved, parent, entries, truncated };
}
