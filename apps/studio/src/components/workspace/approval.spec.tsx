import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import type { TimelineItem } from '@/lib/store/timeline';
import { ApprovalCard } from './ApprovalCard';

type Approval = Extract<TimelineItem, { kind: 'approval' }>;
const base: Approval = {
  kind: 'approval', id: 'p1', seq: 3, author: { agent: 'sdd-implementor-back', parentToolUseId: 't' },
  tool: 'Bash', summary: '$ pnpm nx test api', decision: 'pending',
};
const wrap = (ui: React.ReactNode) => render(<I18nProvider initial="es">{ui}</I18nProvider>);

describe('ApprovalCard', () => {
  it('approves once, always, and denies with a reason', () => {
    const onRespond = vi.fn();
    wrap(<ApprovalCard item={base} onRespond={onRespond} />);
    expect(screen.getByText('Impl-back quiere usar Bash')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siempre (hilo)' }));
    fireEvent.change(screen.getByPlaceholderText('Motivo (opcional)'), { target: { value: 'no' } });
    fireEvent.click(screen.getByRole('button', { name: 'Denegar' }));
    expect(onRespond.mock.calls).toEqual([['allow', 'once', undefined], ['allow', 'thread', undefined], ['deny', 'once', 'no']]);
  });
  it('shows gate warning, diff and truncated input in scrollable blocks', () => {
    wrap(<ApprovalCard item={{ ...base, tool: 'Write', diff: '+export {}', input: 'x'.repeat(20_000), inputTruncated: true, gateWarning: 'SPEC GATE: ojo' }} onRespond={vi.fn()} />);
    expect(screen.getByText('SPEC GATE: ojo')).toBeInTheDocument();
    expect(screen.getByText('+export {}')).toBeInTheDocument();
    expect(screen.getByText('La entrada es muy larga y se muestra recortada.')).toBeInTheDocument();
    expect(screen.getByTestId('approval-input')).toHaveClass('overflow-auto');
  });
  it('renders the resolved state without buttons', () => {
    wrap(<ApprovalCard item={{ ...base, decision: 'deny', reason: 'SPEC GATE: no' }} onRespond={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Aprobar' })).toBeNull();
    expect(screen.getByText(/Denegado/)).toHaveTextContent('SPEC GATE: no');
  });
});
