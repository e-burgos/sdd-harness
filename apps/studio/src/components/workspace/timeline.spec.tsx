import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import type { TimelineItem } from '@/lib/store/timeline';
import { Timeline } from './Timeline';

const main = { agent: 'sdd-orchestrator', parentToolUseId: null };
const planner = { agent: 'sdd-planner', parentToolUseId: 'x' };
const items: TimelineItem[] = [
  { kind: 'user', id: 'u', seq: 0, text: 'open the cycle' },
  { kind: 'subagent', id: 's', seq: 1, agentType: 'sdd-planner', phase: 'start' },
  { kind: 'message', id: 'm', seq: 2, author: planner, text: '**plan** listo', done: true },
  { kind: 'tool', id: 't1', seq: 3, author: main, tool: 'Read', summary: 'a.ts', status: 'ok' },
  { kind: 'tool', id: 't2', seq: 4, author: main, tool: 'Grep', summary: 'TODO', status: 'running' },
  { kind: 'usage', id: 'us', seq: 5, usage: { model: 'claude-haiku-4-5-20251001', effort: 'low', tokensIn: 121318, tokensOut: 1152, costUsd: 0.0778 } },
];

describe('Timeline', () => {
  it('attributes subagent output and groups tools', () => {
    render(<I18nProvider initial="es"><Timeline items={items} onRespond={vi.fn()} /></I18nProvider>);
    expect(screen.getByText('open the cycle')).toBeInTheDocument();
    expect(screen.getByText('Chronos empezó a trabajar')).toBeInTheDocument();
    expect(screen.getByText('plan')).toBeInTheDocument();
    expect(screen.getByText('Clara usó 2 herramienta(s)')).toBeInTheDocument();
    expect(screen.getByText('claude-haiku-4-5-20251001 · low · 121.3k in · 1.2k out · $0.078')).toBeInTheDocument();
  });

  it('suggests switching tab or account only on the usage-limit error', () => {
    const limit: TimelineItem = { kind: 'status', id: 'e1', seq: 9, status: 'error', error: { code: 'x', message: 'API Error: 400 You have reached your specified API usage limits.' } };
    const other: TimelineItem = { kind: 'status', id: 'e2', seq: 10, status: 'error', error: { code: 'x', message: 'boom' } };
    render(<I18nProvider initial="es"><Timeline items={[limit, other]} onRespond={vi.fn()} /></I18nProvider>);
    expect(screen.getAllByText(/límite de uso/)).toHaveLength(1);
  });

  it('shows the clipped indicator only when the summary was cut', () => {
    const tool = (id: string, summary: string, summaryTruncated?: boolean): TimelineItem => ({ kind: 'tool', id, seq: 1, author: main, tool: 'Bash', summary, summaryTruncated, status: 'ok' });
    const render1 = (item: TimelineItem) => {
      const view = render(<I18nProvider initial="es"><Timeline items={[item]} onRespond={vi.fn()} /></I18nProvider>);
      return view;
    };
    let view = render1(tool('a', 'cat sdd/specs/x/plan.md', false));
    expect(screen.queryByTestId('tool-summary-clipped')).toBeNull();
    view.unmount();
    view = render1(tool('b', 'cat sdd/specs/x/plan.md'));
    expect(screen.queryByTestId('tool-summary-clipped')).toBeNull();
    view.unmount();
    view = render1(tool('c', 'cat sdd/specs/x/pl…', true));
    expect(screen.getByTestId('tool-summary-clipped')).toHaveTextContent('recortado');
    view.unmount();
    view = render1(tool('d', 'cat sdd/specs/x/pl…', false));
    expect(screen.queryByTestId('tool-summary-clipped')).toBeNull();
    view.unmount();
    render1(tool('e', 'cat sdd/specs/x/pl…'));
    expect(screen.getByTestId('tool-summary-clipped')).toBeInTheDocument();
  });
});
