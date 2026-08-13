import { resolve } from "node:path";
import fs from "fs-extra";
import { getTemplatesDir } from "../utils/fs.js";
import { copyBlueprint, toFlatCase, toPascalCase } from "../utils/blueprint.js";
import { exec } from "../utils/exec.js";
import { initGitRepo } from "../utils/git.js";
import { logger } from "../utils/logger.js";
import { generateDockerCompose } from "./docker.generator.js";
import { generateSDD, ensureHarnessPackageJson } from "./sdd.generator.js";

export interface StandaloneOptions {
  projectName: string;
  description: string;
  appType: string;
  services: string[];
}

/**
 * Genera un repo standalone: UNA app con el código en la raíz (sin Nx, sin
 * apps/libs) + el sistema SDD completo. El repo se registra en los registros
 * SDD como app lógica única `apps/<nombre>` (convención documentada en el
 * contexto del subproyecto).
 *
 * Fases:
 *  1. Scaffold de la app en la raíz (blueprints react/java root-ificados,
 *     generadores propios para el resto)
 *  2. Arnés: package.json con scripts sdd:* + pnpm install + docker + SDD
 *  3. Finalización: sdd:validate + git init + commit inicial
 */
export async function generateStandalone(
  opts: StandaloneOptions,
): Promise<void> {
  const root = resolve(process.cwd(), opts.projectName);

  if (await fs.pathExists(root)) {
    throw new Error(`El directorio "${opts.projectName}" ya existe.`);
  }
  await fs.ensureDir(root);

  // ─── FASE 1: App en la raíz ───────────────────────────────────────────────

  logger.step(`Generating standalone app (${opts.appType}) at the repo root...`);
  await scaffoldStandaloneApp(root, opts.projectName, opts.appType);
  await writeGitignore(root, opts.appType);

  // ─── FASE 2: Arnés SDD ────────────────────────────────────────────────────

  logger.step("Registering SDD harness scripts in package.json...");
  await ensureHarnessPackageJson(root, opts.projectName);

  logger.step("Installing dependencies (pnpm install)...");
  exec("pnpm install", { cwd: root });

  if (opts.services.length > 0) {
    logger.step("Generating Docker Compose...");
    await generateDockerCompose(root, opts.services);
  }

  logger.step("Configuring SDD (Spec-Driven Development)...");
  await generateSDD(
    root,
    {
      projectName: opts.projectName,
      description: opts.description,
      packageScope: `@${opts.projectName}`,
      apps: [{ name: opts.projectName, type: opts.appType }],
      libs: [],
      services: opts.services,
    },
    { layout: "standalone" },
  );

  // ─── FASE 3: Finalización ─────────────────────────────────────────────────

  logger.step("Validating SDD registries (sdd:validate)...");
  try {
    exec("node sdd/scripts/validate-sdd.mjs", { cwd: root, silent: true });
    logger.success("sdd:validate OK");
  } catch {
    logger.warn(
      "sdd:validate reportó problemas. Correr `pnpm sdd:validate` en el repo para ver el detalle.",
    );
  }

  logger.step("Initializing git repository...");
  initGitRepo(
    root,
    "chore: initial standalone setup via @e-burgos/sdd-harness",
  );

  logger.success(`Standalone repo "${opts.projectName}" created successfully.`);
}

async function scaffoldStandaloneApp(
  root: string,
  name: string,
  type: string,
): Promise<void> {
  switch (type) {
    case "react":
      await scaffoldReact(root, name);
      break;
    case "springboot":
      await scaffoldSpringBoot(root, name);
      break;
    case "nestjs":
      await scaffoldNest(root, name);
      break;
    case "nextjs":
      await scaffoldNext(root, name);
      break;
    case "fastify":
      await scaffoldFastify(root, name);
      break;
    case "hono":
      await scaffoldHono(root, name);
      break;
    case "python":
      await scaffoldPython(root, name);
      break;
    default:
      throw new Error(`Tipo de app standalone no soportado: ${type}`);
  }
}

/** Versiones desde el package.json del kit — única fuente, sin duplicar pins. */
async function kitVersions(): Promise<Record<string, string>> {
  const kitPkg = await fs.readJSON(
    resolve(getTemplatesDir(), "sdd/templates/nx-workspace/package.json"),
  );
  return { ...kitPkg.dependencies, ...kitPkg.devDependencies };
}

// ─── React (blueprint react-app root-ificado) ────────────────────────────────

async function scaffoldReact(root: string, name: string): Promise<void> {
  const blueprint = resolve(getTemplatesDir(), "sdd/templates/apps/react-app");
  await copyBlueprint(blueprint, root, { "example-app": name });

  // Artefactos Nx-only del blueprint que no aplican en standalone
  await fs.remove(resolve(root, "project.json"));
  await fs.remove(resolve(root, "tsconfig.app.json"));

  await fs.writeFile(
    resolve(root, "vite.config.ts"),
    `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [tailwindcss(), react()],
  server: { port: 4200, host: 'localhost' },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});
`,
    "utf-8",
  );

  await fs.writeJSON(
    resolve(root, "tsconfig.json"),
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        types: ["vite/client"],
      },
      include: ["src/**/*.ts", "src/**/*.tsx"],
    },
    { spaces: 2 },
  );

  const v = await kitVersions();
  await fs.writeJSON(
    resolve(root, "package.json"),
    {
      name,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc --noEmit && vite build",
        preview: "vite preview",
        test: "vitest run --passWithNoTests",
      },
      dependencies: {
        react: v["react"],
        "react-dom": v["react-dom"],
        "react-router-dom": v["react-router-dom"],
      },
      devDependencies: {
        "@tailwindcss/vite": v["tailwindcss"] ? v["@tailwindcss/vite"] : undefined,
        "@types/react": v["@types/react"],
        "@types/react-dom": v["@types/react-dom"],
        "@vitejs/plugin-react": v["@vitejs/plugin-react"],
        tailwindcss: v["tailwindcss"],
        typescript: v["typescript"],
        vite: v["vite"],
        vitest: v["vitest"],
      },
    },
    { spaces: 2 },
  );
}

// ─── Spring Boot (blueprint java-api root-ificado, Maven) ────────────────────

async function scaffoldSpringBoot(root: string, name: string): Promise<void> {
  const blueprint = resolve(getTemplatesDir(), "sdd/templates/apps/java-api");
  await copyBlueprint(blueprint, root, {
    "example-api": name,
    exampleapi: toFlatCase(name),
    Exampleapi: toPascalCase(name),
  });
  await fs.remove(resolve(root, "project.json"));

  // package.json solo para el arnés SDD + conveniencia mvn
  await fs.writeJSON(
    resolve(root, "package.json"),
    {
      name,
      version: "0.1.0",
      private: true,
      scripts: {
        build: "mvn package -DskipTests",
        test: "mvn test",
        serve:
          'mvn spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=local"',
        lint: "mvn checkstyle:check",
      },
    },
    { spaces: 2 },
  );
}

// ─── NestJS ──────────────────────────────────────────────────────────────────

async function scaffoldNest(root: string, name: string): Promise<void> {
  await fs.ensureDir(resolve(root, "src/app"));

  await fs.writeFile(
    resolve(root, "src/main.ts"),
    `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  await app.listen(process.env['PORT'] || 3000);
}
bootstrap();
`,
    "utf-8",
  );

  await fs.writeFile(
    resolve(root, "src/app/app.module.ts"),
    `import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
`,
    "utf-8",
  );

  await fs.writeFile(
    resolve(root, "src/app/app.controller.ts"),
    `import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health() {
    return this.appService.getHealth();
  }
}
`,
    "utf-8",
  );

  await fs.writeFile(
    resolve(root, "src/app/app.service.ts"),
    `import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
`,
    "utf-8",
  );

  await fs.writeJSON(
    resolve(root, "nest-cli.json"),
    {
      $schema: "https://json.schemastore.org/nest-cli",
      collection: "@nestjs/schematics",
      sourceRoot: "src",
      compilerOptions: { deleteOutDir: true },
    },
    { spaces: 2 },
  );

  await fs.writeJSON(
    resolve(root, "tsconfig.json"),
    {
      compilerOptions: {
        module: "commonjs",
        declaration: true,
        removeComments: true,
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        allowSyntheticDefaultImports: true,
        target: "ES2022",
        sourceMap: true,
        outDir: "./dist",
        baseUrl: "./",
        incremental: true,
        skipLibCheck: true,
        strictNullChecks: true,
        forceConsistentCasingInFileNames: true,
      },
      include: ["src/**/*.ts"],
      exclude: ["node_modules", "dist"],
    },
    { spaces: 2 },
  );

  const v = await kitVersions();
  await fs.writeJSON(
    resolve(root, "package.json"),
    {
      name,
      version: "0.1.0",
      private: true,
      scripts: {
        build: "nest build",
        start: "nest start",
        "start:dev": "nest start --watch",
        "start:prod": "node dist/main",
        test: "jest --passWithNoTests",
      },
      dependencies: {
        "@nestjs/common": "^11.0.0",
        "@nestjs/core": "^11.0.0",
        "@nestjs/platform-express": "^11.0.0",
        "reflect-metadata": "^0.2.0",
        rxjs: "^7.8.0",
      },
      devDependencies: {
        "@nestjs/cli": "^11.0.0",
        "@nestjs/schematics": "^11.0.0",
        "@nestjs/testing": "^11.0.0",
        "@types/express": "^5.0.0",
        "@types/jest": "^29.0.0",
        "@types/node": v["@types/node"],
        jest: "^29.0.0",
        "ts-jest": "^29.0.0",
        "ts-node": "^10.9.0",
        typescript: v["typescript"],
      },
      jest: {
        moduleFileExtensions: ["js", "json", "ts"],
        rootDir: "src",
        testRegex: ".*\\.spec\\.ts$",
        transform: { "^.+\\.(t|j)s$": "ts-jest" },
        testEnvironment: "node",
      },
    },
    { spaces: 2 },
  );
}

// ─── Next.js ─────────────────────────────────────────────────────────────────

async function scaffoldNext(root: string, name: string): Promise<void> {
  await fs.ensureDir(resolve(root, "app"));

  await fs.writeFile(
    resolve(root, "app/layout.tsx"),
    `export const metadata = { title: '${name}', description: 'Generated by @e-burgos/sdd-harness' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
    "utf-8",
  );

  await fs.writeFile(
    resolve(root, "app/page.tsx"),
    `export default function Home() {
  return (
    <main>
      <h1>Welcome to ${name}</h1>
      <p>Start editing <code>app/page.tsx</code></p>
    </main>
  );
}
`,
    "utf-8",
  );

  await fs.writeFile(
    resolve(root, "next.config.js"),
    `/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;
`,
    "utf-8",
  );

  await fs.writeJSON(
    resolve(root, "tsconfig.json"),
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    },
    { spaces: 2 },
  );

  const v = await kitVersions();
  await fs.writeJSON(
    resolve(root, "package.json"),
    {
      name,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
      },
      dependencies: {
        next: "^15.0.0",
        react: v["react"],
        "react-dom": v["react-dom"],
      },
      devDependencies: {
        "@types/node": v["@types/node"],
        "@types/react": v["@types/react"],
        "@types/react-dom": v["@types/react-dom"],
        typescript: v["typescript"],
      },
    },
    { spaces: 2 },
  );
}

// ─── Fastify ─────────────────────────────────────────────────────────────────

async function scaffoldFastify(root: string, name: string): Promise<void> {
  await writeNodeApiScaffold(root, name, {
    dependencies: { fastify: "^5.0.0" },
    mainTs: `import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/api/v1/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

const start = async () => {
  try {
    await app.listen({ port: Number(process.env['PORT'] || 3000), host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
`,
  });
}

// ─── Hono ────────────────────────────────────────────────────────────────────

async function scaffoldHono(root: string, name: string): Promise<void> {
  await writeNodeApiScaffold(root, name, {
    dependencies: { hono: "^4.7.0", "@hono/node-server": "^1.14.0" },
    mainTs: `import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();

app.get('/api/v1/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() }),
);

serve(
  { fetch: app.fetch, port: Number(process.env['PORT'] ?? 3000) },
  (info) => {
    console.log(\`Listening on http://localhost:\${info.port}\`);
  },
);
`,
  });
}

/** Scaffold común para APIs Node standalone (fastify, hono): tsx + tsc + vitest. */
async function writeNodeApiScaffold(
  root: string,
  name: string,
  cfg: { dependencies: Record<string, string>; mainTs: string },
): Promise<void> {
  await fs.ensureDir(resolve(root, "src"));
  await fs.writeFile(resolve(root, "src/main.ts"), cfg.mainTs, "utf-8");

  await fs.writeJSON(
    resolve(root, "tsconfig.json"),
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        types: ["node"],
      },
      include: ["src/**/*.ts"],
      exclude: ["node_modules", "dist"],
    },
    { spaces: 2 },
  );

  const v = await kitVersions();
  await fs.writeJSON(
    resolve(root, "package.json"),
    {
      name,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: {
        dev: "tsx watch src/main.ts",
        build: "tsc",
        start: "node dist/main.js",
        test: "vitest run --passWithNoTests",
      },
      dependencies: cfg.dependencies,
      devDependencies: {
        "@types/node": v["@types/node"],
        tsx: "^4.19.0",
        typescript: v["typescript"],
        vitest: v["vitest"],
      },
    },
    { spaces: 2 },
  );
}

// ─── Python ──────────────────────────────────────────────────────────────────

async function scaffoldPython(root: string, name: string): Promise<void> {
  const pkg = name.replace(/-/g, "_");
  await fs.ensureDir(resolve(root, "src", pkg));
  await fs.ensureDir(resolve(root, "tests"));

  await fs.writeFile(
    resolve(root, "pyproject.toml"),
    `[project]
name = "${name}"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = []

[project.optional-dependencies]
dev = ["pytest", "ruff"]
`,
    "utf-8",
  );

  await fs.writeFile(resolve(root, "src", pkg, "__init__.py"), "", "utf-8");
  await fs.writeFile(
    resolve(root, "src", pkg, "__main__.py"),
    `"""Entry point for ${name}."""

def main():
    print("Hello from ${name}!")

if __name__ == "__main__":
    main()
`,
    "utf-8",
  );

  await fs.writeFile(resolve(root, "tests", "__init__.py"), "", "utf-8");
  await fs.writeFile(
    resolve(root, "tests", "test_main.py"),
    `def test_placeholder():
    assert True
`,
    "utf-8",
  );

  await fs.writeJSON(
    resolve(root, "package.json"),
    {
      name,
      version: "0.1.0",
      private: true,
      scripts: {
        serve: `python -m ${pkg}`,
        lint: "ruff check src/",
        test: "pytest tests/",
      },
    },
    { spaces: 2 },
  );
}

// ─── .gitignore ──────────────────────────────────────────────────────────────

const TYPE_IGNORES: Record<string, string[]> = {
  springboot: ["target/", "*.jar", "!.mvn/wrapper/*.jar"],
  python: ["__pycache__/", ".venv/", ".pytest_cache/", "*.pyc", ".ruff_cache/"],
  nextjs: [".next/", "next-env.d.ts"],
};

async function writeGitignore(root: string, type: string): Promise<void> {
  const base = await fs.readFile(
    resolve(getTemplatesDir(), "sdd/templates/nx-workspace/gitignore"),
    "utf-8",
  );
  const extras = TYPE_IGNORES[type] ?? [];
  const content =
    extras.length > 0
      ? `${base.trimEnd()}\n\n# ${type} standalone\n${extras.join("\n")}\n`
      : base;
  await fs.writeFile(resolve(root, ".gitignore"), content, "utf-8");
}
