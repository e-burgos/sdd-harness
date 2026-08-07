import { join, relative, resolve } from 'node:path';
import fs from 'fs-extra';
import { getTemplatesDir } from './fs.js';

const TEXT_FILE_RE =
  /\.(java|xml|json|ts|tsx|js|jsx|mjs|cjs|css|html|md|ya?ml|conf|sql|properties|txt|gitkeep)$/i;

export type TokenMap = Record<string, string>;

export function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function toFlatCase(kebab: string): string {
  return kebab.replace(/-/g, '');
}

/**
 * Resolves a blueprint directory under sdd/templates/.
 * Prefers the target repo's own sdd/templates (the SDD convention layer may be
 * customized per repo); falls back to the copy shipped with this package.
 */
export function resolveBlueprintDir(root: string, blueprintPath: string): string {
  const inRepo = resolve(root, 'sdd/templates', blueprintPath);
  if (fs.existsSync(inRepo)) return inRepo;
  return resolve(getTemplatesDir(), 'sdd/templates', blueprintPath);
}

function applyTokens(value: string, tokens: TokenMap): string {
  let out = value;
  for (const [from, to] of Object.entries(tokens)) {
    out = out.split(from).join(to);
  }
  return out;
}

/**
 * Copies a blueprint tree applying token replacement to both file paths and
 * text file contents. Binary files are copied as-is.
 */
export async function copyBlueprint(
  srcDir: string,
  destDir: string,
  tokens: TokenMap = {},
): Promise<void> {
  const entries = await walk(srcDir);
  for (const absPath of entries) {
    const relPath = relative(srcDir, absPath);
    const destPath = join(destDir, applyTokens(relPath, tokens));
    await fs.ensureDir(resolve(destPath, '..'));
    if (TEXT_FILE_RE.test(absPath) || isDotfile(absPath)) {
      const content = await fs.readFile(absPath, 'utf-8');
      await fs.writeFile(destPath, applyTokens(content, tokens), 'utf-8');
    } else {
      await fs.copy(absPath, destPath);
    }
  }
}

function isDotfile(path: string): boolean {
  const base = path.split('/').pop() ?? '';
  return base.startsWith('.') || !base.includes('.');
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}
