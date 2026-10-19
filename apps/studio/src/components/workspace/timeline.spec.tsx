import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import type { TimelineItem } from '@/lib/store/timeline';
import { Timeline } from './Timeline';

const main = { agent: 'sdd-orchestrator', parentToolUseId: null };
const planner = { agent: 'sdd-planner', parentToolUseId: 'x' };
const items: TimelineItem[] = [
  { kind: 'user', id: 'u', seq: 0, text: 'abrí el ciclo' },
  { kind: 'subagent', id: 's', seq: 1, agentType: 'sdd-planner', phase: 'start' },
  { kind: 'message', id: 'm', seq: 2, author: planner, text: '**plan** listo', done: true },
  { kind: 'tool', id: 't1', seq: 3, author: main, tool: 'Read', summary: 'a.ts', status: 'ok' },
  { kind: 'tool', id: 't2', seq: 4, author: main, tool: 'Grep', summary: 'TODO', status: 'running' },
  { kind: 'usage', id: 'us', seq: 5, usage: { model: 'claude-haiku-4-5-20251001', effort: 'low', tokensIn: 121318, tokensOut: 1152, costUsd: 0.0778 } },
];

describe('Timeline', () => {
  it('attributes subagent output and groups tools', () => {
    render(<I18nProvider initial="es"><Timeline items={items} onRespond={vi.fn()} /></I18nProvider>);
    expect(screen.getByText('abrí el ciclo')).toBeInTheDocument();
    expect(screen.getByText('Planner empezó a trabajar')).toBeInTheDocument();
    expect(screen.getByText('plan')).toBeInTheDocument();
    expect(screen.getByText('Orchestrator usó 2 herramienta(s)')).toBeInTheDocument();
    expect(screen.getByText('claude-haiku-4-5-20251001 · low · 121.3k in · 1.2k out · $0.078')).toBeInTheDocument();
  });
});
