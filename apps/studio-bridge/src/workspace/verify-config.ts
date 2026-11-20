import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MAX_VERIFY_APPS, type VerifyConfigEntry, type VerifyLevel } from '@sdd-studio/protocol';

const LEVELS: VerifyLevel[] = ['quick', 'full'];
const APP_KEY = /^\S{1,120}$/;

const hasCommands = (value: unknown): boolean =>
  Array.isArray(value) && value.some((command) => typeof command === 'string' && command.length > 0);

export async function readVerifyConfig(root: string): Promise<VerifyConfigEntry[]> {
  let doc: unknown;
  try {
    doc = JSON.parse(await readFile(path.join(root, 'sdd', 'verify.json'), 'utf8'));
  } catch {
    return [];
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return [];
  const entries: VerifyConfigEntry[] = [];
  for (const [app, config] of Object.entries(doc as Record<string, unknown>)) {
    if (app.startsWith('$') || app.startsWith('_') || !APP_KEY.test(app)) continue;
    if (!config || typeof config !== 'object') continue;
    const levels = LEVELS.filter((level) => hasCommands((config as Record<string, unknown>)[level]));
    if (levels.length > 0) entries.push({ app, levels });
  }
  return entries.slice(0, MAX_VERIFY_APPS);
}
