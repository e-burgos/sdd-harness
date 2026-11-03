import { resolve } from "node:path";
import fs from "fs-extra";
import { mfesOfShell, type TopologyApp } from "./app-types.js";
import { portEnvVar, resolveAppPort, type AppSpec } from "./app.generator.js";
import { refreshMfeShell } from "./frontend-apps.js";

export async function syncMfeShell(
  root: string,
  shell: TopologyApp,
  apps: readonly AppSpec[],
): Promise<boolean> {
  const appDir = resolve(root, "apps", shell.name);
  if (!(await fs.pathExists(appDir))) return false;
  const mfes = mfesOfShell(shell, apps).map((mfe) => ({
    name: mfe.name,
    port: resolveAppPort(mfe, apps),
    portEnvVar: portEnvVar(mfe.name),
  }));
  await refreshMfeShell(appDir, shell.name, mfes);
  return true;
}
