import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { basename, dirname, resolve } from "node:path";
import fs from "fs-extra";
import { logger } from "../utils/logger.js";
import { warnIfNxRootMismatch } from "../utils/env.js";
import { generateWorkspace, generateStandalone } from "../generators/index.js";
import {
  loadHarnessConfig,
  toStandaloneOptions,
  toWorkspaceOptions,
} from "../config/load.js";
import { IDEA_FILENAME } from "../generators/idea.generator.js";
import { parseProfile } from "../generators/sdd.generator.js";
import type { SddProfile } from "../generators/sdd.generator.js";
import { CONFIG_SCHEMA_FILENAME } from "../config/json-schema.js";

/** Flags de destino compartidos por las tres vías de init. */
interface TargetFlags {
  here: boolean;
  profile?: SddProfile;
  dir?: string;
  skipVerify: boolean;
}

/**
 * Dónde generar. En el cwd cuando: `--here` / `--dir .`, el config indicado vive en el cwd, o
 * `basename(cwd) == project.name` — el caso real es un directorio ya `git init`-eado con los
 * archivos de `harness idea` adentro, donde anidar `<name>/<name>/` obligaba a aplanar a mano.
 */
export function resolveInitTarget(
  cwd: string,
  projectName: string,
  flags: TargetFlags,
  configPath?: string,
): { targetDir: string; inPlace: boolean } {
  if (flags.dir && flags.dir !== ".") {
    const targetDir = resolve(cwd, flags.dir);
    return { targetDir, inPlace: targetDir === cwd };
  }
  const configInCwd = configPath ? dirname(resolve(cwd, configPath)) === cwd : false;
  const inPlace =
    flags.here || flags.dir === "." || configInCwd || basename(cwd) === projectName;
  return { targetDir: inPlace ? cwd : resolve(cwd, projectName), inPlace };
}

/** Archivos de `harness idea` junto al config: viajan al workspace si este se genera en otro directorio. */
function harnessFilesNextTo(configPath: string | undefined, cwd: string): string[] {
  const dir = configPath ? dirname(resolve(cwd, configPath)) : cwd;
  const candidates = [
    IDEA_FILENAME,
    CONFIG_SCHEMA_FILENAME,
    ...(configPath ? [resolve(cwd, configPath)] : []),
  ].map((f) => resolve(dir, f));
  return candidates.filter((f) => fs.existsSync(f));
}

const APP_TYPE_OPTIONS = [
  {
    value: "nestjs",
    label: "NestJS API",
    hint: "Backend REST/WebSocket API",
  },
  { value: "react", label: "React SPA", hint: "Vite + React 19" },
  {
    value: "nextjs",
    label: "Next.js",
    hint: "Full-stack React framework",
  },
  {
    value: "python",
    label: "Python Agent",
    hint: "Python 3.11+ service",
  },
  {
    value: "fastify",
    label: "Fastify API",
    hint: "Lightweight Node.js API",
  },
  {
    value: "springboot",
    label: "Spring Boot 3",
    hint: "Java 21 REST API hexagonal (Maven)",
  },
  {
    value: "hono",
    label: "Hono API",
    hint: "Ultra-fast Node.js API",
  },
];

const SERVICE_OPTIONS = [
  { value: "postgres", label: "PostgreSQL", hint: "Relational DB" },
  { value: "redis", label: "Redis", hint: "Cache & queues" },
  { value: "rabbitmq", label: "RabbitMQ", hint: "Message broker" },
  { value: "minio", label: "MinIO", hint: "S3-compatible storage" },
];

const DEFAULT_APP_NAMES: Record<string, string> = {
  nestjs: "api",
  react: "webapp",
  nextjs: "web",
  fastify: "api",
  springboot: "service",
  hono: "api",
};

/** Closing pointer shown by every init path: real generated repos to compare against. */
function outroReady(message: string): void {
  p.note(
    `Browsable examples of every mode, regenerated from npm on each release:\nhttps://github.com/e-burgos/sdd-harness-examples`,
    'See more examples',
  );
  p.outro(pc.green(message));
}

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description:
      "Initialize an AI-agent-ready repo with SDD (Nx monorepo or standalone app)",
  },
  args: {
    name: {
      type: "string",
      description: "Project name",
    },
    mode: {
      type: "string",
      description: "Workspace mode: nx | standalone",
    },
    standalone: {
      type: "boolean",
      description: "Shortcut for --mode standalone",
      default: false,
    },
    config: {
      type: "string",
      description:
        "Path to a harness config file (.json | .mjs | .js) — fully non-interactive init for AI agents and CI",
    },
    yes: {
      type: "boolean",
      alias: "y",
      description: "Skip confirmation prompts",
      default: false,
    },
    here: {
      type: "boolean",
      description:
        "Generate in the current directory instead of <name>/ (implied when the config lives here or the directory is already named <name>)",
      default: false,
    },
    dir: {
      type: "string",
      description: "Target directory (\".\" = here). Default: ./<name>",
    },
    skipVerify: {
      type: "boolean",
      description:
        "Skip the FASE 3 gate (sdd:validate + nx run-many -t lint test build) that init runs and fails on",
      default: false,
    },
    profile: {
      type: "string",
      description:
        "Working profile written to sdd/global.json: team (full cycles, default) | solo (lite cycles, single actor). With --config, sdd.profile wins when set",
    },
  },
  async run({ args }) {
    warnIfNxRootMismatch();
    p.intro(pc.bgCyan(pc.black(" harness init ")));

    let profile: SddProfile | undefined;
    try {
      profile = parseProfile(args.profile);
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    const target: TargetFlags = {
      here: args.here,
      dir: args.dir,
      skipVerify: args.skipVerify,
      profile,
    };

    if (args.config) {
      await runConfigFlow(args.config, target);
      return;
    }

    // Step 1: Project name
    const projectName =
      args.name ??
      (await p.text({
        message: "Project name:",
        placeholder: "my-project",
        validate: (value) => {
          if (!value) return "Project name is required";
          if (!/^[a-z][a-z0-9-]*$/.test(value))
            return "Must be lowercase kebab-case";
          return undefined;
        },
      }));

    if (p.isCancel(projectName)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    // Step 2: Description
    const description = await p.text({
      message: "Project description:",
      placeholder: "A brief description of your project",
    });

    if (p.isCancel(description)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    // Step 3: Mode
    let mode = args.standalone ? "standalone" : args.mode;
    if (mode !== "nx" && mode !== "standalone") {
      const selected = await p.select({
        message: "What do you want to generate?",
        options: [
          {
            value: "nx",
            label: "Nx monorepo",
            hint: "apps/ + libs/ + tools/ — multiple apps and shared libraries",
          },
          {
            value: "standalone",
            label: "Standalone app",
            hint: "ONE app with its code at the repo root — no Nx",
          },
        ],
      });
      if (p.isCancel(selected)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }
      mode = selected as string;
    }

    if (mode === "standalone") {
      await runStandaloneFlow(
        projectName as string,
        (description as string) || "",
        args.yes,
        target,
      );
    } else {
      await runNxFlow(
        projectName as string,
        (description as string) || "",
        args.yes,
        target,
      );
    }
  },
});

// ─── Config-driven flow (non-interactive, for AI agents and CI) ───────────────

async function runConfigFlow(
  configPath: string,
  flags: TargetFlags,
): Promise<void> {
  let config;
  try {
    config = await loadHarnessConfig(configPath);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  const cwd = process.cwd();
  const { targetDir, inPlace } = resolveInitTarget(
    cwd,
    config.project.name,
    flags,
    configPath,
  );
  const modules = config.sdd?.modules ?? [];

  p.note(
    [
      `${pc.bold("Project:")} ${config.project.name}`,
      `${pc.bold("Mode:")} ${config.mode}`,
      `${pc.bold("Target:")} ${inPlace ? `${targetDir} (current directory)` : targetDir}`,
      `${pc.bold("Apps:")} ${config.apps.map((a) => `${a.name} (${a.type}${a.port ? `:${a.port}` : ""})`).join(", ")}`,
      `${pc.bold("Libs:")} ${config.libs.map((l) => l.name).join(", ") || "none"}`,
      `${pc.bold("Services:")} ${config.services.map((s) => s.type).join(", ") || "none"}`,
      `${pc.bold("Modules:")} ${modules.length ? `${modules.length} spec(s) seeded as draft` : "none (use harness add spec)"}`,
      `${pc.bold("npm scopes:")} ${config.npm?.scopes.map((s) => s.scope).join(", ") || "none"}`,
      `${pc.bold("SDD:")} enabled (always)`,
      `${pc.bold("Gate:")} ${flags.skipVerify ? "skipped (--skip-verify)" : "sdd:validate + lint/test/build"}`,
    ].join("\n"),
    `Configuration from ${configPath}`,
  );

  logger.title(
    config.mode === "standalone"
      ? "Generating standalone repo..."
      : "Generating workspace...",
  );

  const harnessFiles = harnessFilesNextTo(configPath, cwd);
  try {
    if (config.mode === "standalone") {
      await generateStandalone({
        ...toStandaloneOptions(config),
        sddProfile: config.sdd?.profile ?? flags.profile,
        targetDir,
        harnessFiles,
        skipVerify: flags.skipVerify,
      });
    } else {
      await generateWorkspace({
        ...toWorkspaceOptions(config),
        sddProfile: config.sdd?.profile ?? flags.profile,
        targetDir,
        harnessFiles,
        skipVerify: flags.skipVerify,
      });
    }
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  outroReady("Done! Your workspace is ready.");
}

// ─── Standalone flow ──────────────────────────────────────────────────────────

async function runStandaloneFlow(
  projectName: string,
  description: string,
  skipConfirm: boolean,
  flags: TargetFlags,
): Promise<void> {
  const appType = await p.select({
    message: "App type (code lives at the repo root):",
    options: APP_TYPE_OPTIONS,
  });

  if (p.isCancel(appType)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const services = await p.multiselect({
    message: "Which Docker services do you need?",
    options: SERVICE_OPTIONS,
    required: false,
  });

  if (p.isCancel(services)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  p.note(
    [
      `${pc.bold("Project:")} ${projectName}`,
      `${pc.bold("Mode:")} standalone (app at repo root, no Nx)`,
      `${pc.bold("App type:")} ${appType as string}`,
      `${pc.bold("Services:")} ${(services as string[]).join(", ") || "none"}`,
      `${pc.bold("SDD:")} enabled (always)`,
    ].join("\n"),
    "Configuration Summary",
  );

  const confirmed =
    skipConfirm ||
    (await p.confirm({
      message: "Proceed with this configuration?",
      initialValue: true,
    }));

  if (!confirmed || p.isCancel(confirmed)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  logger.title("Generating standalone repo...");

  try {
    await generateStandalone({
      projectName,
      description,
      appType: appType as string,
      services: services as string[],
      sddProfile: flags.profile,
      ...resolveInitTarget(process.cwd(), projectName, flags),
      harnessFiles: harnessFilesNextTo(undefined, process.cwd()),
      skipVerify: flags.skipVerify,
    });
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  outroReady("Done! Your standalone repo is ready.");
}

// ─── Nx monorepo flow ─────────────────────────────────────────────────────────

async function runNxFlow(
  projectName: string,
  description: string,
  skipConfirm: boolean,
  flags: TargetFlags,
): Promise<void> {
  const packageScope = await p.text({
    message: "npm package scope:",
    placeholder: `@${projectName}`,
    initialValue: `@${projectName}`,
    validate: (value) => {
      if (!value.startsWith("@")) return "Must start with @";
      return undefined;
    },
  });

  if (p.isCancel(packageScope)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const appTypes = await p.multiselect({
    message: "Which apps do you want to create?",
    options: APP_TYPE_OPTIONS,
    required: true,
  });

  if (p.isCancel(appTypes)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const apps: Array<{ name: string; type: string }> = [];
  for (const type of appTypes as string[]) {
    const defaultName = DEFAULT_APP_NAMES[type] ?? type;
    const appName = await p.text({
      message: `Name for ${type} app:`,
      placeholder: defaultName,
      initialValue: defaultName,
      validate: (value) => {
        if (!value) return "App name is required";
        if (!/^[a-z][a-z0-9-]*$/.test(value))
          return "Must be lowercase kebab-case";
        return undefined;
      },
    });

    if (p.isCancel(appName)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    apps.push({ name: appName as string, type });
  }

  const libTypes = await p.multiselect({
    message: "Which shared libraries do you want?",
    options: [
      {
        value: "shared-types",
        label: "Shared Types",
        hint: "TypeScript interfaces & DTOs",
      },
      {
        value: "shared-utils",
        label: "Shared Utils",
        hint: "Helper functions & validators",
      },
      {
        value: "ui-kit",
        label: "UI Kit",
        hint: "Shared React components",
      },
      {
        value: "api-client",
        label: "API Client",
        hint: "Typed HTTP client for backend",
      },
      {
        value: "config",
        label: "Config",
        hint: "Env vars, constants, schemas",
      },
    ],
    required: false,
  });

  if (p.isCancel(libTypes)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const libs: Array<{ name: string; type: string }> = [];
  for (const type of libTypes as string[]) {
    const libName = await p.text({
      message: `Name for ${type} lib:`,
      placeholder: type,
      initialValue: type,
      validate: (value) => {
        if (!value) return "Lib name is required";
        if (!/^[a-z][a-z0-9-]*$/.test(value))
          return "Must be lowercase kebab-case";
        return undefined;
      },
    });

    if (p.isCancel(libName)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    libs.push({ name: libName as string, type });
  }

  const services = await p.multiselect({
    message: "Which Docker services do you need?",
    options: SERVICE_OPTIONS,
    required: false,
  });

  if (p.isCancel(services)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  p.note(
    [
      `${pc.bold("Project:")} ${projectName}`,
      `${pc.bold("Mode:")} Nx monorepo`,
      `${pc.bold("Scope:")} ${packageScope}`,
      `${pc.bold("Apps:")} ${apps.map((a) => `${a.name} (${a.type})`).join(", ")}`,
      `${pc.bold("Libs:")} ${libs.map((l) => l.name).join(", ") || "none"}`,
      `${pc.bold("Services:")} ${(services as string[]).join(", ") || "none"}`,
      `${pc.bold("SDD:")} enabled (always)`,
    ].join("\n"),
    "Configuration Summary",
  );

  const confirmed =
    skipConfirm ||
    (await p.confirm({
      message: "Proceed with this configuration?",
      initialValue: true,
    }));

  if (!confirmed || p.isCancel(confirmed)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  logger.title("Generating workspace...");

  try {
    await generateWorkspace({
      projectName,
      description,
      packageScope: packageScope as string,
      apps,
      libs,
      services: services as string[],
      sddProfile: flags.profile,
      ...resolveInitTarget(process.cwd(), projectName, flags),
      harnessFiles: harnessFilesNextTo(undefined, process.cwd()),
      skipVerify: flags.skipVerify,
    });
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  outroReady("Done! Your workspace is ready.");
}
