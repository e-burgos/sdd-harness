import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultThreadOptions } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { Composer, ComposerView } from './Composer';

function setup(extra: Partial<React.ComponentProps<typeof ComposerView>> = {}) {
  const onSubmit = vi.fn(() => Promise.resolve(true));
  const onOptionsChange = vi.fn();
  render(
    <I18nProvider initial="es">
      <ComposerView
        options={defaultThreadOptions()} onOptionsChange={onOptionsChange} onSubmit={onSubmit}
        agents={['sdd-orchestrator', 'sdd-planner']} agentLocked={false} error={null} {...extra}
      />
    </I18nProvider>,
  );
  return { onSubmit, onOptionsChange, box: screen.getByPlaceholderText('Escribí un mensaje… (/ para comandos)') };
}

describe('ComposerView', () => {
  it('sends on Enter, keeps Shift+Enter as newline and clears', async () => {
    const { onSubmit, box } = setup();
    fireEvent.change(box, { target: { value: 'hola' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('hola');
    await waitFor(() => expect(box).toHaveValue(''));
  });
  it('keeps the text when the send fails and ignores a second Enter while pending', async () => {
    let finish!: (ok: boolean) => void;
    const onSubmit = vi.fn(() => new Promise<boolean>((r) => { finish = r; }));
    const { box } = setup({ onSubmit });
    fireEvent.change(box, { target: { value: 'hola' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(box).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    await act(async () => finish(false));
    expect(box).toHaveValue('hola');
    expect(box).toBeEnabled();
  });
  it('disables effort when the model is kit and enables it otherwise', () => {
    const { onOptionsChange } = setup();
    expect(screen.getByLabelText('Esfuerzo')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'opus' } });
    expect(onOptionsChange).toHaveBeenCalledWith({ model: 'opus', effort: 'medium' });
  });
  it('locks the agent selector in DMs', () => {
    setup({ agentLocked: true });
    expect(screen.getByLabelText('Agente')).toBeDisabled();
  });
  it('shows a composer error', () => {
    setup({ error: 'Comando desconocido: nope' });
    expect(screen.getByRole('alert')).toHaveTextContent('Comando desconocido: nope');
  });
});

describe('Composer (connected)', () => {
  function connected(channelId: string, threadId: string | null, request: (cmd: { cmd: string }) => Promise<unknown>) {
    const store = createStudioStore();
    const client = { request: vi.fn(request) };
    const value = { client, store } as unknown as BridgeContextValue;
    const onThreadCreated = vi.fn();
    render(
      <I18nProvider initial="es">
        <BridgeContext.Provider value={value}>
          <Composer channelId={channelId} threadId={threadId} onThreadCreated={onThreadCreated} />
        </BridgeContext.Provider>
      </I18nProvider>,
    );
    return { client, store, onThreadCreated, box: screen.getByPlaceholderText('Escribí un mensaje… (/ para comandos)') };
  }
  const info = (id = 't1') => ({
    id, channelId: 'general', title: 'x', agent: 'sdd-orchestrator',
    options: defaultThreadOptions(), status: 'idle', createdAt: 'a', lastActivity: 'a',
  });
  const enter = (box: HTMLElement, text: string) => {
    fireEvent.change(box, { target: { value: text } });
    fireEvent.keyDown(box, { key: 'Enter' });
  };

  it('/validate runs the command and registers the run', async () => {
    const { client, store, box } = connected('general', null, async () => ({ runId: 'r1' }));
    enter(box, '/validate');
    await waitFor(() => expect(store.getState().runs['r1']).toMatchObject({ name: 'validate', args: [] }));
    expect(client.request).toHaveBeenCalledWith({ cmd: 'command.run', name: 'validate', args: [] });
  });
  it('/open-cycle reads the prompt then creates the thread with prompt + args', async () => {
    const { client, onThreadCreated, box } = connected('general', null, async (c) =>
      c.cmd === 'workspace.readFile' ? { path: 'p', content: 'PROMPT' } : info('t9'));
    enter(box, '/open-cycle mi-spec');
    await waitFor(() => expect(onThreadCreated).toHaveBeenCalledWith('t9'));
    expect(client.request.mock.calls[0]![0]).toMatchObject({ cmd: 'workspace.readFile', path: 'sdd/prompts/start-sdd-cycle.prompt.md' });
    expect(client.request.mock.calls[1]![0]).toMatchObject({ cmd: 'thread.create', text: 'PROMPT\n\n---\nmi-spec' });
  });
  it('forces the DM agent in thread.create and creates one thread on double submit', async () => {
    const { client, box } = connected('dm:sdd-planner', null, async () => info());
    enter(box, 'hola');
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(client.request).toHaveBeenCalled());
    expect(client.request).toHaveBeenCalledTimes(1);
    expect(client.request.mock.calls[0]![0]).toMatchObject({ cmd: 'thread.create', options: { agent: 'sdd-planner' } });
  });
  it('keeps the text and shows the error when the send is rejected', async () => {
    const { box } = connected('general', null, async () => { throw new Error('bridge caído'); });
    enter(box, 'hola');
    expect(await screen.findByRole('alert')).toHaveTextContent('bridge caído');
    expect(box).toHaveValue('hola');
  });
  it('refuses messages over 100 000 characters', async () => {
    const { client, box } = connected('general', null, async () => info());
    enter(box, 'x'.repeat(100_001));
    expect(await screen.findByRole('alert')).toHaveTextContent('El mensaje supera los 100.000 caracteres.');
    expect(client.request).not.toHaveBeenCalled();
    expect(box).toHaveValue('x'.repeat(100_001));
  });
  it('never sends agent in thread.setOptions', async () => {
    const { client, store } = connected('general', 't1', async () => ({}));
    act(() => store.getState().receive({ kind: 'thread.updated', thread: info() } as never));
    await waitFor(() => expect(screen.getByLabelText('Modelo')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'opus' } });
    const call = client.request.mock.calls.find((c) => c[0].cmd === 'thread.setOptions')![0] as unknown as { options: object };
    expect(call.options).toEqual({ model: 'opus', effort: 'medium' });
  });
});
