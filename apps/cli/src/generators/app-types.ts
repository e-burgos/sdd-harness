export const WORKSPACE_ONLY_APP_TYPES = ["next-bff", "mfe-shell", "mfe"] as const;

export const TUCU_UI_APP_TYPES = [
  "react",
  "nextjs",
  "next-bff",
  "mfe-shell",
  "mfe",
] as const;

export interface TopologyApp {
  name: string;
  type: string;
  shell?: string;
}

export function appEnvPrefix(appName: string): string {
  return appName.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

export function hostEnvVar(appName: string): string {
  return `${appEnvPrefix(appName)}_HOST`;
}

export const APP_STACK_DESCRIPTIONS: Record<string, string> = {
  nestjs: "NestJS (Webpack build, Jest)",
  react: "React + Vite + Tailwind v4 (tucu-ui by default)",
  nextjs: "Next.js App Router (tucu-ui by default)",
  "next-bff": "Next.js App Router BFF: app/api routes proxying an upstream service, tucu-ui by default",
  "mfe-shell": "Vite + React shell of a path-based microfrontend setup (proxy and nginx for /<mfe>/), tucu-ui by default",
  mfe: "Vite + React microfrontend served under /<mfe>/ behind an mfe-shell, tucu-ui by default",
  python: "Python 3.12 + FastAPI + LangGraph managed with uv (pytest, ruff); TensorFlow behind the ml extra",
  fastify: "Fastify (esbuild)",
  hono: "Hono on Node",
  springboot: "Spring Boot 3, Java 21, Maven (hexagonal)",
};

export function upstreamEnvVar(appName: string): string {
  return `${appEnvPrefix(appName)}_UPSTREAM_URL`;
}

export function isWorkspaceOnlyAppType(type: string): boolean {
  return (WORKSPACE_ONLY_APP_TYPES as readonly string[]).includes(type);
}

export function resolveMfeShell(
  mfe: TopologyApp,
  apps: readonly TopologyApp[],
): TopologyApp | undefined {
  const shells = apps.filter((app) => app.type === "mfe-shell");
  if (mfe.shell) return shells.find((shell) => shell.name === mfe.shell);
  return shells.length === 1 ? shells[0] : undefined;
}

export function mfesOfShell<T extends TopologyApp>(
  shell: TopologyApp,
  apps: readonly T[],
): T[] {
  return apps.filter(
    (app) => app.type === "mfe" && resolveMfeShell(app, apps)?.name === shell.name,
  );
}

export function validateAppTopology(
  apps: readonly TopologyApp[],
  mode: "nx" | "standalone",
): string[] {
  const errors: string[] = [];

  if (mode === "standalone") {
    for (const app of apps.filter((a) => isWorkspaceOnlyAppType(a.type))) {
      errors.push(
        `App type "${app.type}" ("${app.name}") is only supported in monorepo (nx) mode, not in standalone mode.`,
      );
    }
    return errors;
  }

  const shells = apps.filter((a) => a.type === "mfe-shell");
  for (const app of apps) {
    if (app.shell && app.type !== "mfe") {
      errors.push(
        `App "${app.name}": "shell" is only valid on apps of type "mfe" (got type "${app.type}").`,
      );
    }
    if (app.type !== "mfe") continue;
    if (app.shell) {
      const target = apps.find((a) => a.name === app.shell);
      if (!target) {
        errors.push(
          `App "${app.name}": shell "${app.shell}" does not exist in apps.`,
        );
      } else if (target.type !== "mfe-shell") {
        errors.push(
          `App "${app.name}": shell "${app.shell}" must be an app of type "mfe-shell" (got "${target.type}").`,
        );
      }
    } else if (shells.length !== 1) {
      errors.push(
        shells.length === 0
          ? `App "${app.name}": an "mfe" needs a shell, but there is no app of type "mfe-shell".`
          : `App "${app.name}": declare apps[].shell — there are ${shells.length} "mfe-shell" apps (${shells.map((s) => s.name).join(", ")}).`,
      );
    }
  }
  return errors;
}

export function assertValidAppTopology(
  apps: readonly TopologyApp[],
  mode: "nx" | "standalone",
): void {
  const errors = validateAppTopology(apps, mode);
  if (errors.length > 0) throw new Error(errors.join("\n"));
}
