import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fs from 'fs-extra';
import { logger } from '../../utils/logger.js';
import { exec } from '../../utils/exec.js';

/**
 * Crea una spec con la estructura jerárquica v2.0 del sistema SDD:
 * sdd/specs/spec-[author]-[NNN]-[slug]/ con su .spec.md, cycles/ y fixes/,
 * registrada en sdd/specs/index.json (contador NNN per-author).
 */
export const addSpecCommand = defineCommand({
  meta: {
    name: 'spec',
    description: 'Add a new SDD specification (spec-[author]-[NNN]-[slug])',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Specification slug (lowercase kebab-case)',
      required: false,
    },
    author: {
      type: 'string',
      description: 'Author (GitHub username)',
    },
  },
  async run({ args }) {
    p.intro(pc.bgCyan(pc.black(' harness add spec ')));

    const cwd = process.cwd();

    const indexPath = resolve(cwd, 'sdd/specs/index.json');
    if (!existsSync(indexPath)) {
      logger.error(
        'No sdd/specs/index.json found. Make sure SDD is configured in this workspace.',
      );
      process.exit(1);
    }

    const slug =
      args.name ??
      (await p.text({
        message: 'Specification slug (lowercase kebab-case):',
        placeholder: 'e.g., user-onboarding, push-notifications',
        validate: (value) => {
          if (!value) return 'Specification slug is required';
          if (!/^[a-z0-9-]+$/.test(value)) return 'Must be lowercase kebab-case';
          return undefined;
        },
      }));

    if (p.isCancel(slug)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const author =
      args.author ??
      (await p.text({
        message: 'Author (GitHub username):',
        initialValue: detectGitHubUser(),
        validate: (value) => {
          if (!value) return 'Author is required';
          if (!/^[a-z0-9-]+$/.test(value))
            return 'Must be lowercase alphanumeric/dashes (GitHub username)';
          return undefined;
        },
      }));

    if (p.isCancel(author)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const title = await p.text({
      message: 'Specification title:',
      placeholder: `e.g., Core Features (defaults to "${slug}")`,
    });

    if (p.isCancel(title)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }
    const specTitle = (title as string) || (slug as string);

    const app = await p.text({
      message: 'Main app/lib affected (e.g., apps/my-api):',
      placeholder: 'apps/my-api',
      validate: (value) => {
        if (!value) return 'Required — SPEC GATE needs a target subproject';
        if (!/^(apps|libs|tools)\/[a-z][a-z0-9-]*$/.test(value))
          return 'Must match (apps|libs|tools)/[name]';
        return undefined;
      },
    });

    if (p.isCancel(app)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Contador NNN per-author (v2.0): siguiente correlativo del autor
    const index = await fs.readJSON(indexPath);
    const authorSpecs = (index.specs as Array<{ author: string }>).filter(
      (s) => s.author === author,
    );
    const nnn = String(authorSpecs.length + 1).padStart(3, '0');
    const specId = `spec-${author}-${nnn}-${slug}`;
    const specFolder = resolve(cwd, 'sdd/specs', specId);

    if (existsSync(specFolder)) {
      logger.error(`Spec folder already exists: sdd/specs/${specId}`);
      process.exit(1);
    }

    logger.step(`Creating spec structure: sdd/specs/${specId}/`);

    try {
      await fs.ensureDir(resolve(specFolder, 'cycles'));
      await fs.ensureDir(resolve(specFolder, 'fixes'));
      await fs.writeFile(resolve(specFolder, 'cycles/.gitkeep'), '', 'utf-8');
      await fs.writeFile(resolve(specFolder, 'fixes/.gitkeep'), '', 'utf-8');

      await fs.writeFile(
        resolve(specFolder, `${specId}.spec.md`),
        specTemplate(author, nnn, specTitle, app as string),
        'utf-8',
      );

      const today = new Date().toISOString().slice(0, 10);
      index.specs.push({
        id: specId,
        author,
        slug,
        folder: `sdd/specs/${specId}`,
        file: `sdd/specs/${specId}/${specId}.spec.md`,
        module: slug,
        app: app as string,
        status: 'in-progress',
        title: specTitle,
        created_at: today,
        completed_at: null,
        depends_on: [],
      });
      await fs.writeJSON(indexPath, index, { spaces: 2 });

      logger.success(`Spec created at sdd/specs/${specId}/${specId}.spec.md`);
      logger.success('Registered in sdd/specs/index.json');

      try {
        exec('node sdd/scripts/validate-sdd.mjs', { cwd, silent: true });
        logger.success('sdd:validate OK');
      } catch {
        logger.warn('Run `pnpm sdd:validate` to check the SDD registries.');
      }
    } catch (err) {
      logger.error('Failed to create specification: ' + (err as Error).message);
      process.exit(1);
    }

    p.outro(
      pc.green(
        `Spec "${specId}" ready. Next: sdd/prompts/start-sdd-cycle.prompt.md`,
      ),
    );
  },
});

function detectGitHubUser(): string {
  try {
    const user = exec('git config user.name', { silent: true }) ?? '';
    return user
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '');
  } catch {
    return '';
  }
}

function specTemplate(
  author: string,
  nnn: string,
  title: string,
  app: string,
): string {
  return `# SPEC-${author}-${nnn}: ${title}

## Resumen Ejecutivo

[Qué se construye, por qué y para quién.]

## Contexto de Negocio

[Problema que resuelve, usuarios afectados, impacto esperado.]

## Requisitos Funcionales (RF)

- RF-1: [Descripción]
- RF-2: [Descripción]

## Requisitos No-Funcionales (RNF)

- RNF-1: [Performance, seguridad, cobertura mínima, etc.]

## Dependencias

- Subproyecto principal: \`${app}\`
- [Módulos previos completados y APIs externas requeridas.]

## Criterios de Aceptación

- CA-001: [Condición verificable para considerar implementada la spec.]
`;
}
