import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import type { TimelineItem } from '@/lib/store/timeline';
import { ApprovalCard, SUMMARY_CLAMP_CHARS } from './ApprovalCard';

type Approval = Extract<TimelineItem, { kind: 'approval' }>;
const base: Approval = {
  kind: 'approval', id: 'p1', seq: 3, author: { agent: 'sdd-implementor-back', parentToolUseId: 't' },
  tool: 'Bash', summary: '$ pnpm nx test api', decision: 'pending',
  always: { kind: 'bash-prefix', prefix: 'pnpm nx test' },
};
const wrap = (ui: React.ReactNode) => render(<I18nProvider initial="es">{ui}</I18nProvider>);

describe('ApprovalCard', () => {
  it('approves once, always, and denies with a reason', () => {
    const onRespond = vi.fn(() => Promise.resolve());
    // after responding the card stays locked until the decision changes: one instance per action
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
    await act(async () => reject(new Error('bridge down')));
    expect(screen.getByRole('alert')).toHaveTextContent('bridge down');
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

  describe('Always rule', () => {
    const always = (item: Partial<Approval>) => wrap(<ApprovalCard item={{ ...base, ...item }} onRespond={vi.fn()} />);

    it.each([
      [{ kind: 'tool', tool: 'Edit' }, 'Siempre recordaría: la herramienta Edit, solo en este hilo'],
      [{ kind: 'mcp', tool: 'mcp__fake__ping' }, 'Siempre recordaría: la tool MCP mcp__fake__ping, solo en este hilo'],
      [{ kind: 'bash-prefix', prefix: 'git status' }, 'Siempre recordaría: los comandos Bash que empiezan con «git status», solo en este hilo'],
    ] as const)('shows before choosing the exact scope Always would remember: %j', (offer, text) => {
      always({ always: offer });
      expect(screen.getByTestId('always-scope')).toHaveTextContent(text);
      expect(screen.getByRole('button', { name: 'Siempre (hilo)' })).toHaveAccessibleDescription(text);
    });

    it('sends scope thread when Always is chosen', () => {
      const onRespond = vi.fn(() => Promise.resolve());
      wrap(<ApprovalCard item={{ ...base, always: { kind: 'tool', tool: 'Edit' } }} onRespond={onRespond} />);
      fireEvent.click(screen.getByRole('button', { name: 'Siempre (hilo)' }));
      expect(onRespond).toHaveBeenCalledWith('allow', 'thread', undefined);
    });

    it('hides Always on a gate warning card and explains that nothing is remembered (CA-008.4, CA-009.3)', () => {
      always({ tool: 'Edit', gateWarning: 'SPEC GATE: sin ciclo', always: { kind: 'none', reason: 'gate-warning' } });
      expect(screen.queryByRole('button', { name: 'Siempre (hilo)' })).toBeNull();
      expect(screen.queryByTestId('always-scope')).toBeNull();
      expect(screen.getByTestId('always-unavailable')).toHaveTextContent('aviso del SPEC GATE');
      expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
    });

    it('hides Always and explains when the rule is not calculable', () => {
      always({ always: { kind: 'none', reason: 'not-calculable' } });
      expect(screen.queryByRole('button', { name: 'Siempre (hilo)' })).toBeNull();
      expect(screen.getByTestId('always-unavailable')).toHaveTextContent('No hay una regla segura');
    });

    it('does not promise anything when the bridge did not offer a rule', () => {
      always({ always: undefined });
      expect(screen.queryByRole('button', { name: 'Siempre (hilo)' })).toBeNull();
    });

    it('shows the remembered rule once resolved', () => {
      always({ decision: 'allow', remembered: { kind: 'bash-prefix', prefix: 'pnpm nx test' } });
      expect(screen.getByTestId('always-remembered')).toHaveTextContent('regla recordada: los comandos Bash que empiezan con «pnpm nx test»');
      expect(screen.queryByTestId('always-scope')).toBeNull();
    });

    it('shows no remembered text for a plain approval', () => {
      always({ decision: 'allow' });
      expect(screen.queryByTestId('always-remembered')).toBeNull();
    });
  });

  it('clamps a long summary behind a toggle and leaves a short one alone', () => {
    const { unmount } = wrap(<ApprovalCard item={{ ...base, summary: 'a'.repeat(SUMMARY_CLAMP_CHARS + 1) }} onRespond={vi.fn()} />);
    const summary = screen.getByTestId('approval-summary');
    expect(summary).toHaveClass('line-clamp-3');
    fireEvent.click(screen.getByRole('button', { name: 'Ver todo' }));
    expect(summary).not.toHaveClass('line-clamp-3');
    fireEvent.click(screen.getByRole('button', { name: 'Ver menos' }));
    expect(summary).toHaveClass('line-clamp-3');
    unmount();
    wrap(<ApprovalCard item={{ ...base, summary: 'ls -la' }} onRespond={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Ver todo' })).toBeNull();
  });
});
