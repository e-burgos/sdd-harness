import { fireEvent, render, screen } from '@testing-library/react';
import type { ThreadInfo } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { ConversationSelector } from './ConversationSelector';

const thread = (id: string, title: string): ThreadInfo => ({
  id,
  channelId: 'general',
  title,
  agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'idle',
  createdAt: '2026-01-01T00:00:00Z',
  lastActivity: '2026-01-01T00:00:00Z',
  link: { target: { kind: 'none' }, source: 'legacy' },
  pendingCount: 0,
});

const renderSelector = (props: Partial<Parameters<typeof ConversationSelector>[0]> = {}) => {
  const onPick = vi.fn();
  const onNewConversation = vi.fn();
  render(
    <I18nProvider initial="es">
      <ConversationSelector conversations={[]} selectedThreadId={null} onPick={onPick} onNewConversation={onNewConversation} {...props} />
    </I18nProvider>,
  );
  return { onPick, onNewConversation };
};

describe('ConversationSelector', () => {
  it('lists the conversations in a dropdown and marks the selected one', () => {
    renderSelector({ conversations: [thread('a', 'Primera'), thread('b', 'Segunda')], selectedThreadId: 'b' });
    expect(screen.getByTestId('conversation-select')).toHaveValue('b');
    expect(screen.getByRole('option', { name: 'Primera' })).toBeInTheDocument();
  });

  it('reports the picked conversation', () => {
    const { onPick } = renderSelector({ conversations: [thread('a', 'Primera'), thread('b', 'Segunda')], selectedThreadId: 'a' });
    fireEvent.change(screen.getByTestId('conversation-select'), { target: { value: 'b' } });
    expect(onPick).toHaveBeenCalledWith('b');
  });

  it('shows the empty state with the new conversation button', () => {
    const { onNewConversation } = renderSelector();
    expect(screen.getByTestId('conversation-selector-empty')).toHaveTextContent('Todavía no hay conversaciones');
    fireEvent.click(screen.getByRole('button', { name: /Nueva conversación/ }));
    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });

  it('keeps the new conversation button when there are conversations', () => {
    const { onNewConversation } = renderSelector({ conversations: [thread('a', 'Primera')] });
    fireEvent.click(screen.getByTestId('new-conversation-button'));
    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });

  it('falls back to the id for an untitled conversation', () => {
    renderSelector({ conversations: [thread('abc', '')] });
    expect(screen.getByRole('option', { name: 'abc' })).toBeInTheDocument();
  });
});
