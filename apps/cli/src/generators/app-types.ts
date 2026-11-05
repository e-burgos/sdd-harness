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
  ml?: boolean;
  tucuUi?: boolean;
}

export function appEnvPrefix(appName: string): string {
  return appName.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

export function hostEnvVar(appName: string): string {
  return `${appEnvPrefix(appName)}_HOST`;
}

const APP_STACK_BASE: Record<string, string> = {
  nestjs: "NestJS (Webpack build, Jest)",
  react: "React + Vite + Tailwind v4",
  nextjs: "Next.js App Router",
  "next-bff": "Next.js App Router BFF: app/api routes proxying an upstream service",
  "mfe-shell": "Vite + React shell of a path-based microfrontend setup (proxy and nginx for /<mfe>/)",
  mfe: "Vite + React microfrontend served under /<mfe>/ behind an mfe-shell",
  python: "Python 3.12 + FastAPI + LangGraph managed with uv (pytest, ruff); TensorFlow behind the ml extra",
  fastify: "Fastify (esbuild)",
  hono: "Hono on Node",
  springboot: "Spring Boot 3, Java 21, Maven (hexagonal)",
};

export function describeAppStack(type: string, tucuUi?: boolean): string | undefined {
  const base = APP_STACK_BASE[type];
  if (!base || !(TUCU_UI_APP_TYPES as readonly string[]).includes(type)) return base;
  return `${base}, ${tucuUi === false ? "plain (no tucu-ui)" : "tucu-ui"}`;
}

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

export type TopologyIssueCode =
  | "ml-not-python"
  | "tucu-ui-not-frontend"
  | "workspace-only-type"
  | "shell-not-mfe"
  | "shell-missing"
  | "shell-not-found"
  | "shell-not-mfe-shell"
  | "shell-ambiguous";

export interface TopologyIssue {
  appIndex: number;
  field: "ml" | "tucuUi" | "type" | "shell";
  code: TopologyIssueCode;
  message: string;
}

export function collectAppTopologyIssues(
  apps: readonly TopologyApp[],
  mode: "nx" | "standalone",
): TopologyIssue[] {
  const issues: TopologyIssue[] = [];

  apps.forEach((app, appIndex) => {
    if (app.ml !== undefined && app.type !== "python") {
      issues.push({
        appIndex,
        field: "ml",
        code: "ml-not-python",
        message: `App "${app.name}": "ml" is only valid on apps of type "python" (got type "${app.type}").`,
      });
    }
    if (app.tucuUi !== undefined && !(TUCU_UI_APP_TYPES as readonly string[]).includes(app.type)) {
      issues.push({
        appIndex,
        field: "tucuUi",
        code: "tucu-ui-not-frontend",
        message: `App "${app.name}": "tucuUi" is only valid on frontend apps (${TUCU_UI_APP_TYPES.join(", ")}), got type "${app.type}".`,
      });
    }
  });

  if (mode === "standalone") {
    apps.forEach((app, appIndex) => {
      if (!isWorkspaceOnlyAppType(app.type)) return;
      issues.push({
        appIndex,
        field: "type",
        code: "workspace-only-type",
        message: `App type "${app.type}" ("${app.name}") is only supported in monorepo (nx) mode, not in standalone mode.`,
      });
    });
    return issues;
  }

  const shells = apps.filter((a) => a.type === "mfe-shell");
  apps.forEach((app, appIndex) => {
    if (app.shell && app.type !== "mfe") {
      issues.push({
        appIndex,
        field: "shell",
        code: "shell-not-mfe",
        message: `App "${app.name}": "shell" is only valid on apps of type "mfe" (got type "${app.type}").`,
      });
    }
    if (app.type !== "mfe") return;
    if (app.shell) {
      const target = apps.find((a) => a.name === app.shell);
      if (!target) {
        issues.push({
          appIndex,
          field: "shell",
          code: "shell-not-found",
          message: `App "${app.name}": shell "${app.shell}" does not exist in apps.`,
        });
      } else if (target.type !== "mfe-shell") {
        issues.push({
          appIndex,
          field: "shell",
          code: "shell-not-mfe-shell",
          message: `App "${app.name}": shell "${app.shell}" must be an app of type "mfe-shell" (got "${target.type}").`,
        });
      }
    } else if (shells.length !== 1) {
      issues.push({
        appIndex,
        field: "shell",
        code: shells.length === 0 ? "shell-missing" : "shell-ambiguous",
        message:
          shells.length === 0
            ? `App "${app.name}": an "mfe" needs a shell, but there is no app of type "mfe-shell".`
            : `App "${app.name}": declare apps[].shell — there are ${shells.length} "mfe-shell" apps (${shells.map((s) => s.name).join(", ")}).`,
      });
    }
  });
  return issues;
}

export function validateAppTopology(
  apps: readonly TopologyApp[],
  mode: "nx" | "standalone",
): string[] {
  return collectAppTopologyIssues(apps, mode).map((issue) => issue.message);
}

export function assertValidAppTopology(
  apps: readonly TopologyApp[],
  mode: "nx" | "standalone",
): void {
  const errors = validateAppTopology(apps, mode);
  if (errors.length > 0) throw new Error(errors.join("\n"));
}
