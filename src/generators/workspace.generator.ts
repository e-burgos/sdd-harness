import { resolve } from 'node:path';
import fs from 'fs-extra';
import { writeRenderedTemplate } from '../utils/fs.js';
import { exec } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import { generateDockerCompose } from './docker.generator.js';
import { generateSDD } from './sdd.generator.js';
import { generateApp } from './app.generator.js';
import { generateLib } from './lib.generator.js';

export interface WorkspaceOptions {
  projectName: string;
  description: string;
  packageScope: string;
  apps: Array<{ name: string; type: string }>;
  libs: Array<{ name: string; type: string }>;
  services: string[];
  frontendStack?: string;
  backendStack?: string;
}

/**
 * Genera un workspace Nx completo desde cero
 */
export async function generateWorkspace(opts: WorkspaceOptions): Promise<void> {
  const root = resolve(process.cwd(), opts.projectName);

  // Verificar que no exista
  if (await fs.pathExists(root)) {
    throw new Error(`El directorio "${opts.projectName}" ya existe.`);
  }

  logger.step('Creando estructura de directorios...');
  await fs.ensureDir(root);
  await fs.ensureDir(resolve(root, 'apps'));
  await fs.ensureDir(resolve(root, 'libs'));
  await fs.ensureDir(resolve(root, 'tools'));
  await fs.ensureDir(resolve(root, 'infra'));
  await fs.ensureDir(resolve(root, 'docs'));

  // Datos del template
  const templateData = {
    project: {
      name: opts.projectName,
      description: opts.description,
      packageScope: opts.packageScope,
    },
    apps: opts.apps,
    services: opts.services,
    nx: {
      plugins: getNxPlugins(opts.apps),
      defaultProject: opts.apps[0]?.name ?? 'app',
    },
  };

  // Archivos root del workspace
  logger.step('Generando archivos de configuración...');
  await writeRenderedTemplate(
    'workspace/package.json.ejs',
    resolve(root, 'package.json'),
    templateData,
  );
  await writeRenderedTemplate(
    'workspace/nx.json.ejs',
    resolve(root, 'nx.json'),
    templateData,
  );
  await writeRenderedTemplate(
    'workspace/pnpm-workspace.yaml.ejs',
    resolve(root, 'pnpm-workspace.yaml'),
    templateData,
  );
  await writeRenderedTemplate(
    'workspace/tsconfig.base.json.ejs',
    resolve(root, 'tsconfig.base.json'),
    templateData,
  );
  await writeRenderedTemplate(
    'workspace/.gitignore.ejs',
    resolve(root, '.gitignore'),
    templateData,
  );
  await writeRenderedTemplate(
    'workspace/eslint.config.mjs.ejs',
    resolve(root, 'eslint.config.mjs'),
    templateData,
  );

  // Docker Compose
  if (opts.services.length > 0) {
    logger.step('Generando Docker Compose...');
    await generateDockerCompose(root, opts.services);
  }

  // SDD (siempre incluido)
  logger.step('Configurando SDD (Spec-Driven Development)...');
  await generateSDD(root, opts);

  // Apps
  for (const app of opts.apps) {
    logger.step(`Generando app: ${app.name} (${app.type})...`);
    await generateApp(root, app, opts.packageScope);
  }

  // Libs
  for (const lib of opts.libs) {
    logger.step(`Generando lib: ${lib.name} (${lib.type})...`);
    await generateLib(root, lib, opts.packageScope);
  }

  // Git init
  logger.step('Inicializando repositorio git...');
  exec('git init', { cwd: root, silent: true });
  exec('git add -A', { cwd: root, silent: true });
  exec('git commit -m "chore: initial workspace setup via @e-burgos/harness"', {
    cwd: root,
    silent: true,
  });

  // Instalar dependencias
  logger.step('Instalando dependencias (pnpm install)...');
  exec('pnpm install', { cwd: root });

  logger.success(`Workspace "${opts.projectName}" creado exitosamente.`);
}

function getNxPlugins(apps: Array<{ name: string; type: string }>): string[] {
  const plugins = new Set<string>();
  plugins.add('@nx/js');

  for (const app of apps) {
    switch (app.type) {
      case 'nestjs':
        plugins.add('@nx/nest');
        plugins.add('@nx/node');
        break;
      case 'react':
        plugins.add('@nx/react');
        plugins.add('@nx/vite');
        break;
      case 'nextjs':
        plugins.add('@nx/next');
        plugins.add('@nx/react');
        break;
      case 'fastify':
        plugins.add('@nx/node');
        break;
      case 'python':
        // No nx plugin nativo, se maneja manual
        break;
    }
  }

  return Array.from(plugins);
}
