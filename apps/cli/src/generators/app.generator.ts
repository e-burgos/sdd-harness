import { resolve } from "node:path";
import fs from "fs-extra";
import {
  copyBlueprint,
  resolveBlueprintDir,
  toFlatCase,
  toPascalCase,
} from "../utils/blueprint.js";

/**
 * Genera el scaffold de una app según su tipo.
 *
 * react y springboot salen de los blueprints portables de sdd/templates/apps/
 * (react-app y java-api) con renombre de tokens, como documenta la skill
 * scaffold-nx. El resto de tipos usa los generadores propios de la CLI.
 */
export async function generateApp(
  root: string,
  app: { name: string; type: string },
  packageScope: string,
): Promise<void> {
  const appDir = resolve(root, "apps", app.name);
  await fs.ensureDir(appDir);

  switch (app.type) {
    case "nestjs":
      await generateNestApp(appDir, app.name, packageScope);
      break;
    case "react":
      await generateReactApp(root, appDir, app.name);
      break;
    case "nextjs":
      await generateNextApp(appDir, app.name, packageScope);
      break;
    case "fastify":
      await generateFastifyApp(appDir, app.name, packageScope);
      break;
    case "python":
      await generatePythonApp(appDir, app.name);
      break;
    case "springboot":
      await generateSpringBootApp(root, appDir, app.name);
      break;
    case "hono":
      await generateHonoApp(appDir, app.name, packageScope);
      break;
  }
}

// ─── NestJS ──────────────────────────────────────────────────────────────────

async function generateNestApp(
  dir: string,
  name: string,
  scope: string,
): Promise<void> {
  await fs.ensureDir(resolve(dir, "src"));

  await fs.writeFile(
    resolve(dir, "project.json"),
    JSON.stringify(
      {
        name,
        $schema: "../../node_modules/nx/schemas/project-schema.json",
        sourceRoot: `apps/${name}/src`,
        projectType: "application",
        tags: ["scope:api", "type:app"],
        targets: {
          build: {
            executor: "@nx/webpack:webpack",
            outputs: ["{options.outputPath}"],
            options: {
              outputPath: `dist/apps/${name}`,
              main: `apps/${name}/src/main.ts`,
              tsConfig: `apps/${name}/tsconfig.app.json`,
              compiler: "tsc",
            },
          },
          serve: {
            executor: "@nx/js:node",
            options: { buildTarget: `${name}:build` },
          },
          lint: { executor: "@nx/eslint:lint" },
          test: {
            executor: "@nx/jest:jest",
            options: { jestConfig: `apps/${name}/jest.config.ts` },
          },
        },
      },
      null,
      2,
    ),
    "utf-8",
  );

  await fs.writeFile(
    resolve(dir, "src/main.ts"),
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

  await fs.ensureDir(resolve(dir, "src/app"));

  await fs.writeFile(
    resolve(dir, "src/app/app.module.ts"),
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
    resolve(dir, "src/app/app.controller.ts"),
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
    resolve(dir, "src/app/app.service.ts"),
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

  await fs.writeFile(
    resolve(dir, "tsconfig.app.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: {
          outDir: "../../dist/out-tsc",
          module: "commonjs",
          types: ["node"],
          emitDecoratorMetadata: true,
          target: "es2021",
        },
        exclude: ["jest.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"],
        include: ["src/**/*.ts"],
      },
      null,
      2,
    ),
    "utf-8",
  );

  await fs.writeFile(
    resolve(dir, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "../../tsconfig.base.json",
        compilerOptions: { esModuleInterop: true },
        files: [],
        include: [],
        references: [{ path: "./tsconfig.app.json" }],
      },
      null,
      2,
    ),
    "utf-8",
  );
}

// ─── React ──────────────────────────────────────────────────────────────────
// Blueprint: sdd/templates/apps/react-app (Vite + react-router + Docker/nginx)

async function generateReactApp(
  root: string,
  dir: string,
  name: string,
): Promise<void> {
  const blueprint = resolveBlueprintDir(root, "apps/react-app");
  await copyBlueprint(blueprint, dir, { "example-app": name });
}

// ─── Next.js ────────────────────────────────────────────────────────────────

async function generateNextApp(
  dir: string,
  name: string,
  scope: string,
): Promise<void> {
  await fs.ensureDir(resolve(dir, "app"));

  await fs.writeFile(
    resolve(dir, "project.json"),
    JSON.stringify(
      {
        name,
        $schema: "../../node_modules/nx/schemas/project-schema.json",
        sourceRoot: `apps/${name}`,
        projectType: "application",
        tags: ["scope:web", "type:app"],
        targets: {
          build: {
            executor: "@nx/next:build",
            options: { outputPath: `dist/apps/${name}` },
          },
          serve: {
            executor: "@nx/next:server",
            options: { dev: true, port: 3000 },
          },
          lint: { executor: "@nx/eslint:lint" },
        },
      },
      null,
      2,
    ),
    "utf-8",
  );

  await fs.writeFile(
    resolve(dir, "app/layout.tsx"),
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
    resolve(dir, "app/page.tsx"),
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
    resolve(dir, "next.config.js"),
    `const { composePlugins, withNx } = require('@nx/next');
const nextConfig = {};
const plugins = [withNx];
module.exports = composePlugins(...plugins)(nextConfig);
`,
    "utf-8",
  );

  await fs.writeFile(
    resolve(dir, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          jsx: "preserve",
          lib: ["dom", "dom.iterable", "esnext"],
          module: "esnext",
          moduleResolution: "bundler",
          plugins: [{ name: "next" }],
        },
        include: ["**/*.ts", "**/*.tsx", "next-env.d.ts"],
      },
      null,
      2,
    ),
    "utf-8",
  );
}

// ─── Fastify ────────────────────────────────────────────────────────────────

async function generateFastifyApp(
  dir: string,
  name: string,
  scope: string,
): Promise<void> {
  await fs.ensureDir(resolve(dir, "src"));

  await fs.writeFile(
    resolve(dir, "project.json"),
    JSON.stringify(
      {
        name,
        $schema: "../../node_modules/nx/schemas/project-schema.json",
        sourceRoot: `apps/${name}/src`,
        projectType: "application",
        tags: ["scope:api", "type:app"],
        targets: {
          build: {
            executor: "@nx/esbuild:esbuild",
            options: {
              outputPath: `dist/apps/${name}`,
              main: `apps/${name}/src/main.ts`,
              tsConfig: `apps/${name}/tsconfig.app.json`,
              platform: "node",
              format: ["esm"],
            },
          },
          serve: {
            executor: "@nx/js:node",
            options: { buildTarget: `${name}:build` },
          },
          lint: { executor: "@nx/eslint:lint" },
        },
      },
      null,
      2,
    ),
    "utf-8",
  );

  await fs.writeFile(
    resolve(dir, "src/main.ts"),
    `import Fastify from 'fastify';

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
    "utf-8",
  );

  await fs.writeFile(
    resolve(dir, "tsconfig.app.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: {
          outDir: "../../dist/out-tsc",
          module: "ESNext",
          types: ["node"],
        },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    ),
    "utf-8",
  );

  await fs.writeFile(
    resolve(dir, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "../../tsconfig.base.json",
        files: [],
        include: [],
        references: [{ path: "./tsconfig.app.json" }],
      },
      null,
      2,
    ),
    "utf-8",
  );
}

// ─── Python ─────────────────────────────────────────────────────────────────

async function generatePythonApp(dir: string, name: string): Promise<void> {
  const pkg = name.replace(/-/g, "_");
  await fs.ensureDir(resolve(dir, "src", pkg));
  await fs.ensureDir(resolve(dir, "tests"));

  await fs.writeFile(
    resolve(dir, "project.json"),
    JSON.stringify(
      {
        name,
        $schema: "../../node_modules/nx/schemas/project-schema.json",
        sourceRoot: `apps/${name}/src`,
        projectType: "application",
        tags: ["scope:agent", "type:app"],
        targets: {
          serve: { command: `cd apps/${name} && python -m ${pkg}` },
          lint: { command: `cd apps/${name} && ruff check src/` },
          test: { command: `cd apps/${name} && pytest tests/` },
        },
      },
      null,
      2,
    ),
    "utf-8",
  );

  await fs.writeFile(
    resolve(dir, "pyproject.toml"),
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

  await fs.writeFile(resolve(dir, "src", pkg, "__init__.py"), "", "utf-8");
  await fs.writeFile(
    resolve(dir, "src", pkg, "__main__.py"),
    `"""Entry point for ${name}."""

def main():
    print("Hello from ${name}!")

if __name__ == "__main__":
    main()
`,
    "utf-8",
  );

  await fs.writeFile(resolve(dir, "tests", "__init__.py"), "", "utf-8");
  await fs.writeFile(
    resolve(dir, "tests", "test_main.py"),
    `def test_placeholder():
    assert True
`,
    "utf-8",
  );
}

// ─── Hono (@nx/node:application + bundler vite) ──────────────────────────────
//
// Usa el generador nativo de @nx/node con bundler=vite, luego instala
// hono y @hono/node-server. El project.json lo genera nx g, aquí sólo
// se crea la estructura src/ y los archivos base.

async function generateHonoApp(
  dir: string,
  name: string,
  scope: string,
): Promise<void> {
  await fs.ensureDir(resolve(dir, "src"));

  // project.json — @nx/node infiere targets build/serve/test/lint
  await fs.writeFile(
    resolve(dir, "project.json"),
    JSON.stringify(
      {
        name,
        $schema: "../../node_modules/nx/schemas/project-schema.json",
        sourceRoot: `apps/${name}/src`,
        projectType: "application",
        tags: ["scope:api", "type:app"],
        targets: {
          build: {
            executor: "@nx/vite:build",
            outputs: ["{options.outputPath}"],
            options: {
              outputPath: `dist/apps/${name}`,
              main: `apps/${name}/src/main.ts`,
              tsConfig: `apps/${name}/tsconfig.app.json`,
            },
          },
          serve: {
            executor: "@nx/js:node",
            defaultConfiguration: "development",
            options: { buildTarget: `${name}:build` },
            configurations: {
              development: { buildTarget: `${name}:build:development` },
              production: { buildTarget: `${name}:build:production` },
            },
          },
          lint: { executor: "@nx/eslint:lint" },
          test: {
            // @nx/vite:test no existe en Nx 23 — mismo patrón que react-app
            executor: "nx:run-commands",
            options: {
              command: `vitest run --passWithNoTests --coverage.reportsDirectory=../../coverage/apps/${name}`,
              cwd: `apps/${name}`,
            },
          },
        },
      },
      null,
      2,
    ),
    "utf-8",
  );

  // main.ts — Hono + @hono/node-server
  await fs.writeFile(
    resolve(dir, "src/main.ts"),
    `import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();

app.get('/api/v1/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() }),
);

serve(
  { fetch: app.fetch, port: Number(process.env['PORT'] ?? 3000) },
  (info) => {
    console.log(\`Server running at http://localhost:\${info.port}\`);
  },
);
`,
    "utf-8",
  );

  // tsconfig.json
  await fs.writeFile(
    resolve(dir, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          module: "ESNext",
          moduleResolution: "bundler",
          types: ["node"],
        },
        files: [],
        include: [],
        references: [
          { path: "./tsconfig.app.json" },
          { path: "./tsconfig.spec.json" },
        ],
      },
      null,
      2,
    ),
    "utf-8",
  );

  // tsconfig.app.json
  await fs.writeFile(
    resolve(dir, "tsconfig.app.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: {
          outDir: "../../dist/out-tsc",
          module: "ESNext",
          types: ["node"],
        },
        exclude: ["vite.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"],
        include: ["src/**/*.ts"],
      },
      null,
      2,
    ),
    "utf-8",
  );

  // tsconfig.spec.json
  await fs.writeFile(
    resolve(dir, "tsconfig.spec.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: { outDir: "../../dist/out-tsc", types: ["node"] },
        include: ["vite.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"],
      },
      null,
      2,
    ),
    "utf-8",
  );

  // vite.config.ts
  await fs.writeFile(
    resolve(dir, "vite.config.ts"),
    `/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/${name}',
  plugins: [],
  build: {
    target: 'node18',
    lib: {
      entry: 'src/main.ts',
      formats: ['es'],
      fileName: 'main',
    },
    rollupOptions: {
      external: ['hono', '@hono/node-server'],
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/${name}',
      provider: 'v8',
    },
  },
});
`,
    "utf-8",
  );
}

// ─── Spring Boot 3 (Maven vía nx:run-commands) ──────────────────────────────
// Blueprint: sdd/templates/apps/java-api — arquitectura hexagonal, pom.xml,
// project.json con targets build/test/serve/lint/coverage delegados a mvn.
// Nx no genera Spring Boot: el template es la fuente primaria (skill scaffold-nx).

async function generateSpringBootApp(
  root: string,
  dir: string,
  name: string,
): Promise<void> {
  const blueprint = resolveBlueprintDir(root, "apps/java-api");
  await copyBlueprint(blueprint, dir, {
    "example-api": name,
    exampleapi: toFlatCase(name),
    Exampleapi: toPascalCase(name),
  });
}
