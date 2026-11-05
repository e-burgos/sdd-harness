import { resolve } from "node:path";
import fs from "fs-extra";
import { mfesOfShell, type TopologyApp } from "./app-types.js";
import { portEnvVar, resolveAppPort, type AppSpec } from "./app.generator.js";
import { refreshMfeShell } from "./frontend-apps.js";

const PROXY_PORT_ENTRY = /'\/([a-z][a-z0-9-]*)\/':\s*\{\s*target:\s*`[^`]*\?\?\s*(\d+)\}/g;

async function readShellProxyPorts(appDir: string): Promise<Map<string, number>> {
  const viteConfigPath = resolve(appDir, "vite.config.ts");
  if (!(await fs.pathExists(viteConfigPath))) return new Map();
  const content = await fs.readFile(viteConfigPath, "utf-8");
  return new Map(
    [...content.matchAll(PROXY_PORT_ENTRY)].map((match) => [match[1], Number(match[2])]),
  );
}

export async function syncMfeShell(
  root: string,
  shell: TopologyApp,
  apps: readonly AppSpec[],
): Promise<boolean> {
  const appDir = resolve(root, "apps", shell.name);
  if (!(await fs.pathExists(appDir))) return false;
  const proxyPorts = await readShellProxyPorts(appDir);
  const knownPorts = apps.map((app) =>
    app.type === "mfe" && !app.port && proxyPorts.has(app.name)
      ? { ...app, port: proxyPorts.get(app.name) }
      : app,
  );
  const mfes = mfesOfShell(shell, knownPorts).map((mfe) => ({
    name: mfe.name,
    port: resolveAppPort(mfe, knownPorts),
    portEnvVar: portEnvVar(mfe.name),
  }));
  await refreshMfeShell(appDir, shell.name, mfes);
  return true;
}
