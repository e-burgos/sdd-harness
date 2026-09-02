import { resolve } from 'node:path';
import fs from 'fs-extra';
import { exec } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import type { ModuleSeed } from '../types/config.types.js';

const SPEC_ID_RE = /^spec-[a-z0-9-]+-\d{3}-[a-z0-9-]+$/;

/** Forma de sdd/schemas/specs-index.schema.json → SpecEntry. */
interface SpecEntry {
  id: string;
  author: string;
  slug: string;
  folder: string;
  file: string;
  module: string;
  app: string;
  status: 'draft' | 'in-progress' | 'completed' | 'cancelled';
  title: string;
  created_at: string;
  completed_at: string | null;
  depends_on: string[];
}
const SUBPROJECT_RE = /^(apps|libs|tools)\/[a-z][a-z0-9-]*$/;

export interface CreateSpecOptions {
  slug: string;
  author: string;
  /** Default: the slug. */
  title?: string;
  /** Main subproject, e.g. apps/core-api. */
  app: string;
  /** Every subproject the module touches; `app` is always included. */
  apps?: string[];
  /** Spec ids, or slugs/modules of specs already in the index. */
  dependsOn?: string[];
  /** One-liner for the pending_modules entry. Default: the title. */
  description?: string;
}

export interface CreateSpecResult {
  specId: string;
  folder: string;
  file: string;
  module: string;
  apps: string[];
  dependsOn: string[];
}

/**
 * Crea una spec v2.0 (spec-[author]-[NNN]-[slug]) y la deja registrada en los DOS
 * registros que el ciclo SDD lee: `sdd/specs/index.json` (status `draft`, con
 * `depends_on`) y `pending_modules` de `sdd/global.json` (ModuleEntry). Hasta v0.10
 * el módulo había que escribirlo a mano y el orquestador no encontraba nada que
 * arrancar. Única implementación para `harness add spec` y para el sembrado de
 * `sdd.modules` en `init --config`.
 */
export async function createSpec(
  root: string,
  opts: CreateSpecOptions,
): Promise<CreateSpecResult> {
  const indexPath = resolve(root, 'sdd/specs/index.json');
  const globalPath = resolve(root, 'sdd/global.json');
  if (!(await fs.pathExists(indexPath))) {
    throw new Error(
      'No sdd/specs/index.json found. Make sure SDD is configured in this workspace.',
    );
  }

  for (const value of [opts.slug]) {
    if (!/^[a-z0-9-]+$/.test(value)) {
      throw new Error(`Spec slug must be lowercase kebab-case — got "${value}".`);
    }
  }
  if (!/^[a-z0-9-]+$/.test(opts.author)) {
    throw new Error(
      `Author must be a lowercase GitHub username — got "${opts.author}".`,
    );
  }
  const apps = [...new Set([opts.app, ...(opts.apps ?? [])])];
  for (const app of apps) {
    if (!SUBPROJECT_RE.test(app)) {
      throw new Error(`Subproject must match (apps|libs|tools)/[name] — got "${app}".`);
    }
  }

  const index = await fs.readJSON(indexPath);
  const specs = index.specs as SpecEntry[];
  const dependsOn = resolveDependencies(specs, opts.dependsOn ?? []);

  const authorSpecs = specs.filter((s) => s.author === opts.author);
  const nnn = String(authorSpecs.length + 1).padStart(3, '0');
  const specId = `spec-${opts.author}-${nnn}-${opts.slug}`;
  const folder = `sdd/specs/${specId}`;
  const file = `${folder}/${specId}.spec.md`;
  const specFolder = resolve(root, folder);

  if (await fs.pathExists(specFolder)) {
    throw new Error(`Spec folder already exists: ${folder}`);
  }

  const title = opts.title?.trim() || opts.slug;

  await fs.ensureDir(resolve(specFolder, 'cycles'));
  await fs.ensureDir(resolve(specFolder, 'fixes'));
  await fs.writeFile(resolve(specFolder, 'cycles/.gitkeep'), '', 'utf-8');
  await fs.writeFile(resolve(specFolder, 'fixes/.gitkeep'), '', 'utf-8');
  await fs.writeFile(
    resolve(root, file),
    specTemplate(opts.author, nnn, title, apps, dependsOn),
    'utf-8',
  );

  const today = new Date().toISOString().slice(0, 10);
  // Shape: sdd/schemas/specs-index.schema.json (additionalProperties: false).
  specs.push({
    id: specId,
    author: opts.author,
    slug: opts.slug,
    folder,
    file,
    module: opts.slug,
    app: opts.app,
    status: 'draft',
    title,
    created_at: today,
    completed_at: null,
    depends_on: dependsOn,
  });
  await fs.writeJSON(indexPath, index, { spaces: 2 });

  if (await fs.pathExists(globalPath)) {
    const globalJson = await fs.readJSON(globalPath);
    globalJson.pending_modules ??= [];
    const known = ['pending_modules', 'in_progress_modules', 'completed_modules'].some(
      (bucket) =>
        (globalJson[bucket] ?? []).some(
          (m: { spec: string }) => m.spec === specId,
        ),
    );
    if (!known) {
      // Shape: ModuleEntry in sdd/schemas/global.schema.json.
      globalJson.pending_modules.push({
        module: opts.slug,
        spec: specId,
        apps,
        cycles_completed: 0,
        description: opts.description?.trim() || title,
      });
      await fs.writeJSON(globalPath, globalJson, { spaces: 2 });
    }
  }

  return { specId, folder, file, module: opts.slug, apps, dependsOn };
}

/**
 * Siembra el backlog inicial declarado en `sdd.modules` del config: una spec `draft`
 * por módulo, en el orden dado, resolviendo `depends_on` por slug contra las specs
 * ya sembradas (o ya presentes en el índice).
 */
export async function seedModules(
  root: string,
  modules: ModuleSeed[],
  options: { author?: string; defaultApp: string },
): Promise<CreateSpecResult[]> {
  if (modules.length === 0) return [];
  const author = options.author || detectGitHubUser() || 'dev';
  if (!options.author) {
    logger.warn(
      `sdd.author not set in the config — seeding specs as "${author}" (git config user.name). Set sdd.author to your GitHub user.`,
    );
  }

  const results: CreateSpecResult[] = [];
  for (const m of modules) {
    const app = m.app ?? m.apps?.[0] ?? options.defaultApp;
    results.push(
      await createSpec(root, {
        slug: m.name,
        author,
        title: m.title,
        description: m.description,
        app,
        apps: m.apps,
        dependsOn: m.depends_on,
      }),
    );
  }
  return results;
}

export function detectGitHubUser(): string {
  try {
    const user = exec('git config user.name', { silent: true }) ?? '';
    return user
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '');
  } catch {
    return '';
  }
}

function resolveDependencies(specs: SpecEntry[], refs: string[]): string[] {
  const out: string[] = [];
  for (const ref of refs) {
    const trimmed = ref.trim();
    if (!trimmed) continue;
    if (SPEC_ID_RE.test(trimmed)) {
      if (!specs.some((s) => s.id === trimmed)) {
        throw new Error(
          `--depends-on: spec "${trimmed}" is not registered in sdd/specs/index.json.`,
        );
      }
      out.push(trimmed);
      continue;
    }
    const match = specs.find((s) => s.slug === trimmed || s.module === trimmed);
    if (!match) {
      throw new Error(
        `--depends-on: no spec with slug/module "${trimmed}" in sdd/specs/index.json (create it first — dependencies are resolved in order).`,
      );
    }
    out.push(match.id);
  }
  return [...new Set(out)];
}

function specTemplate(
  author: string,
  nnn: string,
  title: string,
  apps: string[],
  dependsOn: string[],
): string {
  const deps = dependsOn.length
    ? dependsOn.map((d) => `- \`${d}\``).join('\n')
    : '- [Módulos previos completados y APIs externas requeridas.]';
  return `# SPEC-${author}-${nnn}: ${title}

> Estado: **draft** — el sdd-orchestrator la pasa a \`in-progress\` al abrir \`cycle-01\`.

## Resumen Ejecutivo

[Qué se construye, por qué y para quién.]

## Contexto de Negocio

[Problema que resuelve, usuarios afectados, impacto esperado.]

## Evidencia y decisiones

> Citar, no copiar: las filas de \`harness.idea.md\` → **Evidencia del descubrimiento** y
> **Decisiones del dev** que fundamentan esta spec (por fuente y fecha).

- [Evidencia: fuente → dato medido (fecha)]
- [Decisión del dev que acota el alcance (fecha)]

## Requisitos Funcionales (RF)

- RF-1: [Descripción]
- RF-2: [Descripción]

## Requisitos No-Funcionales (RNF)

- RNF-1: [Performance, seguridad, cobertura mínima, etc.]

## Dependencias

- Subproyectos: ${apps.map((a) => `\`${a}\``).join(', ')}
${deps}

## Criterios de Aceptación

- CA-001: [Condición verificable para considerar implementada la spec.]
`;
}
