import { z } from 'zod';
import type { HarnessConfig } from '../types/config.types.js';

// Debe cubrir los mismos tipos que el wizard (APP_TYPE_OPTIONS en commands/init.ts)
// y que `add app`: si no, la vía no interactiva genera menos que la interactiva.
const AppTypeSchema = z.enum([
  'nestjs',
  'react',
  'python',
  'nextjs',
  'fastify',
  'springboot',
  'hono',
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
  port: z.number().min(1000).max(65535).optional(),
  extensions: z.array(z.string()).optional(),
});

const LibTypeSchema = z.enum([
  'shared-types',
  'shared-utils',
  'ui-kit',
  'api-client',
  'config',
]);

const LibConfigSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, 'Lib name must be lowercase kebab-case'),
  type: LibTypeSchema,
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
  mode: z.enum(['nx', 'standalone']).default('nx'),
  project: z.object({
    name: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/, 'Project name must be lowercase kebab-case'),
    description: z.string().min(1),
    packageScope: z
      .string()
      .regex(/^@[a-z0-9-]+$/, 'Must be an npm scope like @my-project'),
  }),
  apps: z.array(AppConfigSchema).min(1),
  libs: z.array(LibConfigSchema).default([]),
  services: z.array(ServiceConfigSchema).default([]),
  sdd: SDDConfigSchema.optional(),
  nx: NxConfigSchema.optional(),
  infra: z
    .object({
      provider: InfraProviderSchema.optional(),
    })
    .optional(),
});

export type HarnessConfigInput = z.input<typeof HarnessConfigSchema>;

export function defineConfig(config: HarnessConfigInput): HarnessConfig {
  return HarnessConfigSchema.parse(config) as HarnessConfig;
}
