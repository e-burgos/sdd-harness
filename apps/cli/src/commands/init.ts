import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { logger } from "../utils/logger.js";
import { generateWorkspace, generateStandalone } from "../generators/index.js";
import {
  loadHarnessConfig,
  toStandaloneOptions,
  toWorkspaceOptions,
} from "../config/load.js";

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
  },
  async run({ args }) {
    p.intro(pc.bgCyan(pc.black(" harness init ")));

    if (args.config) {
      await runConfigFlow(args.config);
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
      );
    } else {
      await runNxFlow(
        projectName as string,
        (description as string) || "",
        args.yes,
      );
    }
  },
});

// ─── Config-driven flow (non-interactive, for AI agents and CI) ───────────────

async function runConfigFlow(configPath: string): Promise<void> {
  let config;
  try {
    config = await loadHarnessConfig(configPath);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  p.note(
    [
      `${pc.bold("Project:")} ${config.project.name}`,
      `${pc.bold("Mode:")} ${config.mode}`,
      `${pc.bold("Apps:")} ${config.apps.map((a) => `${a.name} (${a.type})`).join(", ")}`,
      `${pc.bold("Libs:")} ${config.libs.map((l) => l.name).join(", ") || "none"}`,
      `${pc.bold("Services:")} ${config.services.map((s) => s.type).join(", ") || "none"}`,
      `${pc.bold("SDD:")} enabled (always)`,
    ].join("\n"),
    `Configuration from ${configPath}`,
  );

  logger.title(
    config.mode === "standalone"
      ? "Generating standalone repo..."
      : "Generating workspace...",
  );

  try {
    if (config.mode === "standalone") {
      await generateStandalone(toStandaloneOptions(config));
    } else {
      await generateWorkspace(toWorkspaceOptions(config));
    }
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  p.outro(pc.green("Done! Your workspace is ready."));
}

// ─── Standalone flow ──────────────────────────────────────────────────────────

async function runStandaloneFlow(
  projectName: string,
  description: string,
  skipConfirm: boolean,
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
    });
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  p.outro(pc.green("Done! Your standalone repo is ready."));
}

// ─── Nx monorepo flow ─────────────────────────────────────────────────────────

async function runNxFlow(
  projectName: string,
  description: string,
  skipConfirm: boolean,
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
    });
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  p.outro(pc.green("Done! Your workspace is ready."));
}
