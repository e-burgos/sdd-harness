import type { TFunction } from './i18n/i18n';

type Key = Parameters<TFunction>[0];

const TOOL_LABEL: Record<string, Key> = {
  rtk: 'module.kit.tools.rtk.label',
  mod: 'module.kit.tools.mod.label',
  gate: 'module.kit.tools.gate.label',
};

export function toolValueText(t: TFunction, tool: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (tool === 'gate') return t(value === 'warn' ? 'module.kit.tools.warn' : 'module.kit.tools.block');
  if (typeof value === 'boolean') return t(value ? 'module.kit.tools.on' : 'module.kit.tools.off');
  return String(value);
}

export function toolChangeVars(t: TFunction, payload: Record<string, unknown>): { tool: string; from: string; to: string } {
  const tool = typeof payload['tool'] === 'string' ? payload['tool'] : '';
  const labelKey = TOOL_LABEL[tool];
  return { tool: labelKey ? t(labelKey) : tool, from: toolValueText(t, tool, payload['from']), to: toolValueText(t, tool, payload['to']) };
}
