import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import type { ConversationDialogue, ConversationView } from '@/lib/conversation';
import { BridgeContext } from '../BridgeProvider';
import { LiveAgentChatFeed } from './LiveAgentChatFeed';

const createdThread = {
  id: 'new-thread',
  channelId: 'dm:sdd-architect',
  title: 'hola',
  agent: 'sdd-architect',
  options: { agent: 'sdd-architect', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'running',
  createdAt: '2026-01-01T00:00:00Z',
  lastActivity: '2026-01-01T00:00:00Z',
  link: { target: { kind: 'none' }, source: 'legacy' },
  pendingCount: 0,
};

const dialogue = (seq: number, from: string, to: string | null, text: string, isLive = false): ConversationDialogue => ({
  id: `d${seq}`,
  seq,
  kind: 'message',
  from,
  to,
  text,
  isLive,
});

const view = (dialogues: ConversationDialogue[], patch: Partial<ConversationView> = {}): ConversationView => ({
  threadId: 't-1',
  participants: [],
  dialogues,
  specs: [],
  fixes: [],
  engineSessionId: 'sess',
  provider: 'claude',
  isEmpty: dialogues.length === 0,
  ...patch,
});

function mount(conversation: ConversationView | null, onPickConversation = vi.fn()) {
  const request = vi.fn().mockResolvedValue(createdThread);
  const bridge: any = { client: { request, supports: () => true }, store: createStudioStore(), connection: { status: 'open' } };
  render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={bridge}>
        <LiveAgentChatFeed agentId="sdd-architect" conversation={conversation} onPickConversation={onPickConversation} />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
  return { request, onPickConversation };
}

describe('LiveAgentChatFeed', () => {
  it('shows the empty state when there is no conversation', () => {
    mount(null);
    expect(screen.getByTestId('live-agent-chat-feed-empty')).toHaveTextContent('Sin actividad todavía');
  });

  it('shows only the dialogues that involve the agent', () => {
    mount(view([dialogue(1, 'sdd-architect', 'user', 'diseño listo'), dialogue(2, 'sdd-planner', 'user', 'plan ajeno')]));
    expect(screen.getByText('diseño listo')).toBeInTheDocument();
    expect(screen.queryByText('plan ajeno')).toBeNull();
    expect(screen.getByTestId('dialogue-provider')).toHaveTextContent('CLAUDE');
  });

  it('shows the empty state when the conversation has nothing for the agent', () => {
    mount(view([dialogue(1, 'sdd-planner', 'user', 'plan ajeno')]));
    expect(screen.getByTestId('live-agent-chat-feed-empty')).toBeInTheDocument();
  });

  it('sends to the selected conversation instead of creating a thread', async () => {
    const { request, onPickConversation } = mount(view([dialogue(1, 'sdd-architect', 'user', 'hola')]));
    fireEvent.change(screen.getByPlaceholderText(/Escribir a Daedalus/), { target: { value: 'seguí' } });
    fireEvent.submit(screen.getByTestId('live-agent-chat-feed').querySelector('form')!);
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({ cmd: 'thread.send', threadId: 't-1', text: 'seguí' })));
    expect(onPickConversation).not.toHaveBeenCalled();
  });

  it('creates a direct conversation when none is selected and picks it', async () => {
    const { request, onPickConversation } = mount(null);
    fireEvent.change(screen.getByPlaceholderText(/Escribir a Daedalus/), { target: { value: 'hola' } });
    fireEvent.submit(screen.getByTestId('live-agent-chat-feed').querySelector('form')!);
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({ cmd: 'thread.create', channelId: 'dm:sdd-architect', text: 'hola' })));
    await waitFor(() => expect(onPickConversation).toHaveBeenCalledWith('new-thread'));
  });

  it('shows the send error and keeps the text', async () => {
    const { request } = mount(null);
    request.mockRejectedValueOnce(new Error('puente caído'));
    fireEvent.change(screen.getByPlaceholderText(/Escribir a Daedalus/), { target: { value: 'hola' } });
    fireEvent.submit(screen.getByTestId('live-agent-chat-feed').querySelector('form')!);
    expect(await screen.findByText('puente caído')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Escribir a Daedalus/)).toHaveValue('hola');
  });
});
