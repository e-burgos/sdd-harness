import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultThreadOptions, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { Composer } from './Composer';
import { ModeSelectors, type ModeSelectorsProps } from './ModeSelectors';

const spec = (id: string, dependsOn: string[] = []) => ({ id, title: id, status: 'in-progress', folder: 'f', module: null, app: null, dependsOn });
const snapshot = (profile: 'team' | 'solo'): WorkspaceSnapshot => ({
  project: 'p', profile, kitVersion: null, gateMode: 'block', pricing: null, stale: [], skills: [], agents: [],
  specs: [spec('spec-a'), spec('spec-b', ['spec-a']), spec('spec-c')], cycles: [], fixes: [],
}) as unknown as WorkspaceSnapshot;

describe('ModeSelectors', () => {
  const props = (over: Partial<ModeSelectorsProps> = {}): ModeSelectorsProps => ({
    profile: 'team', flow: 'auto', exception: null, canEditProfile: true, profileError: null, onProfileChange: vi.fn(), onFlowChange: vi.fn(), ...over,
  });
  const mount = (p: ModeSelectorsProps) => render(<I18nProvider initial="es"><ModeSelectors {...p} /></I18nProvider>);

  it('has a help icon on each selector and reports changes', () => {
    const p = props();
    mount(p);
    expect(screen.getAllByTestId('help-select')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Modo de desarrollo'), { target: { value: 'solo' } });
    fireEvent.change(screen.getByLabelText('Modo de implementación'), { target: { value: 'lite' } });
    expect(p.onProfileChange).toHaveBeenCalledWith('solo');
    expect(p.onFlowChange).toHaveBeenCalledWith('lite');
  });

  it('tells which flow the cycle will open with', () => {
    mount(props({ profile: 'solo' }));
    expect(screen.getByTestId('mode-effective')).toHaveTextContent('Se abre en LITE');
  });

  it('warns about the full exception only when the cycle would open lite', () => {
    const { unmount } = mount(props({ profile: 'solo', exception: 'depends-on' }));
    expect(screen.getByTestId('mode-exception')).toHaveTextContent('depende de otras');
    unmount();
    mount(props({ profile: 'team', exception: 'depends-on' }));
    expect(screen.queryByTestId('mode-exception')).toBeNull();
  });

  it('locks the profile when the bridge cannot change it and shows a save error', () => {
    mount(props({ canEditProfile: false, profileError: 'boom' }));
    expect(screen.getByLabelText('Modo de desarrollo')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });
});

describe('Composer modes (connected)', () => {
  function connected(channelId: string, threadId: string | null, profile: 'team' | 'solo', features: string[], request: (cmd: { cmd: string }) => Promise<unknown>) {
    const store = createStudioStore();
    store.getState().setSnapshot(snapshot(profile));
    const client = { request: vi.fn(request), supports: (f: string) => features.includes(f) };
    const value = { client, store } as unknown as BridgeContextValue;
    render(
      <I18nProvider initial="es">
        <BridgeContext.Provider value={value}>
          <Composer channelId={channelId} threadId={threadId} onThreadCreated={vi.fn()} />
        </BridgeContext.Provider>
      </I18nProvider>,
    );
    return { client, box: screen.getByPlaceholderText('Escribí un mensaje… (/ para comandos)') };
  }
  const created = (id = 't1') => ({
    id, channelId: 'general', title: 'x', agent: 'sdd-orchestrator', options: defaultThreadOptions(), status: 'idle', createdAt: 'a', lastActivity: 'a',
    link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount: 0,
  });
  const enter = (box: HTMLElement, text: string) => {
    fireEvent.change(box, { target: { value: text } });
    fireEvent.keyDown(box, { key: 'Enter' });
  };
  const textSent = (client: { request: { mock: { calls: unknown[][] } } }) =>
    (client.request.mock.calls.map((c) => c[0] as { cmd: string; text?: string }).find((c) => c.cmd === 'thread.create'))?.text;

  it('sends the request untouched while the mode is automatic', async () => {
    const { client, box } = connected('general', null, 'team', ['profile-set'], async () => created());
    enter(box, 'abrí la spec');
    await waitFor(() => expect(textSent(client)).toBe('abrí la spec'));
  });

  it('prefixes a free request with the chosen implementation mode', async () => {
    const { client, box } = connected('general', null, 'team', ['profile-set'], async () => created());
    fireEvent.change(screen.getByLabelText('Modo de implementación'), { target: { value: 'lite' } });
    enter(box, 'abrí la spec');
    await waitFor(() => expect(textSent(client)).toBe('[LITE] abrí la spec'));
  });

  it('puts the prefix on the arguments of a prompt command', async () => {
    const { client, box } = connected('general', null, 'solo', ['profile-set'], async (c) => (c.cmd === 'workspace.readFile' ? { path: 'p', content: 'PROMPT' } : created()));
    fireEvent.change(screen.getByLabelText('Modo de implementación'), { target: { value: 'full' } });
    enter(box, '/open-cycle spec-a');
    await waitFor(() => expect(textSent(client)).toBe('PROMPT\n\n---\n[FULL] spec-a'));
  });

  it('writes the development mode through the bridge', async () => {
    const { client } = connected('general', null, 'team', ['profile-set'], async () => ({ profile: 'solo' }));
    fireEvent.change(screen.getByLabelText('Modo de desarrollo'), { target: { value: 'solo' } });
    await waitFor(() => expect(client.request).toHaveBeenCalledWith({ cmd: 'profile.set', profile: 'solo' }));
  });

  it('shows the bridge error when the profile cannot be saved', async () => {
    connected('general', null, 'team', ['profile-set'], async () => { throw new Error('sin permiso'); });
    fireEvent.change(screen.getByLabelText('Modo de desarrollo'), { target: { value: 'solo' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cambiar el modo de desarrollo: sin permiso');
  });

  it('disables the profile selector against a bridge without profile.set', () => {
    connected('general', null, 'team', [], async () => ({}));
    expect(screen.getByLabelText('Modo de desarrollo')).toBeDisabled();
  });

  it('warns in a spec that depends on others when the cycle would open lite', () => {
    connected('spec:spec-b', null, 'solo', ['profile-set'], async () => ({}));
    expect(screen.getByTestId('mode-exception')).toBeInTheDocument();
  });

  it.each([['an existing thread', 'general', 't1'], ['a DM', 'dm:sdd-planner', null], ['the fixes channel', 'fixes', null]] as const)(
    'does not show the modes inside %s',
    (_label, channel, thread) => {
      connected(channel, thread, 'team', ['profile-set'], async () => ({}));
      expect(screen.queryByTestId('mode-selectors')).toBeNull();
    },
  );
});
