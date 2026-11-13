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
import { isWorkspaceOnlyAppType } from "../generators/app-types.js";
import {
  APP_TYPE_OPTIONS,
  DEFAULT_APP_NAMES,
  LIB_TYPE_OPTIONS,
  SERVICE_OPTIONS,
} from "../config/app-options.js";
import { IDEA_FILENAME } from "../generators/idea.generator.js";
import { parseNxMajor, type NxMajor } from "../generators/versions.js";
import { parseProfile } from "../generators/sdd.generator.js";
import type { SddProfile } from "../generators/sdd.generator.js";
import {
  launchStudio,
  manualStudioHint,
  resolveStudioRoute,
} from "../utils/studio-launch.js";
import { CONFIG_SCHEMA_FILENAME } from "../config/json-schema.js";
import {
  TUCU_UI_CONFLICT_MESSAGE,
  hasConflictingTucuUiFlags,
  hasFrontendApp,
  resolveAppTucuUi,
  resolveKitTucuUiFlag,
} from "../utils/tucu-ui-offer.js";
import {
  applyTucuUi,
  decideTucuUiOffer,
  logTucuUiSummary,
  type TucuUiOfferOutcome,
} from "../utils/tucu-ui-run.js";
import {
  VIDEO_MAKER_CONFLICT_MESSAGE,
  chainBeforeGate,
  hasConflictingVideoMakerFlags,
  planVideoMaker,
} from "../utils/video-maker-run.js";

/** Flags de destino compartidos por las tres vías de init. */
interface TargetFlags {
  here: boolean;
  profile?: SddProfile;
  nxMajor?: NxMajor;
  dir?: string;
  skipVerify: boolean;
  tucuUi?: boolean;
  videoMaker?: boolean;
  interactive?: boolean;
}

export interface TucuUiPlan {
  beforeGate?: (root: string) => void;
  report: () => void;
}

export async function planTucuUi(
  flags: TargetFlags,
  appsOrTypes: ReadonlyArray<string | { type: string; tucuUi?: boolean }>,
  configDefault?: boolean,
): Promise<TucuUiPlan> {
  const apps = appsOrTypes.map((a) => (typeof a === "string" ? { type: a } : a));
  const decision = await decideTucuUiOffer({
    flag: resolveKitTucuUiFlag(apps, flags.tucuUi, configDefault),
    hasFrontend: hasFrontendApp(apps.map((a) => a.type)),
    interactive: flags.interactive ?? false,
    current: "off",
  });
  let outcome: TucuUiOfferOutcome = decision === "enable" ? "failed" : decision;
  return {
    beforeGate:
      decision === "enable"
        ? (root) => {
            outcome = applyTucuUi(root);
          }
        : undefined,
    report: () => logTucuUiSummary(outcome),
  };
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

const STANDALONE_APP_TYPE_OPTIONS = APP_TYPE_OPTIONS.filter(
  (option) => !isWorkspaceOnlyAppType(option.value),
);

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
    studio: {
      type: "boolean",
      description:
        "Skip the question and open SDD Studio (visual wizard) in the target directory",
      default: false,
    },
    terminal: {
      type: "boolean",
      description: "Skip the question and use this terminal wizard",
      default: false,
    },
    "tucu-ui": {
      type: "boolean",
      description:
        "Scaffold react/nextjs apps with tucu-ui and turn on its design skill + MCP (default). --no-tucu-ui generates plain apps and keeps it off. With --config, sdd.tucu_ui is the fallback",
    },
    "video-maker": {
      type: "boolean",
      description:
        "Turn on the video-maker integration (Claude Code plugin + MCP for Copilot and Gemini/Antigravity). Off by default; --no-video-maker keeps it off",
    },
    nx: {
      type: "string",
      description:
        "Nx major for monorepo mode: 22 | 23 | 24 (default 24). Ignored in standalone mode. With --config, --nx wins over nx.version",
    },
    profile: {
      type: "string",
      description:
        "Working profile written to sdd/global.json: team (full cycles, default) | solo (lite cycles, single actor). With --config, sdd.profile wins when set",
    },
  },
  async run({ args, rawArgs }) {
    warnIfNxRootMismatch();
    p.intro(pc.bgCyan(pc.black(" harness init ")));

    if (hasConflictingTucuUiFlags(rawArgs)) {
      logger.error(TUCU_UI_CONFLICT_MESSAGE);
      process.exit(1);
    }

    if (hasConflictingVideoMakerFlags(rawArgs)) {
      logger.error(VIDEO_MAKER_CONFLICT_MESSAGE);
      process.exit(1);
    }

    let profile: SddProfile | undefined;
    try {
      profile = parseProfile(args.profile);
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    let nxMajor: NxMajor | undefined;
    try {
      nxMajor = parseNxMajor(args.nx);
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    const target: TargetFlags = {
      here: args.here,
      nxMajor,
      dir: args.dir,
      skipVerify: args.skipVerify,
      profile,
      tucuUi: args["tucu-ui"],
      videoMaker: args["video-maker"],
      interactive: Boolean(process.stdin.isTTY) && !args.yes && !args.config,
    };

    if (args.config) {
      await runConfigFlow(args.config, target);
      return;
    }

    const route = await chooseOnboardingRoute(args, rawArgs, target.interactive ?? false);
    if (route === "studio") {
      await runStudioFlow(args.name, target);
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
      if (nxMajor) logger.warn("--nx is ignored in standalone mode (no Nx).");
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

const PRE_ANSWER_FLAGS = ["--tucu-ui", "--no-tucu-ui"];

export async function chooseOnboardingRoute(
  args: {
    studio?: boolean;
    terminal?: boolean;
    config?: string;
    yes?: boolean;
    name?: string;
    mode?: string;
    standalone?: boolean;
    profile?: string;
    nx?: string;
    skipVerify?: boolean;
  },
  rawArgs: string[],
  interactive: boolean,
): Promise<"studio" | "terminal"> {
  const route = resolveStudioRoute({
    studio: Boolean(args.studio),
    terminal: Boolean(args.terminal),
    interactive,
    config: args.config,
    yes: Boolean(args.yes),
    preAnswered:
      Boolean(args.name || args.mode || args.standalone || args.profile || args.nx || args.skipVerify) ||
      rawArgs.some((a) => PRE_ANSWER_FLAGS.includes(a)),
  });
  if (route !== "ask") return route;
  const choice = await p.select({
    message: "¿Dónde querés armar el proyecto?",
    options: [
      { value: "studio", label: "Studio — wizard visual con guía (recomendado)" },
      { value: "terminal", label: "Terminal — este asistente" },
    ],
    initialValue: "studio",
  });
  if (p.isCancel(choice)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }
  return choice as "studio" | "terminal";
}

async function runStudioFlow(
  name: string | undefined,
  flags: TargetFlags,
): Promise<void> {
  const { targetDir } = resolveInitTarget(process.cwd(), name ?? basename(process.cwd()), {
    ...flags,
    here: flags.here || !name,
  });
  fs.ensureDirSync(targetDir);
  p.log.info(`Abriendo SDD Studio en ${targetDir}… (Ctrl+C para salir)`);
  const code = await launchStudio(targetDir);
  if (code === -1) {
    logger.error(manualStudioHint(targetDir));
    process.exit(1);
  }
  process.exit(code);
}

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
  const videoMaker = planVideoMaker(flags.videoMaker);
  const tucuUi = await planTucuUi(
    flags,
    config.apps.map((a) => ({
      type: a.type,
      tucuUi: resolveAppTucuUi(a, { cliFlag: flags.tucuUi, configDefault: config.sdd?.tucu_ui }),
    })),
    config.sdd?.tucu_ui,
  );

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
      if (flags.nxMajor) logger.warn("--nx is ignored in standalone mode (no Nx).");
      await generateStandalone({
        ...toStandaloneOptions(config, { tucuUi: flags.tucuUi }),
        sddProfile: config.sdd?.profile ?? flags.profile,
        targetDir,
        harnessFiles,
        skipVerify: flags.skipVerify,
        beforeGate: chainBeforeGate(tucuUi.beforeGate, videoMaker.beforeGate),
      });
    } else {
      await generateWorkspace({
        ...toWorkspaceOptions(config, { tucuUi: flags.tucuUi, nxMajor: flags.nxMajor }),
        sddProfile: config.sdd?.profile ?? flags.profile,
        targetDir,
        harnessFiles,
        skipVerify: flags.skipVerify,
        beforeGate: chainBeforeGate(tucuUi.beforeGate, videoMaker.beforeGate),
      });
    }
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  tucuUi.report();
  videoMaker.report();
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
    options: STANDALONE_APP_TYPE_OPTIONS,
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

  const videoMaker = planVideoMaker(flags.videoMaker);
  const tucuUi = await planTucuUi(flags, [{ type: appType as string }]);

  logger.title("Generating standalone repo...");

  try {
    await generateStandalone({
      projectName,
      description,
      appType: appType as string,
      tucuUi: flags.tucuUi,
      services: services as string[],
      sddProfile: flags.profile,
      ...resolveInitTarget(process.cwd(), projectName, flags),
      harnessFiles: harnessFilesNextTo(undefined, process.cwd()),
      skipVerify: flags.skipVerify,
      beforeGate: chainBeforeGate(tucuUi.beforeGate, videoMaker.beforeGate),
    });
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  tucuUi.report();
  videoMaker.report();
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

  const apps: Array<{
    name: string;
    type: string;
    shell?: string;
    ml?: boolean;
  }> = [];
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

  for (const app of apps) {
    if (app.type === "python") {
      const wantsMl = await p.confirm({
        message: `Add TensorFlow (ml) to "${app.name}" as a default dependency?`,
        initialValue: false,
      });
      if (p.isCancel(wantsMl)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }
      if (wantsMl) app.ml = true;
    }
  }

  const shells = apps.filter((a) => a.type === "mfe-shell");
  if (shells.length > 1) {
    for (const app of apps.filter((a) => a.type === "mfe")) {
      const picked = await p.select({
        message: `Which mfe-shell serves "${app.name}"?`,
        options: shells.map((s) => ({ value: s.name, label: s.name })),
      });
      if (p.isCancel(picked)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }
      app.shell = picked as string;
    }
  }

  const libTypes = await p.multiselect({
    message: "Which shared libraries do you want?",
    options: LIB_TYPE_OPTIONS,
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

  const videoMaker = planVideoMaker(flags.videoMaker);
  const tucuUi = await planTucuUi(flags, apps);

  logger.title("Generating workspace...");

  try {
    await generateWorkspace({
      projectName,
      description,
      packageScope: packageScope as string,
      apps: apps.map((a) => ({ ...a, tucuUi: resolveAppTucuUi(a, { cliFlag: flags.tucuUi }) })),
      libs,
      services: services as string[],
      sddProfile: flags.profile,
      nxMajor: flags.nxMajor,
      ...resolveInitTarget(process.cwd(), projectName, flags),
      harnessFiles: harnessFilesNextTo(undefined, process.cwd()),
      skipVerify: flags.skipVerify,
      beforeGate: chainBeforeGate(tucuUi.beforeGate, videoMaker.beforeGate),
    });
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  tucuUi.report();
  videoMaker.report();
  outroReady("Done! Your workspace is ready.");
}
