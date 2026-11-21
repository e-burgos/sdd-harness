import type { BatchSummary, TaskSummary } from '@sdd-studio/protocol';
import { agoText, blockTokens, compactTokens, groupTasksByBatch, shortRepo, tailLines, usageChipText, verifyExitKind } from './kit-execution';

const usage = (tokensTotal: number, approx = false) => ({ tokensTotal, providerModel: 'sonnet', effort: 'medium', agent: 'implementor-back', approx });
const task = (id: string, extra: Partial<TaskSummary> = {}): TaskSummary => ({ id, title: id, status: 'pending', storyPoints: 1, ...extra });
const batch = (id: string, tasks: string[]): BatchSummary => ({ id, app: 'apps/x', role: 'implementor-back', tasks, dependsOn: [] });

describe('kit execution helpers', () => {
  it('formats compact tokens by language', () => {
    expect(compactTokens(950, 'es')).toBe('950');
    expect(compactTokens(12_340, 'es')).toBe('12,3k');
    expect(compactTokens(12_340, 'en')).toBe('12.3k');
  });

  it('builds the usage chip and marks approximations', () => {
    expect(usageChipText(usage(12_340), 'es')).toBe('12,3k · sonnet · implementor-back');
    expect(usageChipText(usage(12_340, true), 'en')).toBe('≈12.3k · sonnet · implementor-back');
    expect(usageChipText({ tokensTotal: 10, providerModel: null, effort: null, agent: null, approx: false }, 'es')).toBe('10');
  });

  it('groups by batch order and leaves loose tasks last', () => {
    const blocks = groupTasksByBatch([task('TASK-001'), task('TASK-002', { batch: 'B-02' }), task('TASK-003')], [batch('B-02', []), batch('B-01', ['TASK-001'])]);
    expect(blocks.map((b) => [b.batch?.id ?? null, b.tasks.map((t) => t.id)])).toEqual([
      ['B-02', ['TASK-002']],
      ['B-01', ['TASK-001']],
      [null, ['TASK-003']],
    ]);
  });

  it('sums block tokens ignoring tasks without usage', () => {
    expect(blockTokens([task('a', { usage: usage(1000) }), task('b'), task('c', { usage: usage(2500) })])).toBe(3500);
  });

  it('computes relative time, short repo, tail and exit kinds', () => {
    const t = ((key: string, vars?: Record<string, string | number>) => `${key}:${vars?.['n']}`) as never;
    const now = Date.parse('2026-11-20T12:00:00Z');
    expect(agoText('2026-11-20T11:59:30Z', now, t)).toBe('kitexec.ago.seconds:30');
    expect(agoText('2026-11-20T10:00:00Z', now, t)).toBe('kitexec.ago.hours:2');
    expect(shortRepo('/Users/me/proj/')).toBe('proj');
    expect(tailLines('a\nb\nc', 2)).toBe('b\nc');
    expect([0, 1, 75, 2].map(verifyExitKind)).toEqual(['ok', 'failed', 'lease', 'error']);
  });
});
