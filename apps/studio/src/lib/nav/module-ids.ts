export const MODULE_IDS = ['home', 'specs', 'fixes', 'agents', 'activity', 'map', 'kit', 'architecture', 'metrics', 'new-project'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export const ALWAYS_VISIBLE_MODULE: ModuleId = 'home';

export const isModuleId = (value: unknown): value is ModuleId => typeof value === 'string' && (MODULE_IDS as readonly string[]).includes(value);

export const isHideable = (id: ModuleId): boolean => id !== ALWAYS_VISIBLE_MODULE;
