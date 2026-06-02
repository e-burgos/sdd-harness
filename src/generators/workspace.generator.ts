import { resolve } from "node:path";
import fs from "fs-extra";
import { writeRenderedTemplate } from "../utils/fs.js";
import { exec } from "../utils/exec.js";
import { logger } from "../utils/logger.js";
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
 * Fases:
 *  1. Bootstrap NX  — directorios + config files + pnpm install + nx reset
 *  2. Generación    — apps, libs, docker, SDD (sobre NX ya inicializado)
 *  3. Finalización  — git init + commit inicial
 */
export async function generateWorkspace(opts: WorkspaceOptions): Promise<void> {
  const root = resolve(process.cwd(), opts.projectName);

  if (await fs.pathExists(root)) {
    throw new Error(`El directorio "${opts.projectName}" ya existe.`);
  }

  const templateData = {
    project: {
      name: opts.projectName,
      description: opts.description,
      packageScope: opts.packageScope,
    },
    apps: opts.apps,
    services: opts.services,
    nx: {
      plugins: getNxPlugins(opts.apps),
      defaultProject: opts.apps[0]?.name ?? "app",
    },
  };

  // ─── FASE 1: Bootstrap NX ─────────────────────────────────────────────────

  logger.step("Creando estructura de directorios...");
  for (const dir of ["apps", "libs", "tools", "infra", "docs"]) {
    await fs.ensureDir(resolve(root, dir));
  }

  logger.step("Generando archivos de configuración Nx...");
  await writeRenderedTemplate(
    "workspace/package.json.ejs",
    resolve(root, "package.json"),
    templateData,
  );
  await writeRenderedTemplate(
    "workspace/nx.json.ejs",
    resolve(root, "nx.json"),
    templateData,
  );
  await writeRenderedTemplate(
    "workspace/pnpm-workspace.yaml.ejs",
    resolve(root, "pnpm-workspace.yaml"),
    templateData,
  );
  await writeRenderedTemplate(
    "workspace/tsconfig.base.json.ejs",
    resolve(root, "tsconfig.base.json"),
    templateData,
  );
  await writeRenderedTemplate(
    "workspace/.gitignore.ejs",
    resolve(root, ".gitignore"),
    templateData,
  );
  await writeRenderedTemplate(
    "workspace/eslint.config.mjs.ejs",
    resolve(root, "eslint.config.mjs"),
    templateData,
  );

  logger.step("Instalando dependencias Nx (pnpm install)...");
  exec("pnpm install", { cwd: root });

  logger.step("Inicializando Nx workspace (nx reset)...");
  exec("pnpm exec nx reset", { cwd: root, silent: true });

  // Cambiar al directorio del proyecto para que todos los comandos
  // y resoluciones de rutas relativas operen desde dentro del workspace.
  process.chdir(root);

  // ─── FASE 2: Generación selectiva ─────────────────────────────────────────

  if (opts.services.length > 0) {
    logger.step("Generando Docker Compose...");
    await generateDockerCompose(root, opts.services);
  }

  logger.step("Configurando SDD (Spec-Driven Development)...");
  await generateSDD(root, opts);

  for (const app of opts.apps) {
    logger.step(`Generando app: ${app.name} (${app.type})...`);
    await generateApp(root, app, opts.packageScope);
  }

  for (const lib of opts.libs) {
    logger.step(`Generando lib: ${lib.name} (${lib.type})...`);
    await generateLib(root, lib, opts.packageScope);
  }

  // Setup raíz de Gradle cuando hay apps Spring Boot
  const springBootApps = opts.apps.filter((a) => a.type === "springboot");
  if (springBootApps.length > 0) {
    logger.step("Configurando Gradle workspace para Spring Boot...");
    await setupGradleWorkspace(root, opts.projectName, springBootApps);
  }

  // ─── FASE 3: Finalización ──────────────────────────────────────────────────

  logger.step("Inicializando repositorio git...");
  exec("git init", { cwd: root, silent: true });
  exec("git add -A", { cwd: root, silent: true });
  exec(
    'git commit -m "chore: initial workspace setup via @e-burgos/sdd-harness"',
    { cwd: root, silent: true },
  );

  logger.success(`Workspace "${opts.projectName}" creado exitosamente.`);
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
        plugins.add("@nx/gradle");
        break;
      case "hono":
        plugins.add("@nx/node");
        break;
    }
  }

  return Array.from(plugins);
}

/**
 * Crea el settings.gradle raíz y ejecuta `gradle wrapper` para workspaces
 * que contienen apps Spring Boot. NX leerá los subproyectos desde Gradle y
 * el plugin @nx/gradle inferirá automáticamente todos los targets.
 */
async function setupGradleWorkspace(
  root: string,
  projectName: string,
  springBootApps: Array<{ name: string; type: string }>,
): Promise<void> {
  const includes = springBootApps
    .map((a) => `include(':apps:${a.name}')`)
    .join("\n");

  // settings.gradle — registra el plugin dev.nx.gradle.project-graph e
  // incluye cada subproyecto Spring Boot
  await fs.writeFile(
    resolve(root, "settings.gradle"),
    `pluginManagement {
    repositories {
        gradlePluginPortal()
    }
}

plugins {
    id 'dev.nx.gradle.project-graph' version '1.4.0'
}

rootProject.name = '${projectName}'

${includes}
`,
    "utf-8",
  );

  // gradle.properties — configuración global de JVM y Gradle daemon
  await fs.writeFile(
    resolve(root, "gradle.properties"),
    `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
org.gradle.parallel=true
org.gradle.caching=true
`,
    "utf-8",
  );

  // Generar Gradle wrapper (requiere Gradle instalado en el sistema)
  try {
    exec("gradle wrapper --gradle-version 8.14 --distribution-type bin", {
      cwd: root,
      silent: false,
    });
  } catch {
    logger.warn(
      "No se pudo generar el Gradle wrapper automáticamente. " +
        "Asegúrate de tener Gradle instalado y ejecuta `gradle wrapper` en la raíz del workspace.",
    );
  }
}
