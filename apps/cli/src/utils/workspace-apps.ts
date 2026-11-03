import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppSpec } from '../generators/app.generator.js';
import { assignDetectedShells, detectAppType } from '../commands/configure/sdd-apps.js';

const REGISTRY_ENTRY = /—\s*([a-z][a-z0-9-]*)(?:\s*\(shell:\s*([a-z][a-z0-9-]*)\))?/;
const VITE_SERVER_PORT = /server:\s*\{\s*port:\s*Number\([^)]*\?\?\s*(\d+)\s*\)/;
const SOURCE_PORT_FALLBACK = /process\.env\['PORT'\]\s*\?\?\s*(\d+)/;
const PROJECT_JSON_PORT = /"port":\s*(\d+)/;

function readText(file: string): string | undefined {
  try {
    return readFileSync(file, 'utf-8');
  } catch {
    return undefined;
  }
}

function firstMatch(pattern: RegExp, files: string[]): number | undefined {
  for (const file of files) {
    const match = pattern.exec(readText(file) ?? '');
    if (match) return Number(match[1]);
  }
  return undefined;
}

export function readAppPortFromDisk(appDir: string): number | undefined {
  return (
    firstMatch(VITE_SERVER_PORT, [resolve(appDir, 'vite.config.ts')]) ??
    firstMatch(SOURCE_PORT_FALLBACK, [resolve(appDir, 'src/main.ts'), resolve(appDir, 'src/index.ts')]) ??
    firstMatch(PROJECT_JSON_PORT, [resolve(appDir, 'project.json')])
  );
}

export function readRegisteredApps(root: string): AppSpec[] {
  const globalPath = resolve(root, 'sdd/global.json');
  if (!existsSync(globalPath)) return [];
  try {
    const global = JSON.parse(readFileSync(globalPath, 'utf-8'));
    const registered: Record<string, unknown> = global?.monorepo?.apps ?? {};
    const apps = Object.entries(registered).flatMap(([name, description]): AppSpec[] => {
      const appDir = resolve(root, 'apps', name);
      const match = typeof description === 'string' ? REGISTRY_ENTRY.exec(description) : null;
      const type = match?.[1] ?? (existsSync(appDir) ? detectAppType(appDir) : 'app');
      if (type === 'app') return [];
      const shell = match?.[2];
      const port = readAppPortFromDisk(appDir);
      return [{ name, type, ...(shell ? { shell } : {}), ...(port ? { port } : {}) }];
    });
    return assignDetectedShells(root, apps);
  } catch {
    return [];
  }
}
