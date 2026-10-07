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
});
