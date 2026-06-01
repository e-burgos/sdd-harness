import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../../utils/logger.js';
import { generateApp } from '../../generators/app.generator.js';

export const addAppCommand = defineCommand({
  meta: {
    name: 'app',
    description: 'Add a new app to the workspace',
  },
  args: {
    type: {
      type: 'positional',
      description: 'App type (nestjs, react, python, nextjs, fastify)',
      required: false,
    },
    name: {
      type: 'string',
      description: 'App name',
    },
  },
  async run({ args }) {
    p.intro(pc.bgCyan(pc.black(' harness add app ')));

    const cwd = process.cwd();

    // Leer scope del package.json del workspace
    const pkgPath = resolve(cwd, 'package.json');
    if (!existsSync(pkgPath)) {
      logger.error('No package.json found. Run this from the workspace root.');
      process.exit(1);
    }
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const packageScope = pkg.name?.startsWith('@')
      ? pkg.name.split('/')[0]
      : `@${pkg.name || 'app'}`;

    const appType =
      args.type ??
      (await p.select({
        message: 'App type:',
        options: [
          { value: 'nestjs', label: 'NestJS API' },
          { value: 'react', label: 'React SPA' },
          { value: 'nextjs', label: 'Next.js' },
          { value: 'python', label: 'Python Agent' },
          { value: 'fastify', label: 'Fastify API' },
        ],
      }));

    if (p.isCancel(appType)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    const appName =
      args.name ??
      (await p.text({
        message: 'App name:',
        placeholder: 'my-app',
        validate: (value) => {
          if (!value) return 'App name is required';
          if (!/^[a-z][a-z0-9-]*$/.test(value))
            return 'Must be lowercase kebab-case';
          return undefined;
        },
      }));

    if (p.isCancel(appName)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Verificar que no exista ya
    const appDir = resolve(cwd, 'apps', appName as string);
    if (existsSync(appDir)) {
      logger.error(`App "${appName}" already exists at apps/${appName}`);
      process.exit(1);
    }

    logger.step(`Adding ${appType} app: ${appName}`);

    try {
      await generateApp(
        cwd,
        { name: appName as string, type: appType as string },
        packageScope,
      );
      logger.success(`App "${appName}" generated at apps/${appName}`);
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    p.outro(pc.green(`App "${appName}" added successfully.`));
  },
});
