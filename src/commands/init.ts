import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { logger } from '../utils/logger.js';
import { generateWorkspace } from '../generators/index.js';

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize a new AI-agent-ready Nx monorepo',
  },
  args: {
    name: {
      type: 'string',
      description: 'Project name',
    },
    config: {
      type: 'string',
      description: 'Path to harness.config.ts',
    },
    yes: {
      type: 'boolean',
      alias: 'y',
      description: 'Skip confirmation prompts',
      default: false,
    },
  },
  async run({ args }) {
    p.intro(pc.bgCyan(pc.black(' harness init ')));

    // Step 1: Project name
    const projectName =
      args.name ??
      (await p.text({
        message: 'Project name (Nx workspace):',
        placeholder: 'my-project',
        validate: (value) => {
          if (!value) return 'Project name is required';
          if (!/^[a-z][a-z0-9-]*$/.test(value))
            return 'Must be lowercase kebab-case';
          return undefined;
        },
      }));

    if (p.isCancel(projectName)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Step 2: Description
    const description = await p.text({
      message: 'Project description:',
      placeholder: 'A brief description of your project',
    });

    if (p.isCancel(description)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Step 3: Package scope
    const packageScope = await p.text({
      message: 'npm package scope:',
      placeholder: `@${projectName}`,
      initialValue: `@${projectName}`,
      validate: (value) => {
        if (!value.startsWith('@')) return 'Must start with @';
        return undefined;
      },
    });

    if (p.isCancel(packageScope)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Step 4: Apps
    const appTypes = await p.multiselect({
      message: 'Which apps do you want to create?',
      options: [
        {
          value: 'nestjs',
          label: 'NestJS API',
          hint: 'Backend REST/WebSocket API',
        },
        { value: 'react', label: 'React SPA', hint: 'Vite + React 19' },
        {
          value: 'nextjs',
          label: 'Next.js',
          hint: 'Full-stack React framework',
        },
        {
          value: 'python',
          label: 'Python Agent',
          hint: 'Python 3.11+ service',
        },
        {
          value: 'fastify',
          label: 'Fastify API',
          hint: 'Lightweight Node.js API',
        },
      ],
      required: true,
    });

    if (p.isCancel(appTypes)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Step 5: Ask name for each app
    const apps: Array<{ name: string; type: string }> = [];
    for (const type of appTypes as string[]) {
      const defaultName =
        type === 'nestjs'
          ? 'api'
          : type === 'react'
            ? 'webapp'
            : type === 'nextjs'
              ? 'web'
              : type === 'fastify'
                ? 'api'
                : type;
      const appName = await p.text({
        message: `Name for ${type} app:`,
        placeholder: defaultName,
        initialValue: defaultName,
        validate: (value) => {
          if (!value) return 'App name is required';
          if (!/^[a-z][a-z0-9-]*$/.test(value))
            return 'Must be lowercase kebab-case';
          return undefined;
        },
      });

      if (p.isCancel(appName)) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }

      apps.push({ name: appName as string, type });
    }

    // Step 6: Libs
    const libTypes = await p.multiselect({
      message: 'Which shared libraries do you want?',
      options: [
        {
          value: 'shared-types',
          label: 'Shared Types',
          hint: 'TypeScript interfaces & DTOs',
        },
        {
          value: 'shared-utils',
          label: 'Shared Utils',
          hint: 'Helper functions & validators',
        },
        {
          value: 'ui-kit',
          label: 'UI Kit',
          hint: 'Shared React components',
        },
        {
          value: 'api-client',
          label: 'API Client',
          hint: 'Typed HTTP client for backend',
        },
        {
          value: 'config',
          label: 'Config',
          hint: 'Env vars, constants, schemas',
        },
      ],
      required: false,
    });

    if (p.isCancel(libTypes)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Nombres para cada lib
    const libs: Array<{ name: string; type: string }> = [];
    for (const type of libTypes as string[]) {
      const libName = await p.text({
        message: `Name for ${type} lib:`,
        placeholder: type,
        initialValue: type,
        validate: (value) => {
          if (!value) return 'Lib name is required';
          if (!/^[a-z][a-z0-9-]*$/.test(value))
            return 'Must be lowercase kebab-case';
          return undefined;
        },
      });

      if (p.isCancel(libName)) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }

      libs.push({ name: libName as string, type });
    }

    // Step 7: Services (Docker)
    const services = await p.multiselect({
      message: 'Which Docker services do you need?',
      options: [
        { value: 'postgres', label: 'PostgreSQL', hint: 'Relational DB' },
        { value: 'redis', label: 'Redis', hint: 'Cache & queues' },
        { value: 'rabbitmq', label: 'RabbitMQ', hint: 'Message broker' },
        { value: 'minio', label: 'MinIO', hint: 'S3-compatible storage' },
      ],
      required: false,
    });

    if (p.isCancel(services)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Summary (SDD siempre incluido)
    p.note(
      [
        `${pc.bold('Project:')} ${projectName}`,
        `${pc.bold('Scope:')} ${packageScope}`,
        `${pc.bold('Apps:')} ${apps.map((a) => `${a.name} (${a.type})`).join(', ')}`,
        `${pc.bold('Libs:')} ${libs.map((l) => l.name).join(', ') || 'none'}`,
        `${pc.bold('Services:')} ${(services as string[]).join(', ') || 'none'}`,
        `${pc.bold('SDD:')} enabled (always)`,
      ].join('\n'),
      'Configuration Summary',
    );

    const confirmed =
      args.yes ||
      (await p.confirm({
        message: 'Proceed with this configuration?',
        initialValue: true,
      }));

    if (!confirmed || p.isCancel(confirmed)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    // Execute generators
    logger.title('Generating workspace...');

    try {
      await generateWorkspace({
        projectName: projectName as string,
        description: (description as string) || '',
        packageScope: packageScope as string,
        apps,
        libs,
        services: services as string[],
      });
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    p.outro(pc.green('Done! Your workspace is ready.'));
  },
});
