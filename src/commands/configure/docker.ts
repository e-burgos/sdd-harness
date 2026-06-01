import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../../utils/logger.js';
import { generateDockerCompose } from '../../generators/docker.generator.js';

/**
 * Detecta servicios actualmente configurados
 */
function detectCurrentServices(cwd: string): string[] {
  const composePath = resolve(cwd, 'docker-compose.yml');
  if (!existsSync(composePath)) return [];

  const content = readFileSync(composePath, 'utf-8');
  const services: string[] = [];
  const knownServices = ['postgres', 'redis', 'rabbitmq', 'minio'];

  for (const svc of knownServices) {
    if (new RegExp(`^\\s{2}${svc}:`, 'm').test(content)) {
      services.push(svc);
    }
  }

  return services;
}

export const configureDockerCommand = defineCommand({
  meta: {
    name: 'docker',
    description: 'Generate or update docker-compose.yml',
  },
  async run() {
    p.intro(pc.bgCyan(pc.black(' harness configure docker ')));

    const cwd = process.cwd();
    const current = detectCurrentServices(cwd);

    const services = await p.multiselect({
      message: 'Select Docker services:',
      options: [
        { value: 'postgres', label: 'PostgreSQL' },
        { value: 'redis', label: 'Redis' },
        { value: 'rabbitmq', label: 'RabbitMQ' },
        { value: 'minio', label: 'MinIO' },
      ],
      initialValues: current,
      required: true,
    });

    if (p.isCancel(services)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    logger.step(
      `Generating docker-compose with: ${(services as string[]).join(', ')}`,
    );

    try {
      await generateDockerCompose(cwd, services as string[]);
      logger.success('docker-compose.yml regenerated');
      logger.success('.env.example updated');
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }

    p.outro(pc.green('Docker configured.'));
  },
});
