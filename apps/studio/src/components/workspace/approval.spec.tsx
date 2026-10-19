import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    const onRespond = vi.fn(() => Promise.resolve());
    // tras responder la tarjeta queda bloqueada hasta que cambia la decisión: una instancia por acción
    wrap(<ApprovalCard item={base} onRespond={onRespond} />);
    expect(screen.getByText('Impl-back quiere usar Bash')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
    cleanup();
    wrap(<ApprovalCard item={base} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole('button', { name: 'Siempre (hilo)' }));
    cleanup();
    wrap(<ApprovalCard item={base} onRespond={onRespond} />);
    fireEvent.change(screen.getByPlaceholderText('Motivo (opcional)'), { target: { value: 'no' } });
    fireEvent.click(screen.getByRole('button', { name: 'Denegar' }));
    expect(onRespond.mock.calls).toEqual([['allow', 'once', undefined], ['allow', 'thread', undefined], ['deny', 'once', 'no']]);
  });
  it('does not deny when Enter confirms an IME composition in the reason box', () => {
    const onRespond = vi.fn(() => Promise.resolve());
    wrap(<ApprovalCard item={base} onRespond={onRespond} />);
    const input = screen.getByPlaceholderText('Motivo (opcional)');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onRespond).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRespond).toHaveBeenCalledWith('deny', 'once', undefined);
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
  it('sends once while pending and re-enables with an inline error on rejection', async () => {
    let reject!: (e: Error) => void;
    const onRespond = vi.fn(() => new Promise<void>((_, rej) => { reject = rej; }));
    wrap(<ApprovalCard item={base} onRespond={onRespond} />);
    const allow = screen.getByRole('button', { name: 'Aprobar' });
    fireEvent.click(allow);
    fireEvent.click(allow);
    expect(onRespond).toHaveBeenCalledTimes(1);
    expect(allow).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Denegar' })).toBeDisabled();
    expect(screen.getByPlaceholderText('Motivo (opcional)')).toBeDisabled();
    await act(async () => reject(new Error('bridge caído')));
    expect(screen.getByRole('alert')).toHaveTextContent('bridge caído');
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeEnabled();
  });
  it('limits and labels the reason, and Enter denies', () => {
    const onRespond = vi.fn(() => Promise.resolve());
    wrap(<ApprovalCard item={base} onRespond={onRespond} />);
    const input = screen.getByLabelText('Motivo (opcional)');
    expect(input).toHaveAttribute('maxlength', '2000');
    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRespond).toHaveBeenCalledWith('deny', 'once', 'nope');
  });
  it('unlocks without error when the decision never arrives within 20 s', async () => {
    vi.useFakeTimers();
    try {
      const onRespond = vi.fn(() => Promise.resolve());
      wrap(<ApprovalCard item={base} onRespond={onRespond} />);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aprobar' })); });
      expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDisabled();
      await act(async () => { vi.advanceTimersByTime(19_999); });
      expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDisabled();
      await act(async () => { vi.advanceTimersByTime(2); });
      expect(screen.getByRole('button', { name: 'Aprobar' })).toBeEnabled();
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
