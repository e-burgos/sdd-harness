import { z } from 'zod';
import { MAX_CONFIG_BYTES } from './limits';

export const AbsPathInput = z
  .string()
  .min(1)
  .max(1024)
  .refine((value) => !value.includes('\0'), 'NUL not allowed');
export const ConfigDraft = z
  .record(z.string(), z.unknown())
  .refine((config) => new TextEncoder().encode(JSON.stringify(config)).length <= MAX_CONFIG_BYTES, 'config too large');
export const GenerationId = z.string().min(1).max(64);

export const ConfigCatalog = z.object({
  format: z.literal(1),
  cliVersion: z.string().max(40),
  modes: z
    .array(z.object({ mode: z.enum(['nx', 'standalone']), maxApps: z.number().int().positive().nullable(), libs: z.boolean() }))
    .max(4),
  appTypes: z
    .array(
      z.object({
        type: z.string().max(32),
        label: z.string().max(80),
        hint: z.string().max(200),
        role: z.enum(['frontend', 'backend']),
        defaultName: z.string().max(40),
        defaultPort: z.number().int(),
        stack: z.string().max(240),
        stackPlain: z.string().max(240).nullable(),
        workspaceOnly: z.boolean(),
        tucuUi: z.boolean(),
        ml: z.boolean(),
        shell: z.boolean(),
      }),
    )
    .max(32),
  libTypes: z.array(z.object({ type: z.string().max(32), label: z.string().max(80) })).max(16),
  serviceTypes: z
    .array(
      z.object({
        type: z.string().max(32),
        label: z.string().max(80),
        hint: z.string().max(200),
        defaultPort: z.number().int(),
        version: z.string().max(40),
      }),
    )
    .max(16),
  profiles: z.array(z.enum(['team', 'solo'])).max(4),
  patterns: z.object({ name: z.string().max(200), packageScope: z.string().max(200), author: z.string().max(200) }),
  portRange: z.object({ min: z.number().int(), max: z.number().int() }),
  targetDir: z.object({ tolerated: z.array(z.string().max(64)).max(64) }),
  limits: z
    .object({
      nameMax: z.number().int().positive(),
      packageScopeMax: z.number().int().positive(),
      maxApps: z.number().int().positive(),
      maxLibs: z.number().int().positive(),
      maxServices: z.number().int().positive(),
      configBytes: z.number().int().positive(),
    })
    .optional(),
  jsonSchema: z.record(z.string(), z.unknown()),
});
export type ConfigCatalog = z.infer<typeof ConfigCatalog>;

export const WizardCatalogResult = z.object({
  catalog: ConfigCatalog,
  initArgv: z.array(z.string().max(64)).max(16),
  home: z.string().max(1024),
  suggestedParent: z.string().max(1024),
  platform: z.enum(['posix', 'win32']),
});
export type WizardCatalogResult = z.infer<typeof WizardCatalogResult>;

export const ConfigIssue = z.object({
  severity: z.enum(['error', 'warning']),
  code: z.string().max(48),
  path: z.array(z.union([z.string().max(64), z.number().int().nonnegative()])).max(8),
  message: z.string().max(500),
});
export type ConfigIssue = z.infer<typeof ConfigIssue>;

export const ResolvedConfig = z.object({
  mode: z.enum(['nx', 'standalone']),
  project: z.object({ name: z.string().max(64), packageScope: z.string().max(64) }),
  apps: z
    .array(
      z.object({
        name: z.string().max(64),
        type: z.string().max(32),
        path: z.string().max(128),
        port: z.number().int(),
        portSource: z.enum(['explicit', 'default', 'shifted']),
        tucuUi: z.boolean().nullable(),
        ml: z.boolean(),
        shell: z.string().max(64).nullable(),
        route: z.string().max(80).nullable(),
        stack: z.string().max(240),
      }),
    )
    .max(32),
  libs: z.array(z.object({ name: z.string().max(64), type: z.string().max(32), path: z.string().max(128) })).max(32),
  services: z.array(z.object({ type: z.string().max(32), port: z.number().int(), version: z.string().max(40) })).max(16),
  dockerCompose: z.boolean(),
  profile: z.enum(['team', 'solo']),
});
export type ResolvedConfig = z.infer<typeof ResolvedConfig>;

export const ConfigValidation = z.object({
  format: z.literal(1),
  cliVersion: z.string().max(40),
  ok: z.boolean(),
  issues: z.array(ConfigIssue).max(100),
  resolved: ResolvedConfig.nullable(),
});
export type ConfigValidation = z.infer<typeof ConfigValidation>;

export const ConfigCliFailure = z.object({
  format: z.literal(1),
  cliVersion: z.string().max(40),
  ok: z.literal(false),
  error: z.object({ code: z.enum(['usage', 'unreadable']), message: z.string().max(500) }),
});
export type ConfigCliFailure = z.infer<typeof ConfigCliFailure>;

export const Preflight = z.object({
  node: z.object({ version: z.string().max(40) }),
  pnpm: z.object({ found: z.boolean(), version: z.string().max(40).nullable() }),
  git: z.object({ found: z.boolean(), identity: z.boolean() }),
  registry: z.object({ url: z.string().max(512).nullable(), reachable: z.enum(['yes', 'no', 'unknown']) }),
  ready: z.boolean(),
});
export type Preflight = z.infer<typeof Preflight>;

export const DirListing = z.object({
  path: z.string().max(1024),
  parent: z.string().max(1024).nullable(),
  entries: z.array(z.object({ name: z.string().max(255), symlink: z.boolean() })).max(500),
  truncated: z.boolean(),
});
export type DirListing = z.infer<typeof DirListing>;

export const TargetState = z.enum([
  'missing',
  'empty',
  'tolerated',
  'conflicting',
  'not-directory',
  'not-writable',
  'outside-allowed',
  'invalid',
]);
export type TargetState = z.infer<typeof TargetState>;

export const TargetCheck = z.object({
  input: z.string().max(1024),
  resolvedPath: z.string().max(1024).nullable(),
  state: TargetState,
  reason: z.string().max(40).nullable(),
  entries: z
    .object({
      count: z.number().int().nonnegative(),
      sample: z.array(z.string().max(255)).max(10),
      conflicting: z.array(z.string().max(255)).max(10),
      notable: z.array(z.enum(['.git', 'harness.config.json'])).max(2),
    })
    .nullable(),
  insideProject: z.boolean(),
  needsConfirmation: z.boolean(),
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/).nullable(),
});
export type TargetCheck = z.infer<typeof TargetCheck>;

export const GenerationStage = z.enum(['prepare', 'scaffold', 'install', 'generate', 'validate', 'build']);
export type GenerationStage = z.infer<typeof GenerationStage>;
export const GenerationStatus = z.enum(['running', 'succeeded', 'gate-failed', 'failed', 'cancelled', 'interrupted']);
export type GenerationStatus = z.infer<typeof GenerationStatus>;

export const GenerationState = z.object({
  id: z.string().max(64),
  target: z.string().max(1024),
  projectName: z.string().max(64),
  mode: z.enum(['nx', 'standalone']),
  cliVersion: z.string().max(40),
  argv: z.array(z.string().max(64)).max(16),
  status: GenerationStatus,
  stages: z
    .array(z.object({ stage: GenerationStage, status: z.enum(['pending', 'active', 'done', 'failed', 'skipped']) }))
    .length(6),
  gate: z.object({ validate: z.enum(['pending', 'pass', 'fail']), build: z.enum(['pending', 'pass', 'fail']) }),
  failure: z
    .object({
      stage: GenerationStage,
      kind: z.enum(['prepare', 'cli-missing', 'cli', 'install', 'network', 'pnpm-missing', 'gate', 'cancelled', 'signal']),
      message: z.string().max(2000),
    })
    .nullable(),
  exitCode: z.number().int().nullable(),
  hasSdd: z.boolean(),
  startedAt: z.string().max(40),
  finishedAt: z.string().max(40).nullable(),
  lastSeq: z.number().int().nonnegative(),
});
export type GenerationState = z.infer<typeof GenerationState>;

export const GenerateResult = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('started'), generation: GenerationState }),
  z.object({ outcome: z.literal('needs-confirmation'), check: TargetCheck }),
  z.object({ outcome: z.literal('blocked'), check: TargetCheck, reason: z.string().max(40).nullable() }),
  z.object({ outcome: z.literal('invalid-config'), validation: ConfigValidation }),
]);
export type GenerateResult = z.infer<typeof GenerateResult>;

export const GenerationOutputChunk = z.object({
  seq: z.number().int().positive(),
  stream: z.enum(['stdout', 'stderr']),
  chunk: z.string().max(32_768),
});
export type GenerationOutputChunk = z.infer<typeof GenerationOutputChunk>;

export const GenerationSnapshot = z.object({
  generation: GenerationState.nullable(),
  output: z.array(GenerationOutputChunk),
  truncatedBefore: z.boolean(),
  hasMore: z.boolean(),
});
export type GenerationSnapshot = z.infer<typeof GenerationSnapshot>;

export const WorkspaceOpenResult = z.object({ root: z.string().max(1024), project: z.string().max(128) });
export type WorkspaceOpenResult = z.infer<typeof WorkspaceOpenResult>;
