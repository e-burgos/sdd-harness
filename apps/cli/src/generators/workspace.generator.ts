import { basename, resolve } from "node:path";
import fs from "fs-extra";
import { copyTemplate, getTemplatesDir } from "../utils/fs.js";
import { exec } from "../utils/exec.js";
import { initGitRepo } from "../utils/git.js";
import { logger } from "../utils/logger.js";
import { NX_VERSION } from "./versions.js";
import {
  addAppScriptsToRootPkg,
  addAppTypeDepsToRootPkg,
  sortKeys,
} from "./root-package.js";
import { generateDockerCompose, writeEnvExample } from "./docker.generator.js";
import { generateSDD } from "./sdd.generator.js";
import type { SddProfile } from "./sdd.generator.js";
import {
  generateApp,
  nxWebpackPluginEntry,
  portEnvVar,
  resolveAppPort,
  type AppSpec,
} from "./app.generator.js";
import { generateLib } from "./lib.generator.js";
import { seedModules } from "./spec.generator.js";
import type { ModuleSeed, NpmScope } from "../types/config.types.js";

export interface WorkspaceOptions {
  projectName: string;
  description: string;
  packageScope: string;
  apps: AppSpec[];
  libs: Array<{ name: string; type: string }>;
  services: string[];
  frontendStack?: string;
  backendStack?: string;
  /** Scopes npm privados → `.npmrc` (`@org:registry=…`). Solo URLs, nunca credenciales. */
  npmScopes?: NpmScope[];
  /** GitHub user que firma las specs sembradas desde `sdd.modules`. */
  sddAuthor?: string;
  /** Perfil de trabajo → `sdd/global.json.profile`: team (ciclos full) | solo (ciclos lite). Ausente = team. */
  sddProfile?: SddProfile;
  /** Backlog inicial: una spec `draft` + entrada en pending_modules por módulo. */
  modules?: ModuleSeed[];
  /**
   * Directorio destino absoluto. Default: `<cwd>/<projectName>`. Igual al cwd cuando
   * `init --here`, cuando el config ya vive en el cwd o cuando `basename(cwd) == projectName`
   * (el caso real: `git init` hecho a mano y `harness idea` corrido en el mismo directorio).
   */
  targetDir?: string;
  /** Archivos de `harness idea` (harness.idea.md, harness.config.json, su schema) a conservar dentro del workspace. */
  harnessFiles?: string[];
  /** Omite el gate de FASE 3 (sdd:validate + nx run-many -t lint test build). */
  skipVerify?: boolean;
}

/**
 * Entradas que pueden preexistir en un directorio destino sin que sea "otro proyecto":
 * el repo git, los archivos de `harness idea`, y lo que un `git init` + README suelen dejar.
 */
const TOLERATED_ENTRIES = new Set([
  ".git",
  ".gitignore",
  ".gitattributes",
  ".DS_Store",
  "README.md",
  "LICENSE",
  "harness.idea.md",
  "harness.config.json",
  "harness.config.schema.json",
  "harness.config.mjs",
  "harness.config.js",
  ".vscode",
  ".idea",
  ".editorconfig",
  ".npmrc",
]);

/**
 * Resuelve el directorio destino y valida que se pueda generar ahí. Un destino no vacío
 * solo se acepta si todo lo que contiene es tolerable (ver TOLERATED_ENTRIES): generar
 * sobre un `package.json`/`apps/`/`sdd/` ajeno pisaría trabajo de alguien.
 */
export async function resolveTargetDir(
  opts: Pick<WorkspaceOptions, "projectName" | "targetDir">,
): Promise<string> {
  const root = opts.targetDir
    ? resolve(opts.targetDir)
    : resolve(process.cwd(), opts.projectName);

  if (!(await fs.pathExists(root))) return root;

  const entries = await fs.readdir(root);
  const conflicts = entries.filter((e) => !TOLERATED_ENTRIES.has(e));
  if (conflicts.length > 0) {
    const hint = opts.targetDir
      ? `Generating in place needs an empty directory (git repo, README and harness.* files are fine). Found: ${conflicts.slice(0, 6).join(", ")}${conflicts.length > 6 ? ", …" : ""}.`
      : `El directorio "${opts.projectName}" ya existe.`;
    throw new Error(hint);
  }
  return root;
}

/**
 * Genera un workspace Nx completo desde cero.
 *
 * La config raíz sale de templates/sdd/templates/nx-workspace/ (la misma
 * fuente portable que la skill init-nx-workspace documenta) y se ajusta
 * programáticamente según las apps/libs elegidas.
 *
 * Fases:
 *  1. Bootstrap NX  — directorios + config files + pnpm install + nx reset
 *  2. Generación    — docker, SDD, apps, libs, specs sembradas (sobre NX ya inicializado)
 *  3. Finalización  — gate (sdd:validate + lint/test/build) + git commit
 */
export async function generateWorkspace(opts: WorkspaceOptions): Promise<void> {
  const root = await resolveTargetDir(opts);
  const inPlace = root === resolve(process.cwd());
  if (inPlace) {
    logger.info(
      `Generating in the current directory (${basename(root)}/) — it already holds this project.`,
    );
  }

  const nxWorkspaceDir = resolve(getTemplatesDir(), "sdd/templates/nx-workspace");

  // ─── FASE 1: Bootstrap NX ─────────────────────────────────────────────────

  logger.step("Creating directory structure...");
  for (const dir of ["apps", "libs", "tools"]) {
    await fs.ensureDir(resolve(root, dir));
    await fs.writeFile(resolve(root, dir, ".gitkeep"), "", "utf-8");
  }

  logger.step("Generating Nx configuration files...");
  await writeRootPackageJson(root, nxWorkspaceDir, opts);
  await writeNxJson(root, nxWorkspaceDir, opts);
  await writeTsconfigBase(root, nxWorkspaceDir, opts);
  await fs.copy(
    resolve(nxWorkspaceDir, "pnpm-workspace.yaml"),
    resolve(root, "pnpm-workspace.yaml"),
  );
  await mergeGitignore(root, resolve(nxWorkspaceDir, "gitignore"));
  await writeNpmrc(root, nxWorkspaceDir, opts.npmScopes ?? []);
  await copyTemplate("workspace/eslint.config.mjs", resolve(root, "eslint.config.mjs"));
  await copyHarnessFiles(root, opts.harnessFiles ?? []);

  logger.step("Installing Nx dependencies (pnpm install)...");
  exec("pnpm install", { cwd: root });

  logger.step("Initializing Nx workspace (nx reset)...");
  exec("pnpm exec nx reset", { cwd: root, silent: true });

  // Cambiar al directorio del proyecto para que todos los comandos
  // y resoluciones de rutas relativas operen desde dentro del workspace.
  process.chdir(root);

  // ─── FASE 2: Generación selectiva ─────────────────────────────────────────

  if (opts.services.length > 0) {
    logger.step("Generating Docker Compose...");
    await generateDockerCompose(root, opts.services);
  }
  await writeEnvExample(root, opts.services, opts.apps);

  logger.step("Configuring SDD (Spec-Driven Development)...");
  await generateSDD(root, opts);

  for (const app of opts.apps) {
    logger.step(`Generating app: ${app.name} (${app.type}, port ${resolveAppPort(app)})...`);
    await generateApp(root, app, opts.packageScope);
  }

  for (const lib of opts.libs) {
    logger.step(`Generating lib: ${lib.name} (${lib.type})...`);
    await generateLib(root, lib, opts.packageScope);
  }

  if (opts.modules?.length) {
    logger.step(`Seeding ${opts.modules.length} module spec(s) from sdd.modules...`);
    const seeded = await seedModules(root, opts.modules, {
      author: opts.sddAuthor,
      defaultApp: `apps/${opts.apps[0].name}`,
    });
    for (const s of seeded) logger.success(`  ${s.specId} → draft, pending_modules`);
  }

  await writeReadme(root, opts);

  // ─── FASE 3: Finalización ──────────────────────────────────────────────────

  const gate = runVerificationGate(root, {
    nx: true,
    skip: opts.skipVerify ?? false,
  });

  logger.step(gate.ok ? "Committing the generated workspace..." : "Skipping the initial commit (gate is red)...");
  if (gate.ok) {
    initGitRepo(root, "chore: initial workspace setup via @e-burgos/sdd-harness");
  }

  if (!gate.ok) {
    throw new Error(
      `Workspace "${opts.projectName}" was generated but the verification gate is RED (${gate.failed.join(", ")}). Fix it, re-run the failing command inside the workspace and commit yourself.`,
    );
  }

  logger.success(`Workspace "${opts.projectName}" created successfully.`);
}

export interface GateResult {
  ok: boolean;
  skipped: boolean;
  passed: string[];
  failed: string[];
}

/**
 * Gate de FASE 3 del protocolo Hermes, ejecutado (no solo impreso): `sdd:validate` y, en
 * modo nx, `nx run-many -t lint test build`. `init` reportaba éxito corriendo solo el
 * validador, y la primera app NestJS real no compilaba ni testeaba.
 */
export function runVerificationGate(
  root: string,
  options: { nx: boolean; skip: boolean; scripts?: string[] },
): GateResult {
  const result: GateResult = { ok: true, skipped: options.skip, passed: [], failed: [] };
  const checks: Array<[string, string, boolean]> = [
    ["sdd:validate", "node sdd/scripts/validate-sdd.mjs", false],
  ];
  if (options.nx) {
    checks.push(["nx run-many -t lint test build", "pnpm exec nx run-many -t lint test build", false]);
  }
  for (const script of options.scripts ?? []) {
    checks.push([`pnpm ${script}`, `pnpm run ${script}`, false]);
  }

  logger.title("FASE 3 gate");
  if (options.skip) {
    for (const [label] of checks) logger.warn(`[ ] ${label} — skipped (--skip-verify)`);
    return result;
  }
  if (process.env["NX_WORKSPACE_ROOT_PATH"] && resolve(process.env["NX_WORKSPACE_ROOT_PATH"]) !== resolve(root)) {
    logger.warn(
      `NX_WORKSPACE_ROOT_PATH points elsewhere — nx results below would belong to ANOTHER workspace. Unset it and re-run the gate inside ${root}.`,
    );
  }

  for (const [label, command, silent] of checks) {
    try {
      exec(command, { cwd: root, silent });
      logger.success(`[x] ${label}`);
      result.passed.push(label);
    } catch {
      logger.error(`[ ] ${label} — FAILED`);
      result.failed.push(label);
      result.ok = false;
    }
  }
  return result;
}

/**
 * `.gitignore`: en un destino recién `git init`-eado puede existir uno; se mergea (líneas
 * faltantes al final) en vez de pisarlo.
 */
async function mergeGitignore(root: string, templatePath: string): Promise<void> {
  const dest = resolve(root, ".gitignore");
  const template = await fs.readFile(templatePath, "utf-8");
  if (!(await fs.pathExists(dest))) {
    await fs.writeFile(dest, template, "utf-8");
    return;
  }
  const current = await fs.readFile(dest, "utf-8");
  const have = new Set(current.split("\n").map((l) => l.trim()));
  const missing = template
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && !have.has(l.trim()));
  if (missing.length === 0) return;
  await fs.writeFile(
    dest,
    `${current.trimEnd()}\n\n# Added by @e-burgos/sdd-harness\n${missing.join("\n")}\n`,
    "utf-8",
  );
}

/**
 * `.npmrc` raíz: base portable del kit + un `@scope:registry=` por scope privado declarado en
 * `npm.scopes[]`. La credencial nunca va acá: vive en `~/.npmrc` local y en `NODE_AUTH_TOKEN`
 * en CI (`//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}` en el runner).
 */
export async function writeNpmrc(
  root: string,
  nxWorkspaceDir: string,
  scopes: NpmScope[],
): Promise<void> {
  let content = await fs.readFile(resolve(nxWorkspaceDir, "npmrc"), "utf-8");
  if (scopes.length > 0) {
    content = `${content.trimEnd()}\n\n${npmrcScopesBlock(scopes)}`;
  }
  await fs.writeFile(resolve(root, ".npmrc"), content, "utf-8");
}

export function npmrcScopesBlock(scopes: NpmScope[]): string {
  return [
    "# Private scopes (harness.config.json npm.scopes). Registry URLs only:",
    "# the credential lives in ~/.npmrc on each machine and in NODE_AUTH_TOKEN in CI,",
    "# never in this file.",
    ...scopes.map((s) => `${s.scope}:registry=${s.registry}`),
    "",
  ].join("\n");
}

/**
 * Los archivos de `harness idea` son la entrada del protocolo Hermes (idea, evidencia,
 * decisiones, config aprobada): si el workspace se generó en un subdirectorio, viajan con él.
 */
async function copyHarnessFiles(root: string, files: string[]): Promise<void> {
  for (const file of files) {
    const dest = resolve(root, basename(file));
    if (!(await fs.pathExists(file)) || resolve(file) === dest) continue;
    if (await fs.pathExists(dest)) continue;
    await fs.copy(file, dest);
    logger.info(`Kept ${basename(file)} inside the workspace`);
  }
}

/**
 * README raíz mínimo: nombre, descripción, apps con tipo/puerto/comando y punteros al SDD.
 * No pisa un README preexistente (repo `git init`-eado a mano).
 */
async function writeReadme(root: string, opts: WorkspaceOptions): Promise<void> {
  const dest = resolve(root, "README.md");
  if (await fs.pathExists(dest)) return;

  const appRows = opts.apps
    .map(
      (a) =>
        `| \`apps/${a.name}\` | ${a.type} | ${resolveAppPort(a)} (\`${portEnvVar(a.name)}\`) | \`pnpm ${a.name}\` |`,
    )
    .join("\n");
  const libRows = opts.libs.map((l) => `- \`libs/${l.name}\` — ${l.type}`).join("\n");
  const services = opts.services.length
    ? `\n## Services\n\n${opts.services.map((s) => `- ${s}`).join("\n")}\n\n\`docker compose up -d\` — variables en \`.env.example\`.\n`
    : "";

  await fs.writeFile(
    dest,
    `# ${opts.projectName}

${opts.description}

Nx monorepo generated by [@e-burgos/sdd-harness](https://github.com/e-burgos/sdd-harness) with the SDD (Spec-Driven Development) system installed in \`sdd/\`.

## Apps

| App | Type | Port (env override) | Serve |
| --- | --- | --- | --- |
${appRows}

Ports come from \`harness.config.json\` (\`apps[].port\`); the defaults are also listed in \`.env.example\`.
${libRows ? `\n## Libs\n\n${libRows}\n` : ""}${services}
## Development

\`\`\`bash
pnpm install
pnpm exec nx run-many -t lint test build   # FASE 3 gate — must be green
pnpm sdd:validate                           # SDD registries
pnpm sdd:docs                               # SDD viewer (specs, cycles, costs)
\`\`\`

## SDD

- Entry point for agents: \`AGENTS.md\` / \`CLAUDE.md\` / \`GEMINI.md\` (symlinks into \`sdd/dual-harness/\`).
- Idea, discovery evidence and decisions: \`harness.idea.md\`. Stack: \`harness.config.json\`.
- Backlog: \`sdd/global.json\` (\`pending_modules\`) and \`sdd/specs/index.json\` — specs start as \`draft\`.
`,
    "utf-8",
  );
}

/**
 * package.json raíz: base portable (nx-workspace/package.json) con nombre,
 * scripts por app y dependencias ajustadas al stack elegido. La base trae el
 * cluster React por defecto (es el stack de referencia del kit); acá se poda
 * o se expande según las apps reales.
 */
async function writeRootPackageJson(
  root: string,
  nxWorkspaceDir: string,
  opts: WorkspaceOptions,
): Promise<void> {
  const pkg = await fs.readJSON(resolve(nxWorkspaceDir, "package.json"));

  pkg.name = `${opts.packageScope}/source`;
  if (opts.description) pkg.description = opts.description;

  for (const app of opts.apps) {
    addAppScriptsToRootPkg(pkg, app.name);
  }

  // La CLI escribe su propio eslint.config.mjs (el kit no trae uno: asume
  // create-nx-workspace), así que lo que ese config importa va siempre:
  // @nx/eslint-plugin y typescript-eslint (requerido por flat/typescript).
  pkg.devDependencies["@nx/eslint-plugin"] = NX_VERSION;
  pkg.devDependencies["typescript-eslint"] = "^8.40.0";

  const has = (type: string) => opts.apps.some((a) => a.type === type);
  const hasReactFamily = has("react") || has("nextjs");
  const hasUiLib = opts.libs.some((l) => l.type === "ui-kit");

  if (!hasReactFamily && !hasUiLib) {
    for (const dep of ["react", "react-dom", "react-router-dom"]) {
      delete pkg.dependencies[dep];
    }
    for (const dep of [
      "@nx/react",
      "@nx/vite",
      "@vitejs/plugin-react",
      "@types/react",
      "@types/react-dom",
      "@tailwindcss/vite",
      "tailwindcss",
      "vite",
      "vitest",
      "@vitest/coverage-v8",
    ]) {
      delete pkg.devDependencies[dep];
    }
  }

  for (const type of new Set(opts.apps.map((a) => a.type))) {
    addAppTypeDepsToRootPkg(pkg, type);
  }

  pkg.dependencies = sortKeys(pkg.dependencies);
  pkg.devDependencies = sortKeys(pkg.devDependencies);

  await fs.writeJSON(resolve(root, "package.json"), pkg, { spaces: 2 });
}

async function writeNxJson(
  root: string,
  nxWorkspaceDir: string,
  opts: WorkspaceOptions,
): Promise<void> {
  const nxJson = await fs.readJSON(resolve(nxWorkspaceDir, "nx.json"));

  nxJson.plugins = getNxPlugins(opts.apps);
  if (opts.apps[0]) nxJson.defaultProject = opts.apps[0].name;

  await fs.writeJSON(resolve(root, "nx.json"), nxJson, { spaces: 2 });
}

/**
 * tsconfig.base.json portable (wiring legacy `paths`, el que asumen los
 * blueprints react-app y ts-lib). El path de ejemplo @shared-lib se reemplaza
 * por las libs reales; lib.generator agrega el suyo al crear cada lib.
 */
async function writeTsconfigBase(
  root: string,
  nxWorkspaceDir: string,
  opts: WorkspaceOptions,
): Promise<void> {
  const tsconfig = await fs.readJSON(resolve(nxWorkspaceDir, "tsconfig.base.json"));

  tsconfig.compilerOptions.paths = {};
  for (const lib of opts.libs) {
    tsconfig.compilerOptions.paths[`@${lib.name}`] = [
      `./libs/${lib.name}/src/index.ts`,
    ];
  }

  await fs.writeJSON(resolve(root, "tsconfig.base.json"), tsconfig, { spaces: 2 });
}

type NxPluginEntry = { plugin: string; options?: Record<string, string> };

function getNxPlugins(apps: AppSpec[]): NxPluginEntry[] {
  const plugins = new Map<string, NxPluginEntry>();
  const add = (entry: NxPluginEntry) => {
    if (!plugins.has(entry.plugin)) plugins.set(entry.plugin, entry);
  };
  add({ plugin: "@nx/js" });

  for (const app of apps) {
    switch (app.type) {
      case "nestjs":
        add({ plugin: "@nx/nest" });
        add({ plugin: "@nx/node" });
        // build inferido desde apps/<name>/webpack.config.js (ver app.generator)
        add(nxWebpackPluginEntry());
        break;
      case "react":
        add({ plugin: "@nx/react" });
        add({ plugin: "@nx/vite" });
        break;
      case "nextjs":
        add({ plugin: "@nx/next" });
        add({ plugin: "@nx/react" });
        break;
      case "fastify":
        add({ plugin: "@nx/node" });
        break;
      case "python":
        // No nx plugin nativo, se maneja manual
        break;
      case "springboot":
        // Integra Maven vía nx:run-commands (blueprint java-api): sin plugin
        break;
      case "hono":
        add({ plugin: "@nx/node" });
        break;
    }
  }

  return Array.from(plugins.values());
}
