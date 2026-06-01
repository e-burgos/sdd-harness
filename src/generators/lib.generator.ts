import { resolve } from 'node:path';
import fs from 'fs-extra';

/**
 * Genera el scaffold de una librería compartida según su tipo
 */
export async function generateLib(
  root: string,
  lib: { name: string; type: string },
  packageScope: string,
): Promise<void> {
  const libDir = resolve(root, 'libs', lib.name);
  await fs.ensureDir(libDir);

  switch (lib.type) {
    case 'shared-types':
      await generateTypesLib(libDir, lib.name, packageScope);
      break;
    case 'shared-utils':
      await generateUtilsLib(libDir, lib.name, packageScope);
      break;
    case 'ui-kit':
      await generateUILib(libDir, lib.name, packageScope);
      break;
    case 'api-client':
      await generateApiClientLib(libDir, lib.name, packageScope);
      break;
    case 'config':
      await generateConfigLib(libDir, lib.name, packageScope);
      break;
  }
}

// ─── Shared Types ────────────────────────────────────────────────────────────

async function generateTypesLib(
  dir: string,
  name: string,
  scope: string,
): Promise<void> {
  await fs.ensureDir(resolve(dir, 'src'));

  await fs.writeFile(
    resolve(dir, 'project.json'),
    JSON.stringify(
      {
        name,
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: `libs/${name}/src`,
        projectType: 'library',
        tags: ['scope:shared', 'type:types'],
        targets: {
          lint: {
            executor: '@nx/eslint:lint',
          },
        },
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          module: 'ESNext',
          forceConsistentCasingInFileNames: true,
          strict: true,
          noImplicitOverride: true,
          noPropertyAccessFromIndexSignature: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
        },
        files: [],
        include: [],
        references: [{ path: './tsconfig.lib.json' }],
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'tsconfig.lib.json'),
    JSON.stringify(
      {
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          declaration: true,
          types: ['node'],
        },
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.spec.ts'],
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'src', 'index.ts'),
    `// ${scope}/${name} — Tipos compartidos del workspace
export {};
`,
  );
}

// ─── Shared Utils ────────────────────────────────────────────────────────────

async function generateUtilsLib(
  dir: string,
  name: string,
  scope: string,
): Promise<void> {
  await fs.ensureDir(resolve(dir, 'src'));

  await fs.writeFile(
    resolve(dir, 'project.json'),
    JSON.stringify(
      {
        name,
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: `libs/${name}/src`,
        projectType: 'library',
        tags: ['scope:shared', 'type:utils'],
        targets: {
          lint: { executor: '@nx/eslint:lint' },
          test: {
            executor: '@nx/vite:test',
            options: { passWithNoTests: true },
          },
        },
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '../../tsconfig.base.json',
        compilerOptions: { strict: true },
        files: [],
        include: [],
        references: [
          { path: './tsconfig.lib.json' },
          { path: './tsconfig.spec.json' },
        ],
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'tsconfig.lib.json'),
    JSON.stringify(
      {
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          declaration: true,
          types: ['node'],
        },
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.spec.ts'],
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'tsconfig.spec.json'),
    JSON.stringify(
      {
        extends: './tsconfig.json',
        compilerOptions: { outDir: '../../dist/out-tsc', types: ['vitest'] },
        include: ['src/**/*.spec.ts'],
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'src', 'index.ts'),
    `// ${scope}/${name} — Utilidades compartidas
export {};
`,
  );
}

// ─── UI Kit ──────────────────────────────────────────────────────────────────

async function generateUILib(
  dir: string,
  name: string,
  scope: string,
): Promise<void> {
  await fs.ensureDir(resolve(dir, 'src'));

  await fs.writeFile(
    resolve(dir, 'project.json'),
    JSON.stringify(
      {
        name,
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: `libs/${name}/src`,
        projectType: 'library',
        tags: ['scope:shared', 'type:ui'],
        targets: {
          lint: { executor: '@nx/eslint:lint' },
          test: {
            executor: '@nx/vite:test',
            options: { passWithNoTests: true },
          },
        },
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '../../tsconfig.base.json',
        compilerOptions: { strict: true, jsx: 'react-jsx' },
        files: [],
        include: [],
        references: [
          { path: './tsconfig.lib.json' },
          { path: './tsconfig.spec.json' },
        ],
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'tsconfig.lib.json'),
    JSON.stringify(
      {
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          declaration: true,
          types: ['node'],
        },
        include: ['src/**/*.ts', 'src/**/*.tsx'],
        exclude: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'tsconfig.spec.json'),
    JSON.stringify(
      {
        extends: './tsconfig.json',
        compilerOptions: { outDir: '../../dist/out-tsc', types: ['vitest'] },
        include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'src', 'index.ts'),
    `// ${scope}/${name} — Componentes UI compartidos
export {};
`,
  );
}

// ─── API Client ──────────────────────────────────────────────────────────────

async function generateApiClientLib(
  dir: string,
  name: string,
  scope: string,
): Promise<void> {
  await fs.ensureDir(resolve(dir, 'src'));

  await fs.writeFile(
    resolve(dir, 'project.json'),
    JSON.stringify(
      {
        name,
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: `libs/${name}/src`,
        projectType: 'library',
        tags: ['scope:shared', 'type:data-access'],
        targets: {
          lint: { executor: '@nx/eslint:lint' },
          test: {
            executor: '@nx/vite:test',
            options: { passWithNoTests: true },
          },
        },
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '../../tsconfig.base.json',
        compilerOptions: { strict: true },
        files: [],
        include: [],
        references: [{ path: './tsconfig.lib.json' }],
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'tsconfig.lib.json'),
    JSON.stringify(
      {
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          declaration: true,
          types: ['node'],
        },
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.spec.ts'],
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'src', 'index.ts'),
    `// ${scope}/${name} — HTTP client tipado para consumir el API
export {};
`,
  );
}

// ─── Config ──────────────────────────────────────────────────────────────────

async function generateConfigLib(
  dir: string,
  name: string,
  scope: string,
): Promise<void> {
  await fs.ensureDir(resolve(dir, 'src'));

  await fs.writeFile(
    resolve(dir, 'project.json'),
    JSON.stringify(
      {
        name,
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: `libs/${name}/src`,
        projectType: 'library',
        tags: ['scope:shared', 'type:config'],
        targets: {
          lint: { executor: '@nx/eslint:lint' },
        },
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '../../tsconfig.base.json',
        compilerOptions: { strict: true },
        files: [],
        include: [],
        references: [{ path: './tsconfig.lib.json' }],
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'tsconfig.lib.json'),
    JSON.stringify(
      {
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          declaration: true,
          types: ['node'],
        },
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.spec.ts'],
      },
      null,
      2,
    ),
  );

  await fs.writeFile(
    resolve(dir, 'src', 'index.ts'),
    `// ${scope}/${name} — Configuración compartida (env, constants, schemas)
export {};
`,
  );
}
