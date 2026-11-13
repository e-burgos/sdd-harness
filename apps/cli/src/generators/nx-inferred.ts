import { resolve } from "node:path";
import fs from "fs-extra";
import { DEFAULT_NX_MAJOR, nxMajorOfRange, type NxMajor } from "./versions.js";

export const INFERRED_TASKS_FROM_MAJOR = 24;

export type NxPluginEntry = { plugin: string; options?: Record<string, string> };

const REMOVED_EXECUTORS = new Set([
  "@nx/eslint:lint",
  "@nx/jest:jest",
  "@nx/vite:build",
  "@nx/vite:dev-server",
  "@nx/vite:preview-server",
  "@nx/vite:test",
  "@nx/esbuild:esbuild",
  "@nx/webpack:webpack",
  "@nx/next:build",
  "@nx/next:server",
]);

export function usesInferredTasks(major: NxMajor | undefined): boolean {
  return (major ?? DEFAULT_NX_MAJOR) >= INFERRED_TASKS_FROM_MAJOR;
}

export async function detectNxMajor(root: string): Promise<NxMajor | undefined> {
  const pkgPath = resolve(root, "package.json");
  if (!(await fs.pathExists(pkgPath))) return undefined;
  const pkg = await fs.readJSON(pkgPath);
  return nxMajorOfRange(pkg.devDependencies?.nx ?? pkg.dependencies?.nx);
}

export function eslintPluginEntry(): NxPluginEntry {
  return { plugin: "@nx/eslint/plugin", options: { targetName: "lint" } };
}

export function jestPluginEntry(): NxPluginEntry {
  return { plugin: "@nx/jest/plugin", options: { targetName: "test" } };
}

export function vitePluginEntry(): NxPluginEntry {
  return {
    plugin: "@nx/vite/plugin",
    options: {
      buildTargetName: "build",
      devTargetName: "serve",
      previewTargetName: "preview",
      serveStaticTargetName: "serve-static",
      buildDepsTargetName: "build-deps",
      watchDepsTargetName: "watch-deps",
    },
  };
}

export function inferredPluginsForAppType(type: string): NxPluginEntry[] {
  switch (type) {
    case "nestjs":
      return [jestPluginEntry()];
    case "react":
    case "mfe-shell":
    case "mfe":
      return [vitePluginEntry()];
    default:
      return [];
  }
}

export function removeInferredExecutorTargets(
  targets: Record<string, { executor?: string }> | undefined,
): void {
  if (!targets) return;
  for (const [name, target] of Object.entries(targets)) {
    if (target.executor && REMOVED_EXECUTORS.has(target.executor)) delete targets[name];
  }
}

export async function stripRemovedExecutors(projectDir: string): Promise<void> {
  const path = resolve(projectDir, "project.json");
  if (!(await fs.pathExists(path))) return;
  const projectJson = await fs.readJSON(path);
  removeInferredExecutorTargets(projectJson.targets);
  await fs.writeJSON(path, projectJson, { spaces: 2 });
}

export async function ensureNxPlugins(
  root: string,
  entries: readonly NxPluginEntry[],
): Promise<void> {
  const nxJsonPath = resolve(root, "nx.json");
  if (!(await fs.pathExists(nxJsonPath))) return;
  const nxJson = await fs.readJSON(nxJsonPath);
  nxJson.plugins ??= [];
  let changed = false;
  for (const entry of entries) {
    const present = nxJson.plugins.some(
      (p: string | { plugin: string }) => (typeof p === "string" ? p : p.plugin) === entry.plugin,
    );
    if (!present) {
      nxJson.plugins.push(entry);
      changed = true;
    }
  }
  if (changed) await fs.writeJSON(nxJsonPath, nxJson, { spaces: 2 });
}

export const ESBUILD_VERSION = "^0.28.2";

export function esbuildBuildTarget(name: string): Record<string, unknown> {
  return {
    executor: "nx:run-commands",
    outputs: [`{workspaceRoot}/dist/apps/${name}`],
    options: {
      command: `esbuild apps/${name}/src/main.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/apps/${name}/main.mjs`,
    },
  };
}

export function nodeServeOnBuildTarget(name: string): Record<string, unknown> {
  return {
    executor: "nx:run-commands",
    dependsOn: ["build"],
    options: { command: `node dist/apps/${name}/main.mjs` },
  };
}
