import { act, render, screen } from '@testing-library/react';
import type { ThreadEvent, ThreadInfo } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { ThreadView } from './ThreadView';

const options = { agent: 'sdd-planner', model: 'kit' as const, effort: null, permissionMode: 'default' as const };
const info: ThreadInfo = {
  id: 't1', channelId: 'general', title: 'hilo', agent: 'sdd-planner', options, status: 'waiting-approval', createdAt: '1', lastActivity: '1',
  link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount: 0,
};
const author = { agent: 'sdd-planner', parentToolUseId: null };

function mount() {
  const store = createStudioStore();
  store.getState().setThreads([info]);
  store.getState().loadHistory('t1', []);
  const client = { request: vi.fn(() => Promise.resolve(null)) };
  const value = { client, store, connection: { status: 'idle' } } as unknown as BridgeContextValue;
  render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <ThreadView threadId="t1" onBack={vi.fn()} composer={null} />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
  let seq = 0;
  return { client, emit: (event: ThreadEvent) => act(() => store.getState().receive({ kind: 'thread.event', threadId: 't1', seq: seq++, event })) };
}

describe('approval flow with the Always rule (CA-008.4)', () => {
  it('shows the rule before deciding and the remembered rule afterwards with the same wording', () => {
    const { emit } = mount();
    emit({ type: 'approval.requested', approvalId: 'a1', author, tool: 'Bash', summary: '$ git status --short', always: { kind: 'bash-prefix', prefix: 'git status' } });
    const scope = screen.getByTestId('always-scope').textContent ?? '';
    expect(scope).toContain('«git status»');
    emit({ type: 'approval.resolved', approvalId: 'a1', decision: 'allow', remembered: { kind: 'bash-prefix', prefix: 'git status' } });
    expect(screen.queryByTestId('always-scope')).toBeNull();
    const remembered = screen.getByTestId('always-remembered').textContent ?? '';
    const describeRule = (text: string) => text.slice(text.indexOf('los comandos'));
    expect(describeRule(remembered)).toBe(describeRule(scope));
  });

  it('shows no Always button on a warn card and records no remembered rule when it is approved', () => {
    const { emit, client } = mount();
    emit({
      type: 'approval.requested', approvalId: 'a2', author, tool: 'Edit', summary: 'apps/x.ts', gateWarning: 'SPEC GATE: sin ciclo',
      always: { kind: 'none', reason: 'gate-warning' },
    });
    expect(screen.queryByRole('button', { name: 'Siempre (hilo)' })).toBeNull();
    expect(screen.getByTestId('always-unavailable')).toBeInTheDocument();
    emit({ type: 'approval.resolved', approvalId: 'a2', decision: 'allow' });
    expect(screen.queryByTestId('always-remembered')).toBeNull();
    expect(screen.getByText(/Aprobado/)).toBeInTheDocument();
    expect(client.request).not.toHaveBeenCalled();
  });
});
