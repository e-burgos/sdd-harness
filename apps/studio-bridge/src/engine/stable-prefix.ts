import fs from 'node:fs';
import path from 'node:path';

export const STABLE_PREFIX_SOURCES = [
  'sdd/context/context_prompt.md',
  'sdd/context/constitution.md',
  'sdd/memory/lessons.md',
] as const;

export const STABLE_PREFIX_MAX_BYTES = 256 * 1024;

export interface PrefixSection {
  source: string;
  content: string;
}

const defaultWarn = (message: string): void => {
  console.warn(message);
};

export const composeStablePrefix = (sections: PrefixSection[]): string =>
  sections
    .filter((section) => section.content.length > 0)
    .map((section) => `<project-context source="${section.source}">\n${section.content}\n</project-context>`)
    .join('\n\n');

const readSource = (root: string, source: string): string | null => {
  try {
    const buffer = fs.readFileSync(path.join(root, source));
    if (buffer.byteLength > STABLE_PREFIX_MAX_BYTES) return null;
    return buffer.toString('utf8').replace(/\r\n/g, '\n').trim();
  } catch {
    return null;
  }
};

export function createStablePrefixLoader(root: string, warn: (message: string) => void = defaultWarn): () => string {
  const warned = new Set<string>();
  return () =>
    composeStablePrefix(
      STABLE_PREFIX_SOURCES.flatMap((source) => {
        const content = readSource(root, source);
        if (content !== null) return [{ source, content }];
        if (!warned.has(source)) {
          warned.add(source);
          warn(`stable prefix: ${source} is missing or unreadable, skipped`);
        }
        return [];
      }),
    );
}
