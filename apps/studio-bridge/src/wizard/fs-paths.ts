import { realpath } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

export type PathPlatform = 'posix' | 'win32';

export const nativeRealpath = promisify(realpath.native);

const pathModule = (platform: PathPlatform) => (platform === 'win32' ? path.win32 : path.posix);

export function isInsideOrEqual(child: string, parent: string, platform: PathPlatform): 'inside' | 'equal' | 'outside' {
  const mod = pathModule(platform);
  const relative = mod.relative(parent, child);
  if (relative === '') return 'equal';
  return relative.startsWith('..') || mod.isAbsolute(relative) ? 'outside' : 'inside';
}

export async function resolveBases(directories: string[]): Promise<string[]> {
  const resolved: string[] = [];
  for (const directory of directories) {
    try {
      const real = await nativeRealpath(directory);
      if (!resolved.includes(real)) resolved.push(real);
    } catch {
      continue;
    }
  }
  return resolved;
}

export function containingBase(candidate: string, bases: string[], platform: PathPlatform): { base: string; relation: 'inside' | 'equal' } | null {
  for (const base of bases) {
    const relation = isInsideOrEqual(candidate, base, platform);
    if (relation !== 'outside') return { base, relation };
  }
  return null;
}

export type ShapeFailure = 'relative' | 'dot-segment' | 'bad-char' | 'reserved-name' | 'unc' | 'too-long';

const WIN32_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const WIN32_FORBIDDEN_CHARS = /[<>:"|?*]/;
const WIN32_DRIVE = /^[A-Za-z]:$/;

export function validatePathShape(input: string, platform: PathPlatform): ShapeFailure | null {
  if (input.length === 0 || input.length > 1024) return 'too-long';
  if (input.includes('\0')) return 'bad-char';
  const mod = pathModule(platform);
  if (platform === 'win32' && /^[\\/]{2}/.test(input)) return 'unc';
  if (!mod.isAbsolute(input) || (platform === 'win32' && /^[\\/][^\\/]/.test(input))) return 'relative';
  const segments = input.split(platform === 'win32' ? /[\\/]/ : '/').filter((segment) => segment !== '');
  for (const [index, segment] of segments.entries()) {
    if (segment === '.' || segment === '..') return 'dot-segment';
    if (platform !== 'win32') continue;
    if (index === 0 && WIN32_DRIVE.test(segment)) continue;
    if (WIN32_FORBIDDEN_CHARS.test(segment) || /[. ]$/.test(segment)) return 'bad-char';
    if (WIN32_RESERVED.test(segment.split('.')[0]!)) return 'reserved-name';
  }
  return null;
}
