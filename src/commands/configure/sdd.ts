import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../../utils/logger.js';
import { generateSDD } from '../../generators/sdd.generator.js';
import { writeRenderedTemplate } from '../../utils/fs.js';
import type { WorkspaceOptions } from '../../generators/workspace.generator.js';

export const configureSddCommand = defineCommand({
  meta: {
    name: 'sdd',
    description: 'Configure SDD (Spec-Driven Development) agent harness',
  },
  async run() {
    p.intro(pc.bgCyan(pc.black(' harness configure sdd ')));

    const cwd = process.cwd();

    // Verificar que sea un workspace válido
    const pkgPath = resolve(cwd, 'package.json');
    if (!existsSync(pkgPath)) {
      logger.error('No package.json found. Run this from the workspace root.');
      process.exit(1);
    }

    // Advertir si ya existe configuración SDD
    const globalPath = resolve(cwd, 'sdd/global.json');
    if (existsSync(globalPath)) {
      const confirm = await p.confirm({
        message:
          'SDD is already configured. This will RESET all sdd files. Continue?',
        initialValue: false,
      });

      if (!confirm || p.isCancel(confirm)) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }
    }

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const projectName = pkg.name?.replace(/^@[^/]+\//, '') || 'project';

    const description = await p.text({
      message: 'Project description/vision:',
      placeholder: 'Brief description of the project',
      initialValue: pkg.description || '',
    });

    if (p.isCancel(description)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Stack Tecnológico (Opcional)
    const frontendStack = await p.text({
      message: 'Frontend stack/technologies (optional, e.g. React 19, Zustand):',
      placeholder: 'React, Vite',
    });
    if (p.isCancel(frontendStack)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const backendStack = await p.text({
      message: 'Backend stack/technologies (optional, e.g. NestJS, Prisma):',
      placeholder: 'NestJS, PostgreSQL',
    });
    if (p.isCancel(backendStack)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Loop interactivo para agregar especificaciones (specs) iniciales
    const specsToAdd: Array<{ name: string; title: string; description: string }> = [];
    const addSpecs = await p.confirm({
      message: 'Do you want to define initial specifications (specs) interactively?',
      initialValue: false,
    });

    if (addSpecs && !p.isCancel(addSpecs)) {
      let adding = true;
      let count = 1;
      while (adding) {
        const specName = await p.text({
          message: `Spec #${count} name (lowercase kebab-case, e.g., auth, billing):`,
          validate: (val) => {
            if (!val) return 'Name is required';
            if (!/^[a-z0-9-]+$/.test(val)) return 'Must be lowercase kebab-case';
            return undefined;
          }
        });
        if (p.isCancel(specName) || !specName) break;

        const specTitle = await p.text({
          message: `Spec #${count} Title (e.g., Authentication & Authorization):`,
          placeholder: specName,
        });
        if (p.isCancel(specTitle)) break;

        const specDesc = await p.text({
          message: `Spec #${count} brief description:`,
          placeholder: 'Scope and objective of this spec',
        });
        if (p.isCancel(specDesc)) break;

        specsToAdd.push({
          name: specName,
          title: specTitle || specName,
          description: specDesc || '',
        });

        const next = await p.confirm({
          message: 'Add another specification?',
          initialValue: false,
        });
        if (!next || p.isCancel(next)) {
          adding = false;
        }
        count++;
      }
    }

    // Detectar apps existentes
    const appsDir = resolve(cwd, 'apps');
    const apps: Array<{ name: string; type: string }> = [];
    if (existsSync(appsDir)) {
      const appDirs = readdirSync(appsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .filter((d) => existsSync(resolve(appsDir, d.name, 'project.json')));

      for (const d of appDirs) {
        apps.push({ name: d.name, type: 'unknown' });
      }
    }

    logger.step('Regenerating SDD infrastructure...');

    const opts: WorkspaceOptions = {
      projectName,
      description: (description as string) || '',
      packageScope: pkg.name?.startsWith('@')
        ? pkg.name.split('/')[0]
        : `@${projectName}`,
      apps,
      libs: [],
      services: [],
      frontendStack: (frontendStack as string) || '',
      backendStack: (backendStack as string) || '',
    };

    try {
      await generateSDD(cwd, opts);

      // Crear specs iniciales definidas interactivamente
      for (let i = 0; i < specsToAdd.length; i++) {
        const num = String(i + 1).padStart(2, '0');
        const spec = specsToAdd[i];
        await writeRenderedTemplate(
          'sdd/specs/spec.md.ejs',
          resolve(cwd, `sdd/specs/${num}-${spec.name}.md`),
          {
            spec: {
              number: num,
              title: spec.title,
              description: spec.description,
            }
          }
        );
      }

      logger.success('sdd/ files regenerated');
      logger.success('AGENTS.md regenerated');
      logger.success('CLAUDE.md regenerated');
      if (specsToAdd.length > 0) {
        logger.success(`${specsToAdd.length} specification files created under sdd/specs/`);
      }
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    p.outro(pc.green('SDD configured.'));
  },
});
