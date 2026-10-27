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
