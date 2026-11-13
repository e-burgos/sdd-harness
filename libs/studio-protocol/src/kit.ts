import { z } from 'zod';
import { MAX_KIT_ENTRIES } from './limits';
import { GateMode, KitToolsState } from './snapshot';

export const KIT_SECTIONS = ['docs', 'schemas', 'context', 'memory', 'registries'] as const;
export type KitSection = (typeof KIT_SECTIONS)[number];

export const KitEntry = z.object({
  section: z.string().min(1).max(32),
  role: z.string().min(1).max(32),
  group: z.string().max(128).nullable(),
  path: z.string().min(1).max(512).regex(/^sdd\//),
  size: z.number().int().nonnegative(),
  mtime: z.string().max(40),
});
export type KitEntry = z.infer<typeof KitEntry>;

export const KitIndex = z.object({
  revision: z.string().max(64),
  entries: z.array(KitEntry).max(MAX_KIT_ENTRIES),
  truncated: z.boolean(),
});
export type KitIndex = z.infer<typeof KitIndex>;

export const ToolsChange = z.discriminatedUnion('tool', [
  z.object({ tool: z.literal('rtk'), enabled: z.boolean() }),
  z.object({ tool: z.literal('mod'), enabled: z.boolean() }),
  z.object({ tool: z.literal('gate'), mode: GateMode }),
]);
export type ToolsChange = z.infer<typeof ToolsChange>;

export const ToolsValue = z.union([z.boolean(), GateMode]);
export type ToolsValue = z.infer<typeof ToolsValue>;

export const ToolsSetResult = z.object({
  changed: z.boolean(),
  tool: z.enum(['rtk', 'mod', 'gate']),
  from: ToolsValue.nullable(),
  to: ToolsValue,
  tools: KitToolsState,
  warnings: z.array(z.string().max(40)).max(8),
});
export type ToolsSetResult = z.infer<typeof ToolsSetResult>;

export const RtkGain = z.object({
  status: z.enum(['ok', 'not-installed', 'error']).catch('error'),
  version: z.string().max(40).nullable(),
  gain: z.record(z.string(), z.unknown()).nullable(),
  readAt: z.string().max(40),
});
export type RtkGain = z.infer<typeof RtkGain>;

export const KIT_INTEGRATIONS = ['tucu-ui', 'video-maker'] as const;
export const KitIntegrationId = z.enum(KIT_INTEGRATIONS);
export type KitIntegrationId = z.infer<typeof KitIntegrationId>;

export const KIT_INTEGRATION_HARNESSES = ['claude', 'copilot', 'gemini', 'antigravity'] as const;
const HarnessState = z.enum(['complete', 'incomplete']).catch('incomplete');

export const KitIntegrationStatus = z.object({
  integration: KitIntegrationId,
  available: z.boolean(),
  enabled: z.boolean(),
  state: z.enum(['off', 'complete', 'incomplete', 'unavailable']).catch('unavailable'),
  parts: z.record(z.string().max(32), z.boolean()).catch({}),
  version: z.string().max(40).nullable().catch(null),
  kitVersion: z.string().max(40).nullable().catch(null),
  updateAvailable: z.boolean().catch(false),
  nodeOk: z.boolean().catch(true),
  harnesses: z
    .object({ claude: HarnessState, copilot: HarnessState, gemini: HarnessState, antigravity: HarnessState })
    .catch({ claude: 'incomplete', copilot: 'incomplete', gemini: 'incomplete', antigravity: 'incomplete' }),
  repair: z.string().max(256).nullable().catch(null),
});
export type KitIntegrationStatus = z.infer<typeof KitIntegrationStatus>;

export const MAX_INTEGRATION_OUTPUT_BYTES = 8 * 1024;

export const KitIntegrationSetResult = z.object({
  ok: z.boolean(),
  exitCode: z.number().int().nullable(),
  output: z.string().max(MAX_INTEGRATION_OUTPUT_BYTES),
  status: KitIntegrationStatus,
});
export type KitIntegrationSetResult = z.infer<typeof KitIntegrationSetResult>;
