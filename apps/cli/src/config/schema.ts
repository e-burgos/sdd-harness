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

// Un módulo del backlog inicial: string (slug) o forma extendida. Cada uno se siembra
// en `init` como spec `draft` (spec-<sdd.author>-NNN-<slug>) + entrada en pending_modules.
const SubprojectRefSchema = z
  .string()
  .regex(/^(apps|libs|tools)\/[a-z][a-z0-9-]*$/, 'Must match (apps|libs|tools)/[name]');

const ModuleSeedSchema = z.union([
  z.string().regex(/^[a-z0-9-]+$/, 'Module slug must be lowercase kebab-case'),
  z.object({
    name: z.string().regex(/^[a-z0-9-]+$/, 'Module slug must be lowercase kebab-case'),
    title: z.string().optional(),
    description: z.string().optional(),
    /** Subproyecto principal (apps/x). Default: la primera app del config. */
    app: SubprojectRefSchema.optional(),
    /** Todos los subproyectos afectados. Default: [app]. */
    apps: z.array(SubprojectRefSchema).optional(),
    /** Slugs de otros módulos del mismo config (se resuelven a spec ids en orden). */
    depends_on: z.array(z.string()).default([]),
  }),
]);

const SDDConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** GitHub user que firma las specs sembradas (spec-<author>-NNN-<slug>). Default: git config user.name. */
  author: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Author must be a lowercase GitHub username')
    .optional(),
  modules: z.array(ModuleSeedSchema).default([]),
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

// Scopes npm privados → `.npmrc` del repo (`@org:registry=https://npm.pkg.github.com`).
// Solo la URL: la credencial vive en ~/.npmrc local y NODE_AUTH_TOKEN en CI.
const NpmScopeSchema = z.object({
  scope: z.string().regex(/^@[a-z0-9-]+$/, 'Must be an npm scope like @my-org'),
  registry: z.string().url('registry must be a URL'),
});

const NpmConfigSchema = z.object({
  scopes: z.array(NpmScopeSchema).default([]),
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
  npm: NpmConfigSchema.optional(),
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
