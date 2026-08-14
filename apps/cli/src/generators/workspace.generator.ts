import { resolve } from "node:path";
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
import { generateDockerCompose } from "./docker.generator.js";
import { generateSDD } from "./sdd.generator.js";
import { generateApp } from "./app.generator.js";
import { generateLib } from "./lib.generator.js";

export interface WorkspaceOptions {
  projectName: string;
  description: string;
  packageScope: string;
  apps: Array<{ name: string; type: string }>;
  libs: Array<{ name: string; type: string }>;
  services: string[];
  frontendStack?: string;
  backendStack?: string;
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
 *  2. Generación    — docker, SDD, apps, libs (sobre NX ya inicializado)
 *  3. Finalización  — git init + commit inicial + sdd:validate
 */
export async function generateWorkspace(opts: WorkspaceOptions): Promise<void> {
  const root = resolve(process.cwd(), opts.projectName);

  if (await fs.pathExists(root)) {
    throw new Error(`El directorio "${opts.projectName}" ya existe.`);
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
  await fs.copy(resolve(nxWorkspaceDir, "gitignore"), resolve(root, ".gitignore"));
  await fs.copy(resolve(nxWorkspaceDir, "npmrc"), resolve(root, ".npmrc"));
  await copyTemplate("workspace/eslint.config.mjs", resolve(root, "eslint.config.mjs"));

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

  logger.step("Configuring SDD (Spec-Driven Development)...");
  await generateSDD(root, opts);

  for (const app of opts.apps) {
    logger.step(`Generating app: ${app.name} (${app.type})...`);
    await generateApp(root, app, opts.packageScope);
  }

  for (const lib of opts.libs) {
    logger.step(`Generating lib: ${lib.name} (${lib.type})...`);
    await generateLib(root, lib, opts.packageScope);
  }

  // ─── FASE 3: Finalización ──────────────────────────────────────────────────

  logger.step("Validating SDD registries (sdd:validate)...");
  try {
    exec("node sdd/scripts/validate-sdd.mjs", { cwd: root, silent: true });
    logger.success("sdd:validate OK");
  } catch {
    logger.warn(
      "sdd:validate reportó problemas. Correr `pnpm sdd:validate` en el workspace para ver el detalle.",
    );
  }

  logger.step("Initializing git repository...");
  initGitRepo(
    root,
    "chore: initial workspace setup via @e-burgos/sdd-harness",
  );

  logger.success(`Workspace "${opts.projectName}" created successfully.`);
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

  nxJson.plugins = getNxPlugins(opts.apps).map((plugin) => ({ plugin }));
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

function getNxPlugins(apps: Array<{ name: string; type: string }>): string[] {
  const plugins = new Set<string>();
  plugins.add("@nx/js");

  for (const app of apps) {
    switch (app.type) {
      case "nestjs":
        plugins.add("@nx/nest");
        plugins.add("@nx/node");
        break;
      case "react":
        plugins.add("@nx/react");
        plugins.add("@nx/vite");
        break;
      case "nextjs":
        plugins.add("@nx/next");
        plugins.add("@nx/react");
        break;
      case "fastify":
        plugins.add("@nx/node");
        break;
      case "python":
        // No nx plugin nativo, se maneja manual
        break;
      case "springboot":
        // Integra Maven vía nx:run-commands (blueprint java-api): sin plugin
        break;
      case "hono":
        plugins.add("@nx/node");
        break;
    }
  }

  return Array.from(plugins);
}


