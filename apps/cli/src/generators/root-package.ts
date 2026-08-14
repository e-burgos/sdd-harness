import { NX_VERSION } from "./versions.js";

type PackageJson = {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

/**
 * Qué aporta cada app al package.json raíz de un workspace nx. Única fuente
 * para las DOS vías de alta: `init --config`/wizard (workspace.generator) y
 * `harness add app`. Antes cada vía tenía su copia y `add app` no tenía
 * ninguna: la app quedaba sin scripts raíz y, peor, sin sus dependencias de
 * runtime — un `add app hono` generaba una app que no podía ni arrancar.
 */
export function addAppScriptsToRootPkg(pkg: PackageJson, appName: string): void {
  pkg.scripts[appName] = `nx serve ${appName}`;
  pkg.scripts[`build:${appName}`] = `nx build ${appName}`;
  pkg.scripts[`test:${appName}`] = `nx test ${appName}`;
  pkg.scripts[`lint:${appName}`] = `nx lint ${appName}`;
}

/**
 * Dependencias raíz por tipo de app — siempre aditivo. springboot y python no
 * aparecen: integran por Maven/pyproject y no piden nada al package.json raíz.
 *
 * La familia react vive en el template base (el kit la trae por defecto y el
 * init la poda cuando no se usa): para re-agregarla en un workspace ya podado,
 * `referencePkg` es ese template — en un repo generado está en
 * sdd/templates/nx-workspace/package.json.
 */
export function addAppTypeDepsToRootPkg(
  pkg: PackageJson,
  type: string,
  referencePkg?: PackageJson,
): void {
  const addMissingFromReference = (
    section: "dependencies" | "devDependencies",
    names: string[],
  ) => {
    if (!referencePkg) return;
    for (const name of names) {
      if (!(name in pkg[section]) && referencePkg[section][name]) {
        pkg[section][name] = referencePkg[section][name];
      }
    }
  };

  switch (type) {
    case "react":
      addMissingFromReference("dependencies", [
        "react",
        "react-dom",
        "react-router-dom",
      ]);
      addMissingFromReference("devDependencies", [
        "@nx/react",
        "@nx/vite",
        "@vitejs/plugin-react",
        "@types/react",
        "@types/react-dom",
        "@tailwindcss/vite",
        "tailwindcss",
        "vite",
        "vitest",
        "@vitest/coverage-v8",
      ]);
      break;
    case "nestjs":
      Object.assign(pkg.dependencies, {
        "@nestjs/common": "^11.0.0",
        "@nestjs/core": "^11.0.0",
        "@nestjs/platform-express": "^11.0.0",
        "reflect-metadata": "^0.2.0",
        rxjs: "^7.8.0",
      });
      Object.assign(pkg.devDependencies, {
        "@nx/nest": NX_VERSION,
        "@nx/node": NX_VERSION,
        "@nx/webpack": NX_VERSION,
        "@nx/jest": NX_VERSION,
        "@nestjs/testing": "^11.0.0",
        "@types/express": "^5.0.0",
        jest: "^29.0.0",
        "ts-jest": "^29.0.0",
        "@types/jest": "^29.0.0",
      });
      break;
    case "nextjs":
      pkg.dependencies["next"] = "^15.0.0";
      pkg.devDependencies["@nx/next"] = NX_VERSION;
      addMissingFromReference("dependencies", ["react", "react-dom"]);
      addMissingFromReference("devDependencies", [
        "@types/react",
        "@types/react-dom",
      ]);
      break;
    case "fastify":
      pkg.dependencies["fastify"] = "^5.0.0";
      Object.assign(pkg.devDependencies, {
        "@nx/node": NX_VERSION,
        "@nx/esbuild": NX_VERSION,
      });
      break;
    case "hono":
      Object.assign(pkg.dependencies, {
        hono: "^4.7.0",
        "@hono/node-server": "^1.14.0",
      });
      Object.assign(pkg.devDependencies, {
        "@nx/node": NX_VERSION,
        vite: pkg.devDependencies["vite"] ?? "^8.0.0",
        vitest: pkg.devDependencies["vitest"] ?? "^4.1.10",
      });
      break;
  }
}

export function sortKeys(obj: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)),
  );
}
