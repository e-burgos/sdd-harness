import { es } from './i18n/es';
import { botText, formatCost, formatTokens } from './format';

const t = (key: keyof typeof es, vars: Record<string, string | number> = {}) =>
  es[key].replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? `{${k}}`));

describe('format', () => {
  it('formats cost and tokens', () => {
    expect(formatCost(0.0778)).toBe('$0.078');
    expect(formatCost(1.5)).toBe('$1.50');
    expect(formatTokens(121318)).toBe('121.3k');
    expect(formatTokens(950)).toBe('950');
  });
  it('renders bot events', () => {
    expect(botText(t, { channelId: 'spec:s', botKind: 'task.status', payload: { taskId: 'T1', title: 'Tests', from: 'pending', to: 'done' } })).toBe('T1 «Tests»: pending → done');
  });
  it('renders integration.changed with the localized state', () => {
    expect(botText(t, { channelId: 'general', botKind: 'integration.changed', payload: { integration: 'tucu-ui', enabled: true, state: 'complete' } })).toBe('tucu-ui: Activa (sdd/tools.json)');
  });
  it('renders tools.changed with localized tool and values', () => {
    expect(botText(t, { channelId: 'general', botKind: 'tools.changed', payload: { tool: 'gate', from: 'block', to: 'warn' } })).toBe('SPEC GATE: Bloquear → Avisar (sdd/tools.json)');
    expect(botText(t, { channelId: 'general', botKind: 'tools.changed', payload: { tool: 'rtk', from: null, to: true } })).toBe('rtk: — → Activado (sdd/tools.json)');
  });
});
