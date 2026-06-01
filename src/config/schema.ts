import { z } from 'zod';
import type { HarnessConfig } from '../types/config.types.js';

const AppTypeSchema = z.enum([
  'nestjs',
  'react',
  'python',
  'nextjs',
  'fastify',
]);
const ServiceTypeSchema = z.enum(['postgres', 'redis', 'rabbitmq', 'minio']);
const InfraProviderSchema = z.enum([
  'digitalocean',
  'aws',
  'gcp',
  'vercel',
  'railway',
]);

const AppConfigSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, 'App name must be lowercase kebab-case'),
  type: AppTypeSchema,
  port: z.number().min(1000).max(65535).optional(),
  features: z.array(z.string()).default([]),
});

const ServiceConfigSchema = z.object({
  type: ServiceTypeSchema,
  version: z.string().optional(),
  port: z.number().min(1000).max(65535),
  extensions: z.array(z.string()).optional(),
});

const CycleConfigSchema = z.object({
  cycle: z.number().positive(),
  modules: z.array(z.string()),
  weeks: z.number().positive(),
});

const SDDConfigSchema = z.object({
  enabled: z.boolean().default(true),
  modules: z.array(z.string()),
  cycles: z.array(CycleConfigSchema).optional(),
  skills: z
    .object({
      include: z.array(z.string()).default(['sdd-*', 'generate-*', 'nx-*']),
      custom: z.array(z.string()).default([]),
    })
    .optional(),
  agents: z
    .object({
      instructionFile: z.string().default('AGENTS.md'),
      claudeFile: z.string().default('CLAUDE.md'),
      copilotInstructions: z.boolean().default(true),
    })
    .optional(),
});

const NxConfigSchema = z.object({
  plugins: z.array(z.string()),
  defaultProject: z.string().optional(),
});

export const HarnessConfigSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    packageScope: z.string().startsWith('@'),
  }),
  apps: z.array(AppConfigSchema).min(1),
  services: z.array(ServiceConfigSchema).default([]),
  sdd: SDDConfigSchema.optional(),
  nx: NxConfigSchema,
  infra: z
    .object({
      provider: InfraProviderSchema.optional(),
    })
    .optional(),
});

export function defineConfig(config: HarnessConfig): HarnessConfig {
  return HarnessConfigSchema.parse(config);
}
