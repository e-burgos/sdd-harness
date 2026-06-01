import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../../utils/logger.js';
import { generateDockerCompose } from '../../generators/docker.generator.js';

/**
 * Parsea servicios existentes del docker-compose.yml
 */
function parseExistingServices(cwd: string): string[] {
  const composePath = resolve(cwd, 'docker-compose.yml');
  if (!existsSync(composePath)) return [];

  const content = readFileSync(composePath, 'utf-8');
  const services: string[] = [];
  const knownServices = ['postgres', 'redis', 'rabbitmq', 'minio'];

  for (const svc of knownServices) {
    // Buscar el servicio como key de primer nivel bajo services:
    if (new RegExp(`^\\s{2}${svc}:`, 'm').test(content)) {
      services.push(svc);
    }
  }

  return services;
}

export const addServiceCommand = defineCommand({
  meta: {
    name: 'service',
    description: 'Add a Docker service to the workspace',
  },
  args: {
    type: {
      type: 'positional',
      description: 'Service type (postgres, redis, rabbitmq, minio)',
      required: false,
    },
  },
  async run({ args }) {
    p.intro(pc.bgCyan(pc.black(' harness add service ')));

    const cwd = process.cwd();
    const existing = parseExistingServices(cwd);

    const allServices = [
      { value: 'postgres', label: 'PostgreSQL' },
      { value: 'redis', label: 'Redis' },
      { value: 'rabbitmq', label: 'RabbitMQ' },
      { value: 'minio', label: 'MinIO' },
    ];

    // Filtrar servicios ya existentes si no se pasa arg
    const available = allServices.filter((s) => !existing.includes(s.value));

    if (available.length === 0) {
      logger.info('All available services are already configured.');
      p.outro('');
      return;
    }

    let selectedServices: string[];

    if (args.type) {
      if (existing.includes(args.type)) {
        logger.warn(`Service "${args.type}" is already in docker-compose.yml`);
        p.outro('');
        return;
      }
      selectedServices = [args.type];
    } else {
      const selected = await p.multiselect({
        message: `Select services to add${existing.length > 0 ? ` (already configured: ${existing.join(', ')})` : ''}:`,
        options: available,
        required: true,
      });

      if (p.isCancel(selected)) {
        p.cancel('Operation cancelled.');
        process.exit(0);
      }

      selectedServices = selected as string[];
    }

    // Combinar existentes + nuevos
    const finalServices = [...existing, ...selectedServices];

    logger.step(
      `Generating docker-compose with services: ${finalServices.join(', ')}`,
    );

    try {
      await generateDockerCompose(cwd, finalServices);
      logger.success('docker-compose.yml updated');
      logger.success('.env.example updated');
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    p.outro(pc.green(`Services added: ${selectedServices.join(', ')}`));
  },
});
