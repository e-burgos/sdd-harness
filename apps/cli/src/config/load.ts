import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'fs-extra';
import { HarnessConfigSchema } from './schema.js';
import type { HarnessConfig } from '../types/config.types.js';
import type { WorkspaceOptions } from '../generators/workspace.generator.js';
import type { StandaloneOptions } from '../generators/standalone.generator.js';

/**
 * Carga y valida un archivo de configuración de harness para `init --config`,
 * la vía no interactiva pensada para agentes AI y CI: los prompts de @clack no
 * son respondibles por un agente, un archivo validado por schema sí.
 * Formatos: .json, o .mjs/.js con la config como export default (defineConfig).
 */
export async function loadHarnessConfig(path: string): Promise<HarnessConfig> {
  const abs = resolve(process.cwd(), path);
  if (!(await fs.pathExists(abs))) {
    throw new Error(`Config file not found: ${abs}`);
  }

  const ext = extname(abs);
  let raw: unknown;
  if (ext === '.json') {
    raw = await fs.readJSON(abs);
  } else if (ext === '.mjs' || ext === '.js') {
    const mod = await import(pathToFileURL(abs).href);
    raw = mod.default ?? mod.config;
    if (!raw) {
      throw new Error(
        `Config module ${path} must have a default export (use defineConfig from @e-burgos/sdd-harness).`,
      );
    }
  } else {
    throw new Error(
      `Unsupported config format "${ext}" — use .json, .mjs or .js (for TypeScript, compile first or export the object from a .mjs).`,
    );
  }

  const parsed = HarnessConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid harness config ${path}:\n${details}`);
  }
  return parsed.data;
}

export function toWorkspaceOptions(config: HarnessConfig): WorkspaceOptions {
  return {
    projectName: config.project.name,
    description: config.project.description,
    packageScope: config.project.packageScope,
    apps: config.apps.map(({ name, type }) => ({ name, type })),
    libs: config.libs.map(({ name, type }) => ({ name, type })),
    services: config.services.map(({ type }) => type),
  };
}

export function toStandaloneOptions(config: HarnessConfig): StandaloneOptions {
  if (config.apps.length !== 1) {
    throw new Error(
      `Standalone mode requires exactly one app in "apps" (got ${config.apps.length}).`,
    );
  }
  return {
    projectName: config.project.name,
    description: config.project.description,
    appType: config.apps[0].type,
    services: config.services.map(({ type }) => type),
  };
}
