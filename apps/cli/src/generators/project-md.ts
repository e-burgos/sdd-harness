import { resolve } from 'node:path';
import fs from 'fs-extra';

export const ABSORBED_HEADING =
  '## Instrucciones previas del proyecto (absorbidas al instalar SDD)';

export const PROJECT_MD_REL = 'sdd/dual-harness/project.md';

const PROJECT_MD_HEADER = `# Instrucciones propias del proyecto

Este archivo es del repo: \`harness update sdd\` nunca lo toca. Los agentes lo leen junto con el núcleo del kit.
`;

export const fold = (s: string) => s.replace(/\r\n/g, '\n').trim();

export function projectMdPath(root: string): string {
  return resolve(root, PROJECT_MD_REL);
}

export async function readProjectMd(root: string): Promise<string | null> {
  const path = projectMdPath(root);
  return (await fs.pathExists(path)) ? fs.readFile(path, 'utf-8') : null;
}

function renderContributions(novel: [string, string][]): string {
  const groups = new Map<string, { text: string; files: string[] }>();
  for (const [file, text] of novel) {
    const key = fold(text);
    const group = groups.get(key);
    if (group) group.files.push(file);
    else groups.set(key, { text: text.trim(), files: [file] });
  }
  if (groups.size === 1) return [...groups.values()][0].text;
  return [...groups.values()]
    .map((g) => `## De ${g.files.join(', ')}\n\n${g.text}`)
    .join('\n\n');
}

function toBlocks(text: string): string[] {
  return fold(text)
    .split(/\n[ \t]*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export function containsBlocks(existing: string | null, text: string): boolean {
  const wanted = toBlocks(text);
  if (!wanted.length) return true;
  const have = existing ? toBlocks(existing) : [];
  for (let start = 0; start + wanted.length <= have.length; start++) {
    if (wanted.every((block, offset) => have[start + offset] === block)) return true;
  }
  return false;
}

export function novelContributions(
  existing: string | null,
  contributions: Map<string, string>,
): [string, string][] {
  return [...contributions].filter(
    ([, text]) => fold(text) !== '' && !containsBlocks(existing, text),
  );
}

export async function mergeIntoProjectMd(
  root: string,
  contributions: Map<string, string>,
): Promise<number> {
  const existing = await readProjectMd(root);
  const novel = novelContributions(existing, contributions);
  if (!novel.length) return 0;
  const body = renderContributions(novel);
  const content =
    existing === null
      ? `${PROJECT_MD_HEADER}\n${body}\n`
      : `${existing.replace(/\s+$/, '')}\n\n${body}\n`;
  const path = projectMdPath(root);
  await fs.ensureDir(resolve(path, '..'));
  await fs.writeFile(path, content, 'utf-8');
  return Buffer.byteLength(body);
}

export type SplitHarnessContent = {
  head: string;
  absorbed: string;
};

export function splitAbsorbed(content: string): SplitHarnessContent | null {
  const idx = content.indexOf(ABSORBED_HEADING);
  if (idx === -1) return null;
  const absorbed = content.slice(idx + ABSORBED_HEADING.length).trim();
  const head = content.slice(0, idx).replace(/(\r?\n){2}---(\r?\n){2}$/, '');
  return { head, absorbed };
}
