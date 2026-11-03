import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppSpec } from '../generators/app.generator.js';

const REGISTRY_ENTRY = /—\s*([a-z][a-z0-9-]*)(?:\s*\(shell:\s*([a-z][a-z0-9-]*)\))?/;

export function readRegisteredApps(root: string): AppSpec[] {
  const globalPath = resolve(root, 'sdd/global.json');
  if (!existsSync(globalPath)) return [];
  try {
    const global = JSON.parse(readFileSync(globalPath, 'utf-8'));
    const registered: Record<string, unknown> = global?.monorepo?.apps ?? {};
    return Object.entries(registered).flatMap(([name, description]) => {
      const match = typeof description === 'string' ? REGISTRY_ENTRY.exec(description) : null;
      if (!match) return [];
      const [, type, shell] = match;
      return [{ name, type, ...(shell ? { shell } : {}) }];
    });
  } catch {
    return [];
  }
}
