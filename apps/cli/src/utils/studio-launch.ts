import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

export const STUDIO_PACKAGE = "@e-burgos/sdd-studio@latest";

export interface StudioSpawnRequest {
  command: string;
  args: string[];
  cwd: string;
}

export type StudioSpawner = (request: StudioSpawnRequest) => Promise<number>;

export interface StudioRouteInput {
  studio: boolean;
  terminal: boolean;
  interactive: boolean;
  config?: string;
  yes: boolean;
  preAnswered: boolean;
}

export type StudioRoute = "studio" | "terminal" | "ask";

export function resolveStudioRoute(input: StudioRouteInput): StudioRoute {
  if (input.studio) return "studio";
  if (input.terminal) return "terminal";
  if (input.config || input.yes || input.preAnswered || !input.interactive) {
    return "terminal";
  }
  return "ask";
}

export function studioCommand(platform: NodeJS.Platform = process.platform): string {
  return platform === "win32" ? "npx.cmd" : "npx";
}

export function buildStudioRequest(
  cwd: string,
  platform: NodeJS.Platform = process.platform,
): StudioSpawnRequest {
  return { command: studioCommand(platform), args: ["-y", STUDIO_PACKAGE], cwd };
}

function defaultSpawner(request: StudioSpawnRequest): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const child: ChildProcess = spawn(request.command, request.args, {
      cwd: request.cwd,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("close", (code) => resolvePromise(code ?? 1));
  });
}

let activeSpawner: StudioSpawner = defaultSpawner;

export function setStudioSpawner(spawner?: StudioSpawner): void {
  activeSpawner = spawner ?? defaultSpawner;
}

export function manualStudioHint(dir: string): string {
  return `No se pudo ejecutar npx. Abrilo a mano:\n  cd ${dir}\n  npx -y ${STUDIO_PACKAGE}`;
}

export async function launchStudio(dir: string): Promise<number> {
  try {
    return await activeSpawner(buildStudioRequest(dir));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return -1;
    throw err;
  }
}
