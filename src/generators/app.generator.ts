import { resolve } from "node:path";
import fs from "fs-extra";

/**
 * Genera el scaffold de una app según su tipo
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
      await generateReactApp(appDir, app.name, packageScope);
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
      await generateSpringBootApp(appDir, app.name, packageScope);
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

async function generateReactApp(
  dir: string,
  name: string,
  scope: string,
): Promise<void> {
  await fs.ensureDir(resolve(dir, "src"));
  await fs.ensureDir(resolve(dir, "public"));

  await fs.writeFile(
    resolve(dir, "project.json"),
    JSON.stringify(
      {
        name,
        $schema: "../../node_modules/nx/schemas/project-schema.json",
        sourceRoot: `apps/${name}/src`,
        projectType: "application",
        tags: ["scope:web", "type:app"],
        targets: {
          build: {
            executor: "@nx/vite:build",
            outputs: ["{options.outputPath}"],
            options: { outputPath: `dist/apps/${name}` },
          },
          serve: {
            executor: "@nx/vite:dev-server",
            options: { buildTarget: `${name}:build` },
          },
          lint: { executor: "@nx/eslint:lint" },
          test: {
            executor: "@nx/vite:test",
            options: { reportsDirectory: `../../coverage/apps/${name}` },
          },
        },
      },
      null,
      2,
    ),
    "utf-8",
  );

  await fs.writeFile(
    resolve(dir, "index.html"),
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    "utf-8",
  );

  await fs.writeFile(
    resolve(dir, "src/main.tsx"),
    `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
    "utf-8",
  );

  await fs.ensureDir(resolve(dir, "src/app"));

  await fs.writeFile(
    resolve(dir, "src/app/app.tsx"),
    `export function App() {
  return (
    <div>
      <h1>Welcome to ${name}</h1>
      <p>Start editing <code>src/app/app.tsx</code></p>
    </div>
  );
}
`,
    "utf-8",
  );

  await fs.writeFile(
    resolve(dir, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          jsx: "react-jsx",
          module: "ESNext",
          moduleResolution: "bundler",
          types: ["vite/client"],
        },
        include: ["src/**/*.ts", "src/**/*.tsx"],
        references: [{ path: "./tsconfig.app.json" }],
      },
      null,
      2,
    ),
    "utf-8",
  );

  await fs.writeFile(
    resolve(dir, "tsconfig.app.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: {
          outDir: "../../dist/out-tsc",
          types: ["vite/client"],
        },
        exclude: ["src/**/*.spec.tsx", "src/**/*.test.tsx"],
        include: ["src/**/*.ts", "src/**/*.tsx"],
      },
      null,
      2,
    ),
    "utf-8",
  );

  await fs.writeFile(
    resolve(dir, "vite.config.ts"),
    `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 4200, host: 'localhost' },
});
`,
    "utf-8",
  );
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
            executor: "@nx/vite:test",
            options: { reportsDirectory: `../../coverage/apps/${name}` },
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

// ─── Spring Boot 3 (Gradle + @nx/gradle) ────────────────────────────────────
//
// NX infiere los targets automáticamente desde Gradle a través del plugin
// dev.nx.gradle.project-graph (configurado en el settings.gradle raíz).
// Targets disponibles tras la inferencia: build, test, bootRun, bootJar,
// bootBuildImage, check, classes, clean, assemble, javadoc, etc.

async function generateSpringBootApp(
  dir: string,
  name: string,
  scope: string,
): Promise<void> {
  // Derivar paquete Java desde el scope npm (@my-project → com.myproject)
  const scopeClean = scope.replace("@", "").replace(/[^a-z0-9]/g, "");
  const nameClean = name.replace(/-/g, "");
  const basePackage = `com.${scopeClean}.${nameClean}`;
  const packagePath = basePackage.replace(/\./g, "/");
  const mainClass = `${nameClean.charAt(0).toUpperCase()}${nameClean.slice(1)}Application`;

  const srcMain = resolve(dir, "src/main/java", packagePath);
  const srcResources = resolve(dir, "src/main/resources");
  const srcTest = resolve(dir, "src/test/java", packagePath);

  await fs.ensureDir(resolve(srcMain, "controller"));
  await fs.ensureDir(srcResources);
  await fs.ensureDir(srcTest);

  // project.json — solo nombre y tags; los targets los infiere @nx/gradle
  await fs.writeFile(
    resolve(dir, "project.json"),
    JSON.stringify(
      {
        name,
        $schema: "../../node_modules/nx/schemas/project-schema.json",
        projectType: "application",
        tags: ["scope:api", "type:app", "lang:java"],
      },
      null,
      2,
    ),
    "utf-8",
  );

  // build.gradle — Spring Boot 3.5 + Java 21 (Groovy DSL)
  await fs.writeFile(
    resolve(dir, "build.gradle"),
    `plugins {
    id 'java'
    id 'org.springframework.boot' version '3.5.0'
    id 'io.spring.dependency-management' version '1.1.7'
}

group = 'com.${scopeClean}'
version = '0.0.1-SNAPSHOT'

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-actuator'
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

tasks.named('test') {
    useJUnitPlatform()
}
`,
    "utf-8",
  );

  // Application.java
  await fs.writeFile(
    resolve(srcMain, `${mainClass}.java`),
    `package ${basePackage};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ${mainClass} {

    public static void main(String[] args) {
        SpringApplication.run(${mainClass}.class, args);
    }
}
`,
    "utf-8",
  );

  // HealthController.java
  await fs.writeFile(
    resolve(srcMain, "controller", "HealthController.java"),
    `package ${basePackage}.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class HealthController {

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "ok",
            "timestamp", Instant.now().toString()
        ));
    }
}
`,
    "utf-8",
  );

  // application.properties
  await fs.writeFile(
    resolve(srcResources, "application.properties"),
    `server.port=8080
spring.application.name=${name}
management.endpoints.web.exposure.include=health,info
management.endpoint.health.show-details=always
`,
    "utf-8",
  );

  // ApplicationTests.java
  await fs.writeFile(
    resolve(srcTest, `${mainClass}Tests.java`),
    `package ${basePackage};

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class ${mainClass}Tests {

    @Test
    void contextLoads() {
    }
}
`,
    "utf-8",
  );

  // Dockerfile — multi-stage con Gradle wrapper
  await fs.writeFile(
    resolve(dir, "Dockerfile"),
    `FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY gradlew gradlew
COPY gradle gradle
COPY build.gradle .
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon
COPY src ./src
RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
`,
    "utf-8",
  );
}
