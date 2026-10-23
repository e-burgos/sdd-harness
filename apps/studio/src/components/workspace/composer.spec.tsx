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
  function connected(channelId: string, threadId: string | null, request: (cmd: { cmd: string }) => Promise<unknown>, features: string[] = []) {
    const store = createStudioStore();
    const client = { request: vi.fn(request), supports: (f: string) => features.includes(f) };
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
    link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount: 0,
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
  it('/gate without args in a spec channel gates that spec', async () => {
    const { client, box } = connected('spec:spec-dev-001-pagos', null, async () => ({ runId: 'r2' }));
    enter(box, '/gate');
    await waitFor(() => expect(client.request).toHaveBeenCalledWith({ cmd: 'command.run', name: 'gate', args: ['spec-dev-001-pagos'] }));
  });
  it('/gate without args outside a spec channel keeps no args', async () => {
    const { client, box } = connected('general', null, async () => ({ runId: 'r3' }));
    enter(box, '/gate');
    await waitFor(() => expect(client.request).toHaveBeenCalledWith({ cmd: 'command.run', name: 'gate', args: [] }));
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
    const { box } = connected('general', null, async () => { throw new Error('bridge down'); });
    enter(box, 'hola');
    expect(await screen.findByRole('alert')).toHaveTextContent('bridge down');
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

  describe('attachments', () => {
    const ALL = ['attachments'];
    const pick = (files: File[]) => fireEvent.change(screen.getByTestId('attachment-input'), { target: { files } });
    const note = (name = 'nota.txt', text = 'contenido') => new File([text], name, { type: 'text/plain' });

    it('sends only attachments without text through thread.send', async () => {
      const { client, store, box } = connected('general', 't1', async () => ({ delivery: 'started' }), ALL);
      pick([note()]);
      await screen.findByText('1/5 adjuntos');
      fireEvent.keyDown(box, { key: 'Enter' });
      await waitFor(() => expect(client.request).toHaveBeenCalled());
      expect(client.request.mock.calls[0]![0]).toMatchObject({
        cmd: 'thread.send', threadId: 't1', text: '',
        attachments: [{ kind: 'text', name: 'nota.txt', mime: 'text/plain', text: 'contenido' }],
      });
      await waitFor(() => expect(store.getState().drafts['t1']).toBeUndefined());
      expect(screen.queryByText('1/5 adjuntos')).toBeNull();
    });

    it('sends attachments in thread.create for a new thread', async () => {
      const { client, onThreadCreated, box } = connected('general', null, async () => info('t7'), ALL);
      fireEvent.change(box, { target: { value: 'mirá' } });
      pick([note()]);
      await screen.findByText('1/5 adjuntos');
      fireEvent.keyDown(box, { key: 'Enter' });
      await waitFor(() => expect(onThreadCreated).toHaveBeenCalledWith('t7'));
      expect(client.request.mock.calls[0]![0]).toMatchObject({ cmd: 'thread.create', text: 'mirá', attachments: [{ name: 'nota.txt' }] });
    });

    it('does not send without text and without attachments', () => {
      const { client, box } = connected('general', 't1', async () => ({}), ALL);
      fireEvent.keyDown(box, { key: 'Enter' });
      expect(client.request).not.toHaveBeenCalled();
    });

    it('keeps text and attachments when the send fails', async () => {
      const { box } = connected('general', 't1', async () => { throw new Error('bridge down'); }, ALL);
      fireEvent.change(box, { target: { value: 'hola' } });
      pick([note()]);
      await screen.findByText('1/5 adjuntos');
      fireEvent.keyDown(box, { key: 'Enter' });
      await waitFor(() => expect(screen.getByText('bridge down')).toBeInTheDocument());
      expect(box).toHaveValue('hola');
      expect(screen.getByText('1/5 adjuntos')).toBeInTheDocument();
    });

    it('shows the budget error with the heaviest names and keeps the draft', async () => {
      const { client, box } = connected('general', 't1', async () => ({}), ALL);
      fireEvent.change(box, { target: { value: 'hola' } });
      const big = (name: string) => note(name, 'x'.repeat(450_000));
      pick([big('a.txt'), big('b.txt'), big('c.txt')]);
      await screen.findByText('3/5 adjuntos');
      fireEvent.keyDown(box, { key: 'Enter' });
      expect(await screen.findByText(/excede el tamaño máximo por \d+ KB/)).toHaveTextContent('a.txt, b.txt');
      expect(client.request).not.toHaveBeenCalled();
      expect(screen.getByText('3/5 adjuntos')).toBeInTheDocument();
    });

    it('attaches files pasted into the textarea and dropped on the composer', async () => {
      const { box } = connected('general', 't1', async () => ({}), ALL);
      fireEvent.paste(box, { clipboardData: { files: [note('pegado.txt')], getData: () => '' } });
      await screen.findByText('1/5 adjuntos');
      const dropZone = box.closest('.border-t')!;
      fireEvent.dragEnter(dropZone, { dataTransfer: { types: ['Files'], files: [] } });
      expect(screen.getByText('Soltá los archivos para adjuntarlos')).toBeInTheDocument();
      fireEvent.drop(dropZone, { dataTransfer: { types: ['Files'], files: [note('soltado.txt')] } });
      await screen.findByText('2/5 adjuntos');
    });
  });

  describe('mentions and refs', () => {
    const FEATURES = ['file-search', 'catalog'];
    const snapshot = {
      agents: [{ id: 'sdd-planner', description: 'Planner' }, { id: 'sdd-reviewer', description: 'Reviewer' }],
      skills: [{ id: 'checklist', description: 'Lista', kind: 'skill', path: '.claude/skills/checklist/SKILL.md' }],
    };
    function withMentions(request: (cmd: { cmd: string }) => Promise<unknown>, threadId: string | null = 't1') {
      const ctx = connected('general', threadId, request, FEATURES);
      act(() => ctx.store.getState().setSnapshot(snapshot as never));
      return ctx;
    }
    const type = (box: HTMLElement, value: string) => fireEvent.change(box, { target: { value, selectionStart: value.length } });

    it('opens the agent menu on @, inserts @id and Enter does not send', async () => {
      const { client, box } = withMentions(async () => ({ query: '', files: [], truncated: false, source: 'git' }));
      type(box, '@sdd-pl');
      expect(await screen.findByRole('option', { name: /@sdd-planner/ })).toBeInTheDocument();
      expect(box).toHaveAttribute('aria-expanded', 'true');
      fireEvent.keyDown(box, { key: 'Enter' });
      expect(box).toHaveValue('@sdd-planner ');
      expect(client.request).not.toHaveBeenCalledWith(expect.objectContaining({ cmd: 'thread.send' }));
    });

    it('searches files and inserts the path without the @', async () => {
      const { client, box } = withMentions(async (c) => (c.cmd === 'workspace.searchFiles' ? { query: 'comp', files: [{ path: 'src/Composer.tsx' }], truncated: false, source: 'git' } : {}));
      type(box, 'mirá @comp');
      const option = await screen.findByRole('option', { name: 'src/Composer.tsx' });
      expect(client.request).toHaveBeenCalledWith({ cmd: 'workspace.searchFiles', query: 'comp', limit: 30 });
      fireEvent.mouseDown(option);
      expect(box).toHaveValue('mirá src/Composer.tsx ');
    });

    it('opens the slash menu with commands and skills and inserts /id', async () => {
      const { box } = withMentions(async () => ({}));
      type(box, '/checkl');
      expect(await screen.findByRole('option', { name: /^\/checklist/ })).toBeInTheDocument();
      fireEvent.keyDown(box, { key: 'Tab' });
      expect(box).toHaveValue('/checklist ');
    });

    it('closes the menu with Escape', async () => {
      const { box } = withMentions(async () => ({}));
      type(box, '@sdd');
      await screen.findByRole('listbox');
      fireEvent.keyDown(box, { key: 'Escape' });
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('sends refs for known agents and treats unknown mentions as plain text', async () => {
      const { client, box } = withMentions(async () => ({ delivery: 'started' }));
      type(box, 'hola @sdd-planner y @nadie, gracias');
      fireEvent.keyDown(box, { key: 'Escape' });
      fireEvent.keyDown(box, { key: 'Enter' });
      await waitFor(() => expect(client.request).toHaveBeenCalledWith(expect.objectContaining({ cmd: 'thread.send' })));
      expect(client.request.mock.calls.at(-1)![0]).toMatchObject({
        text: 'hola @sdd-planner y @nadie, gracias',
        refs: { agents: ['sdd-planner'], skills: [] },
      });
    });

    it('sends a leading catalog skill as text with its ref instead of failing as unknown command', async () => {
      const { client, box } = withMentions(async () => ({ delivery: 'started' }));
      type(box, '/checklist el último cambio');
      fireEvent.keyDown(box, { key: 'Enter' });
      await waitFor(() => expect(client.request).toHaveBeenCalled());
      expect(client.request.mock.calls[0]![0]).toMatchObject({ cmd: 'thread.send', text: '/checklist el último cambio', refs: { agents: [], skills: ['checklist'] } });
    });

    it('keeps reporting unknown slash commands that are not in the catalog', async () => {
      const { client, box } = withMentions(async () => ({}));
      type(box, '/nope arg');
      fireEvent.keyDown(box, { key: 'Enter' });
      expect(await screen.findByRole('alert')).toHaveTextContent('Comando desconocido: nope');
      expect(client.request).not.toHaveBeenCalled();
    });
  });

  describe('capability gating', () => {
    const snapshot = { agents: [{ id: 'sdd-planner', description: '' }], skills: [{ id: 'checklist', description: '', kind: 'skill', path: 'p' }] };
    const mountWith = (features: string[]) => {
      const ctx = connected('general', 't1', async () => ({ delivery: 'started' }), features);
      act(() => ctx.store.getState().setSnapshot(snapshot as never));
      return ctx;
    };

    it('shows no attach button, drop zone, menus or refs against a bridge without features', async () => {
      const { client, box } = mountWith([]);
      expect(screen.queryByRole('button', { name: 'Adjuntar archivo' })).toBeNull();
      expect(screen.queryByTestId('attachment-input')).toBeNull();
      fireEvent.change(box, { target: { value: '@sdd-pl', selectionStart: 7 } });
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(box).not.toHaveAttribute('role', 'combobox');
      fireEvent.change(box, { target: { value: '@sdd-planner hola', selectionStart: 17 } });
      fireEvent.keyDown(box, { key: 'Enter' });
      await waitFor(() => expect(client.request).toHaveBeenCalled());
      expect(client.request.mock.calls[0]![0]).toMatchObject({ cmd: 'thread.send', attachments: [], refs: { agents: [], skills: [] } });
    });

    it('only the announced capabilities appear', () => {
      const { box } = mountWith(['attachments']);
      expect(screen.getByRole('button', { name: 'Adjuntar archivo' })).toBeInTheDocument();
      fireEvent.change(box, { target: { value: '@sdd', selectionStart: 4 } });
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('hides the agents group without catalog and the files group without file-search', async () => {
      const { box } = mountWith(['file-search']);
      fireEvent.change(box, { target: { value: '@sdd', selectionStart: 4 } });
      expect(screen.queryByText('Agentes')).toBeNull();
      fireEvent.change(box, { target: { value: '/re', selectionStart: 3 } });
      expect(screen.queryByText('Skills y prompts')).toBeNull();
    });
  });
});

describe('ComposerView focus', () => {
  it('refocuses the textarea after sending without scrolling the page', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    const { box, onSubmit } = setup();
    fireEvent.change(box, { target: { value: 'hola' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    await waitFor(() => expect(focus).toHaveBeenCalledWith({ preventScroll: true }));
    expect(focus.mock.calls.every(([options]) => options?.preventScroll === true)).toBe(true);
    focus.mockRestore();
  });
});
