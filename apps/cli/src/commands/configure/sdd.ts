import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { logger } from '../../utils/logger.js';
import { generateSDD } from '../../generators/sdd.generator.js';
import type { WorkspaceOptions } from '../../generators/workspace.generator.js';

/**
 * Modo "sdd-harness": instala (o reinstala) el sistema SDD portable en un
 * proyecto YA existente, sin tocar su código:
 * - Detecta la forma del repo: monorepo Nx (apps/) o standalone (código en raíz).
 * - Inyecta scripts sdd:* + setup:agents y ajv/ajv-formats en el package.json
 *   (lo crea mínimo si el repo no es Node — Java/Python puros).
 * - Absorbe AGENTS.md/CLAUDE.md preexistentes dentro de sdd/dual-harness antes
 *   de reemplazarlos por symlinks — no se pierde ninguna instrucción previa.
 */
export const configureSddCommand = defineCommand({
  meta: {
    name: 'sdd',
    description:
      'Install the portable SDD system + dual harness on an existing project',
  },
  async run() {
    p.intro(pc.bgCyan(pc.black(' harness configure sdd ')));

    const cwd = process.cwd();

    const globalPath = resolve(cwd, 'sdd/global.json');
    if (existsSync(globalPath)) {
      const confirm = await p.confirm({
        message:
          'SDD is already installed. This will RESET the whole sdd/ directory (specs, cycles and fixes included). Continue?',
        initialValue: false,
      });

      if (!confirm || p.isCancel(confirm)) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }
    }

    // Nombre: package.json si existe; si no, la carpeta del repo
    const pkgPath = resolve(cwd, 'package.json');
    const pkg = existsSync(pkgPath)
      ? JSON.parse(readFileSync(pkgPath, 'utf-8'))
      : null;
    const defaultName =
      pkg?.name?.replace(/^@[^/]+\//, '') || basename(cwd);

    const projectName = await p.text({
      message: 'Project name (stored only in sdd/global.json):',
      initialValue: defaultName,
      validate: (value) => (value ? undefined : 'Project name is required'),
    });

    if (p.isCancel(projectName)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const description = await p.text({
      message: 'Project description (stored only in sdd/global.json):',
      placeholder: 'What it does, main stack, methodology (SDD)',
      initialValue: pkg?.description || '',
    });

    if (p.isCancel(description)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Detección de forma: Nx monorepo (apps/) vs standalone (código en raíz)
    const isNxLayout =
      existsSync(resolve(cwd, 'nx.json')) || existsSync(resolve(cwd, 'apps'));

    const apps: Array<{ name: string; type: string }> = [];
    if (isNxLayout) {
      const appsDir = resolve(cwd, 'apps');
      if (existsSync(appsDir)) {
        for (const d of readdirSync(appsDir, { withFileTypes: true })) {
          if (!d.isDirectory()) continue;
          apps.push({ name: d.name, type: detectAppType(resolve(appsDir, d.name)) });
        }
      }
    } else {
      apps.push({
        name: projectName as string,
        type: detectAppType(cwd),
      });
    }

    p.note(
      [
        `${pc.bold('Layout:')} ${isNxLayout ? 'Nx monorepo' : 'standalone (repo = una app lógica)'}`,
        `${pc.bold('Apps registradas:')} ${apps.map((a) => `${a.name} (${a.type})`).join(', ') || 'none'}`,
        `${pc.bold('package.json:')} ${pkg ? 'merge de scripts sdd:* + ajv' : 'se crea uno mínimo para el arnés'}`,
        `${pc.bold('AGENTS.md/CLAUDE.md previos:')} se absorben en sdd/dual-harness`,
      ].join('\n'),
      'Install plan',
    );

    logger.step('Installing portable SDD system...');

    const opts: WorkspaceOptions = {
      projectName: projectName as string,
      description: (description as string) || '',
      packageScope: pkg?.name?.startsWith('@')
        ? pkg.name.split('/')[0]
        : `@${projectName}`,
      apps,
      libs: [],
      services: [],
    };

    try {
      await generateSDD(cwd, opts, {
        layout: isNxLayout ? 'nx' : 'standalone',
        mergePackageJson: true,
        absorbExistingHarness: true,
      });

      logger.success(
        'sdd/ installed (agents, skills, prompts, schemas, docs viewer, templates)',
      );
      logger.success(
        'package.json updated: sdd:* scripts + ajv/ajv-formats devDependencies',
      );
      logger.success(
        'Harness symlinks created (.claude/, .github/, AGENTS.md, CLAUDE.md)',
      );
      logger.info(
        'Run your package manager install (pnpm install) so sdd:validate finds ajv.',
      );
      logger.info(
        'Complete the [...] markers in sdd/context/ — the project name lives ONLY in sdd/global.json.',
      );
      logger.info(
        'Create specs with `harness add spec` and validate with `pnpm sdd:validate`.',
      );
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    p.outro(pc.green('SDD configured.'));
  },
});

/** Heurística mínima de tipo por marcadores del stack — solo informativa. */
function detectAppType(dir: string): string {
  if (existsSync(resolve(dir, 'pom.xml'))) return 'springboot';
  if (existsSync(resolve(dir, 'build.gradle'))) return 'springboot';
  if (existsSync(resolve(dir, 'pyproject.toml'))) return 'python';
  if (existsSync(resolve(dir, 'next.config.js')) || existsSync(resolve(dir, 'next.config.ts')))
    return 'nextjs';
  if (existsSync(resolve(dir, 'nest-cli.json'))) return 'nestjs';
  if (existsSync(resolve(dir, 'vite.config.ts'))) return 'react';
  return 'app';
}
