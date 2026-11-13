import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { BotEvent, KitIndex, KitIntegrationStatus, KitToolsState, ServerEvent, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { BridgeError } from '@/lib/bridge/client';
import { bridgeValue, renderShell, shellSnapshot } from '../../shell/shell-test-utils';
import { kitModule } from './index';

const { Panel, Center, Scope } = kitModule;
const Provider = Scope as NonNullable<typeof Scope>;

const entry = (section: string, role: string, group: string | null, path: string) => ({ section, role, group, path, size: 10, mtime: '2026-01-01T00:00:00Z' });

const INDEX: KitIndex = {
  revision: 'r1',
  truncated: false,
  entries: [
    entry('docs', 'doc', 'es', 'sdd/documentation/es/README.md'),
    entry('docs', 'doc', 'en', 'sdd/documentation/en/INSTALL.md'),
    entry('schemas', 'schema', null, 'sdd/schemas/cycle.schema.json'),
    entry('context', 'base', 'apps/studio', 'sdd/context/apps/studio/constitution.md'),
    entry('context', 'update', 'apps/studio', 'sdd/context/apps/studio/updates/2026-10-01-x.md'),
    entry('memory', 'lessons', null, 'sdd/memory/lessons.md'),
    entry('memory', 'journal', null, 'sdd/memory/journal/2026-10-27-a.md'),
  ],
};

const TOOLS: KitToolsState = { status: 'ok', rtkEnabled: true, modEnabled: false, gate: 'block', modLinked: true, revision: 'aaaaaaaaaaaaaaaa' };

const snapshot = (tools?: KitToolsState): WorkspaceSnapshot => ({
  ...shellSnapshot,
  skills: [
    { id: 'sdd-steward', kind: 'skill', description: 'Conserje del kit', source: 'sdd', path: 'sdd/skills/sdd-steward/SKILL.md' },
    { id: 'start-sdd-cycle.prompt', kind: 'prompt', description: 'Abre un ciclo', source: 'sdd', path: 'sdd/prompts/start.md' },
    { id: 'local-skill', kind: 'skill', description: 'Del proyecto', source: 'claude', path: '.claude/skills/local/SKILL.md' },
  ],
  tools,
});

const FILES: Record<string, string> = {
  'sdd/documentation/es/README.md': '# Hola kit',
  'sdd/documentation/en/INSTALL.md': '# Install guide',
  'sdd/schemas/cycle.schema.json': '{"title":"Cycle"}',
  'sdd/context/apps/studio/constitution.md': '# Constitution base',
  'sdd/context/apps/studio/updates/2026-10-01-x.md': '# Fragmento nuevo',
  'sdd/memory/lessons.md': '# Lecciones',
  'sdd/skills/sdd-steward/SKILL.md': '# Steward definition',
  'sdd/prompts/start.md': '# Start prompt',
};

interface Harness {
  features: string[];
  tools?: KitToolsState;
  setResult?: (cmd: Record<string, unknown>) => unknown;
  indexFails?: boolean;
  connected?: boolean;
  readError?: BridgeError;
  integrationStatus?: Partial<Record<string, KitIntegrationStatus>>;
  integrationSet?: (cmd: Record<string, unknown>) => unknown;
}

function setup(selected: string | null, options: Harness = { features: ['kit-index', 'kit-tools'], tools: TOOLS }) {
  const requests: Record<string, unknown>[] = [];
  const listeners = new Set<(event: ServerEvent) => void>();
  const client = {
    supports: (feature: string) => options.features.includes(feature),
    onEvent: (fn: (event: ServerEvent) => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    request: async (cmd: Record<string, unknown>) => {
      requests.push(cmd);
      switch (cmd.cmd) {
        case 'kit.index':
          if (options.indexFails) throw new BridgeError('internal', 'boom');
          return INDEX;
        case 'workspace.readFile':
          if (options.readError) throw options.readError;
          return { path: cmd.path, content: FILES[cmd.path as string] ?? '' };
        case 'channel.botHistory':
          return [];
        case 'kit.tools.set':
          return options.setResult?.(cmd);
        case 'kit.integration.status':
          return options.integrationStatus?.[cmd.integration as string] ?? {};
        case 'kit.integration.set':
          return options.integrationSet?.(cmd);
        case 'workspace.snapshot':
          return snapshot({ ...TOOLS, rtkEnabled: false, revision: 'bbbbbbbbbbbbbbbb' });
        default:
          return {};
      }
    },
  };
  const value = bridgeValue({ client, connection: { status: options.connected === false ? 'reconnecting' : 'open' } } as never, snapshot(options.tools));
  if (selected) {
    window.localStorage.setItem(
      'sdd-studio.nav.v1:fixture-project',
      JSON.stringify({ module: 'kit', selection: { specs: null, fixes: null, agents: null, kit: selected, architecture: null, metrics: null }, specTab: 'summary', specCycle: null, home: { kind: 'channel', channelId: 'general' }, filters: { homeConversations: 'active', specs: 'active', map: 'all', activity: ['spec', 'fix', 'agent', 'tools'] } }),
    );
  }
  const view = renderShell(
    <Provider>
      <Panel />
      <Center />
    </Provider>,
    { value },
  );
  return { ...view, value, requests, emit: (event: ServerEvent) => act(() => listeners.forEach((fn) => fn(event))) };
}

describe('Kit panel', () => {
  beforeEach(() => window.localStorage.clear());

  it('lists the four groups with counts and only the kit capabilities', async () => {
    const { container } = setup(null);
    const groups = [...container.querySelectorAll('[data-panel-group]')].map((g) => g.getAttribute('data-panel-group'));
    expect(groups).toEqual(['capabilities', 'tools', 'docs', 'project']);
    const capabilities = container.querySelector('[data-panel-group="capabilities"]') as HTMLElement;
    expect(within(capabilities).getByText('Skills').parentElement).toHaveTextContent('1');
    expect(within(capabilities).getByText('Prompts').parentElement).toHaveTextContent('1');
    await waitFor(() => expect(within(container.querySelector('[data-panel-group="project"]') as HTMLElement).getByText('Schemas JSON').parentElement).toHaveTextContent('1'));
  });

  it('shows a read-only notice when the bridge lacks kit-index and keeps the documents reachable', async () => {
    setup('doc:readme', { features: [], tools: TOOLS });
    expect(await screen.findByText(/no ofrece el índice del kit/)).toBeInTheDocument();
    expect(await screen.findByText('Hola kit')).toBeInTheDocument();
  });

  it('offers a retry when the index cannot be read', async () => {
    setup(null, { features: ['kit-index'], indexFails: true });
    expect(await screen.findByText('No se pudo leer el índice del kit.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('refreshes the index when the bridge announces kit.changed', async () => {
    const { requests, emit } = setup(null);
    await waitFor(() => expect(requests.filter((r) => r.cmd === 'kit.index')).toHaveLength(1));
    emit({ kind: 'kit.changed', sections: ['docs'], revision: 'r2' });
    await waitFor(() => expect(requests.filter((r) => r.cmd === 'kit.index')).toHaveLength(2));
  });

  it('requests the #general history with the kit events when the bridge supports kit-tools', async () => {
    const { requests } = setup(null);
    await waitFor(() => expect(requests).toContainEqual({ cmd: 'channel.botHistory', channelId: 'general', limit: 100, includeKitEvents: true }));
  });
});

describe('Kit center content', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows kit skills with description and invoke command, not project ones', () => {
    setup('skills');
    expect(screen.getByText('sdd-steward')).toBeInTheDocument();
    expect(screen.getByText('/sdd-steward')).toBeInTheDocument();
    expect(screen.queryByText('local-skill')).not.toBeInTheDocument();
  });

  it('opens the definition of the first skill read-only and switches on selection', async () => {
    const { requests } = setup('skills');
    expect(await screen.findByRole('heading', { name: 'Steward definition' })).toBeInTheDocument();
    expect(requests).toContainEqual({ cmd: 'workspace.readFile', path: 'sdd/skills/sdd-steward/SKILL.md' });
  });

  describe('open skill refresh', () => {
    const reads = (requests: Record<string, unknown>[]) => requests.filter((r) => r.cmd === 'workspace.readFile' && r.path === 'sdd/skills/sdd-steward/SKILL.md');
    const STEWARD = { id: 'sdd-steward', kind: 'skill', description: 'Conserje del kit', source: 'sdd', path: 'sdd/skills/sdd-steward/SKILL.md' } as const;
    const OTHER = { id: 'sdd-other', kind: 'skill', description: 'Otra skill', source: 'sdd', path: 'sdd/skills/sdd-other/SKILL.md' } as const;
    const skillsChanged = (value: ReturnType<typeof setup>['value'], skills: WorkspaceSnapshot['skills'], areas: ('agents' | 'specs')[] = ['agents']) =>
      act(() => value.store.getState().receive({ kind: 'workspace.changed', areas, snapshot: { ...snapshot(TOOLS), skills } }));

    it('asks for the skill again when its own summary changes and keeps the document mounted', async () => {
      const { requests, value } = setup('skills');
      const heading = await screen.findByRole('heading', { name: 'Steward definition' });
      expect(reads(requests)).toHaveLength(1);
      skillsChanged(value, [{ ...STEWARD, description: 'Conserje actualizado' }]);
      await waitFor(() => expect(reads(requests)).toHaveLength(2));
      expect(screen.getByRole('heading', { name: 'Steward definition' })).toBe(heading);
      expect(screen.queryByRole('status', { name: 'Cargando documento' })).not.toBeInTheDocument();
    });

    it('does not ask again when another skill changes, is added, or the change is outside the catalog', async () => {
      const { requests, value, emit } = setup('skills');
      await screen.findByRole('heading', { name: 'Steward definition' });
      skillsChanged(value, [STEWARD, OTHER]);
      skillsChanged(value, [STEWARD, { ...OTHER, description: 'Otra skill editada' }]);
      skillsChanged(value, [STEWARD, OTHER], ['specs']);
      emit({ kind: 'kit.changed', sections: ['docs'], revision: 'r2' });
      await waitFor(() => expect(requests.filter((r) => r.cmd === 'kit.index')).toHaveLength(2));
      expect(reads(requests)).toHaveLength(1);
    });

    it('shows the empty state when the catalog no longer has any skill', async () => {
      const { value } = setup('skills');
      await screen.findByRole('heading', { name: 'Steward definition' });
      skillsChanged(value, []);
      expect(await screen.findByText('Este workspace todavía no tiene elementos del kit en esta sección')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Steward definition' })).not.toBeInTheDocument();
    });

    it('shows a removed notice instead of another skill when the open one is deleted while others remain', async () => {
      const { value } = setup('skills');
      await screen.findByRole('heading', { name: 'Steward definition' });
      skillsChanged(value, [STEWARD, OTHER]);
      fireEvent.click(await screen.findByRole('button', { name: 'Ver definición de sdd-other' }));
      skillsChanged(value, [STEWARD]);
      expect(await screen.findByText('El elemento que estabas leyendo ya no existe en el kit')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Steward definition' })).not.toBeInTheDocument();
    });
  });

  it('opens the definition of a prompt when it is picked', async () => {
    const { requests } = setup('prompts');
    fireEvent.click(await screen.findByRole('button', { name: 'Ver definición de start-sdd-cycle.prompt' }));
    expect(await screen.findByRole('heading', { name: 'Start prompt' })).toBeInTheDocument();
    expect(requests).toContainEqual({ cmd: 'workspace.readFile', path: 'sdd/prompts/start.md' });
  });

  it('filters the items of the active section with the kit search, not only the section labels', async () => {
    setup('skills');
    fireEvent.change(screen.getByLabelText('Buscar en Kit'), { target: { value: 'conserje' } });
    expect(screen.getByText('sdd-steward')).toBeInTheDocument();
    expect(within(document.querySelector('[data-panel-group="capabilities"]') as HTMLElement).getByText('Skills')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar en Kit'), { target: { value: 'zzzz' } });
    expect(screen.queryByText('sdd-steward')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Sin resultados para/).length).toBeGreaterThan(0);
  });

  it('filters file lists by file name', async () => {
    setup('context');
    const nav = await screen.findByRole('navigation', { name: 'Archivos de Contexto' });
    fireEvent.change(screen.getByLabelText('Buscar en Kit'), { target: { value: 'fragmento' } });
    expect(within(nav).queryByRole('button', { name: /constitution/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar en Kit'), { target: { value: '2026-10-01' } });
    expect(within(await screen.findByRole('navigation', { name: 'Archivos de Contexto' })).getByRole('button', { name: /2026-10-01-x/ })).toBeInTheDocument();
  });

  it.each([
    ['not-found', 'El archivo no existe en el workspace'],
    ['bad-request', 'El archivo es demasiado grande para mostrarlo'],
  ])('shows the bridge reason when a file cannot be read (%s)', async (code, reason) => {
    setup('doc:readme', { features: ['kit-index', 'kit-tools'], tools: TOOLS, readError: new BridgeError(code, code === 'bad-request' ? 'file too large' : 'missing') });
    expect(await screen.findByText(reason)).toBeInTheDocument();
  });

  it('shows copied only after the clipboard accepts the command', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup('skills');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar comando /sdd-steward' }));
    expect(await screen.findByRole('button', { name: 'Comando copiado' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith('/sdd-steward');
  });

  it('does not show copied when the clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup('skills');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar comando /sdd-steward' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Comando copiado' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar comando /sdd-steward' })).toBeInTheDocument();
  });

  it('renders the documentation of the UI language with the markdown renderer', async () => {
    setup('doc:readme');
    expect(await screen.findByRole('heading', { name: 'Hola kit' })).toBeInTheDocument();
  });

  it('tells the user when the document only exists in the other language', async () => {
    setup('doc:install');
    expect(await screen.findByText('No hay versión en español: se muestra la de inglés.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Install guide' })).toBeInTheDocument();
  });

  it('pretty-prints schemas', async () => {
    setup('schemas');
    const file = await screen.findByTestId('kit-file');
    await waitFor(() => expect(file.querySelector('pre')?.textContent).toBe('{\n  "title": "Cycle"\n}'));
  });

  it('lists context base then fragments and opens a fragment on demand', async () => {
    setup('context');
    const nav = await screen.findByRole('navigation', { name: 'Archivos de Contexto' });
    const labels = within(nav).getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['constitution.mdbase', '2026-10-01-x.mdfragmento']);
    expect(await screen.findByRole('heading', { name: 'Constitution base' })).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole('button', { name: /2026-10-01-x/ }));
    expect(await screen.findByRole('heading', { name: 'Fragmento nuevo' })).toBeInTheDocument();
  });

  it('shows lessons and the journal index', async () => {
    const { unmount } = setup('memory:lessons');
    expect(await screen.findByRole('heading', { name: 'Lecciones' , level: 1 })).toBeInTheDocument();
    unmount();
    window.localStorage.clear();
    setup('memory:journal');
    expect(await screen.findByRole('button', { name: /2026-10-27-a/ })).toBeInTheDocument();
  });
});

describe('Kit tools', () => {
  beforeEach(() => window.localStorage.clear());

  const okResult = (tools: KitToolsState, over: Record<string, unknown> = {}) => ({ changed: true, tool: 'rtk', from: true, to: false, tools, warnings: [], ...over });

  it('asks for confirmation and only then sends kit.tools.set with the expected revision', async () => {
    const next = { ...TOOLS, rtkEnabled: false, revision: 'cccccccccccccccc' };
    const { requests, value } = setup('tools', { features: ['kit-index', 'kit-tools'], tools: TOOLS, setResult: () => okResult(next) });
    fireEvent.click(screen.getByRole('switch', { name: 'rtk' }));
    expect(requests.some((r) => r.cmd === 'kit.tools.set')).toBe(false);
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('rtk: Activado → Desactivado.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cambiar' }));
    await waitFor(() => expect(requests).toContainEqual({ cmd: 'kit.tools.set', change: { tool: 'rtk', enabled: false }, expectedRevision: 'aaaaaaaaaaaaaaaa' }));
    await waitFor(() => expect(value.store.getState().snapshot?.tools?.revision).toBe('cccccccccccccccc'));
    expect(await screen.findByText('rtk quedó en Desactivado.')).toBeInTheDocument();
  });

  it('sends the revision the dialog was opened against even if the snapshot changes meanwhile', async () => {
    const { requests, value } = setup('tools', {
      features: ['kit-index', 'kit-tools'],
      tools: TOOLS,
      setResult: () => {
        throw new BridgeError('conflict', 'changed');
      },
    });
    fireEvent.click(screen.getByRole('switch', { name: 'rtk' }));
    const dialog = await screen.findByRole('alertdialog');
    act(() => value.store.getState().setSnapshot(snapshot({ ...TOOLS, revision: 'bbbbbbbbbbbbbbbb' })));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cambiar' }));
    await waitFor(() => expect(requests).toContainEqual({ cmd: 'kit.tools.set', change: { tool: 'rtk', enabled: false }, expectedRevision: 'aaaaaaaaaaaaaaaa' }));
    expect(await screen.findByText(/cambió mientras lo editabas/)).toBeInTheDocument();
  });

  it('does nothing when the confirmation is cancelled', async () => {
    const { requests } = setup('tools');
    fireEvent.click(screen.getByRole('radio', { name: 'Avisar' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/deja de rechazar ediciones sin ciclo/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(requests.some((r) => r.cmd === 'kit.tools.set')).toBe(false);
  });

  it('on conflict reloads the snapshot and tells the user', async () => {
    const { value } = setup('tools', {
      features: ['kit-index', 'kit-tools'],
      tools: TOOLS,
      setResult: () => {
        throw new BridgeError('conflict', 'changed');
      },
    });
    fireEvent.click(screen.getByRole('switch', { name: 'rtk' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cambiar' }));
    expect(await screen.findByText(/cambió mientras lo editabas/)).toBeInTheDocument();
    await waitFor(() => expect(value.store.getState().snapshot?.tools?.revision).toBe('bbbbbbbbbbbbbbbb'));
  });

  it.each([
    ['not-found', /ya no existe/],
    ['bad-request', /El puente rechazó el cambio: invalid/],
  ])('reports a %s error and keeps the previous value', async (code, message) => {
    const { value } = setup('tools', {
      features: ['kit-index', 'kit-tools'],
      tools: TOOLS,
      setResult: () => {
        throw new BridgeError(code, 'invalid');
      },
    });
    fireEvent.click(screen.getByRole('switch', { name: 'rtk' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cambiar' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    if (code === 'bad-request') expect(value.store.getState().snapshot?.tools?.rtkEnabled).toBe(true);
  });

  it('shows unknown instead of a fabricated value when the tools state is unavailable', () => {
    setup('tools', { features: ['kit-index', 'kit-tools'], tools: undefined });
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getAllByTestId('kit-tool-unknown')).toHaveLength(3);
  });

  it('shows unknown for an invalid sdd/tools.json', () => {
    setup('tools', { features: ['kit-index', 'kit-tools'], tools: { status: 'invalid', rtkEnabled: null, modEnabled: null, gate: null, modLinked: false, revision: null } });
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getAllByTestId('kit-tool-unknown')).toHaveLength(3);
  });

  it('warns when the mod is on but not linked', () => {
    setup('tools', { features: ['kit-index', 'kit-tools'], tools: { ...TOOLS, modEnabled: true, modLinked: false } });
    expect(screen.getByTestId('kit-tools-mod-warning')).toHaveTextContent('pnpm setup:agents');
  });

  it('is read-only with an explanation when the bridge lacks kit-tools', () => {
    setup('tools', { features: ['kit-index'], tools: TOOLS });
    expect(screen.getByTestId('kit-tools-readonly')).toHaveTextContent('kit-tools');
    expect(screen.getByRole('switch', { name: 'rtk' })).toBeDisabled();
  });

  it('is read-only while disconnected', () => {
    setup('tools', { features: ['kit-index', 'kit-tools'], tools: TOOLS, connected: false });
    expect(screen.getByRole('switch', { name: 'rtk' })).toBeDisabled();
    expect(screen.getByTestId('kit-tools-readonly')).toHaveTextContent('Sin conexión');
  });

  it('shows the tools.changed events in the #general history it requests', async () => {
    const { value } = setup('tools');
    const event: BotEvent = { channelId: 'general', botKind: 'tools.changed', payload: { tool: 'rtk', from: true, to: false }, at: '2026-10-27T10:00:00Z' };
    act(() => value.store.getState().receive({ kind: 'bot.event', ...event }));
    expect(value.store.getState().bot['general']).toContainEqual(event);
  });
});

describe('Kit integrations', () => {
  beforeEach(() => window.localStorage.clear());

  const status = (integration: 'tucu-ui' | 'video-maker', patch: Partial<KitIntegrationStatus> = {}): KitIntegrationStatus => ({
    integration, available: true, enabled: false, state: 'off', parts: {}, version: '0.16.0', kitVersion: '0.16.0', updateAvailable: false, nodeOk: true,
    harnesses: { claude: 'incomplete', copilot: 'incomplete', gemini: 'incomplete', antigravity: 'incomplete' }, repair: null, ...patch,
  });
  const FEATURES = ['kit-index', 'kit-tools', 'kit-integrations'];
  const both = (patch: Partial<KitIntegrationStatus> = {}) => ({ 'tucu-ui': status('tucu-ui', patch), 'video-maker': status('video-maker', patch) });

  it('is hidden when the bridge lacks kit-integrations and asks nothing', () => {
    const { requests } = setup('tools', { features: ['kit-index', 'kit-tools'], tools: TOOLS });
    expect(screen.queryByTestId('kit-integrations')).toBeNull();
    expect(requests.some((r) => r.cmd === 'kit.integration.status')).toBe(false);
  });

  it('loads both statuses on mount and renders a card per integration', async () => {
    const { requests } = setup('tools', { features: FEATURES, tools: TOOLS, integrationStatus: both() });
    expect(await screen.findByTestId('integration-state-tucu-ui')).toHaveTextContent('Desactivada');
    expect(requests).toContainEqual({ cmd: 'kit.integration.status', integration: 'tucu-ui' });
    expect(requests).toContainEqual({ cmd: 'kit.integration.status', integration: 'video-maker' });
    expect(screen.getByTestId('integration-tucu-ui')).toHaveTextContent('Skill de diseño y MCP para frontends React/Next');
    expect(screen.getByTestId('integration-tucu-ui')).toHaveTextContent('Necesita red la primera vez');
    expect(screen.getByTestId('integration-video-maker')).toHaveTextContent('Node 22+');
    expect(screen.getByRole('switch', { name: 'tucu-ui' })).not.toBeChecked();
  });

  it('shows the harness chips, version and update notice when active', async () => {
    setup('tools', {
      features: FEATURES, tools: TOOLS,
      integrationStatus: { 'tucu-ui': status('tucu-ui', { enabled: true, state: 'complete', updateAvailable: true, harnesses: { claude: 'complete', copilot: 'complete', gemini: 'incomplete', antigravity: 'complete' } }), 'video-maker': status('video-maker') },
    });
    expect(await screen.findByTestId('integration-state-tucu-ui')).toHaveTextContent('Activa');
    expect(screen.getByRole('switch', { name: 'tucu-ui' })).toBeChecked();
    expect(screen.getByTestId('integration-harness-claude')).toHaveTextContent('completo');
    expect(screen.getByTestId('integration-harness-gemini')).toHaveTextContent('incompleto');
    expect(screen.getByTestId('integration-tucu-ui')).toHaveTextContent('v0.16.0');
    expect(screen.getByTestId('integration-tucu-ui')).toHaveTextContent('actualización disponible');
  });

  it('toggling sends kit.integration.set, shows the busy state and applies the returned status', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const result = new Promise((resolve) => { finish = resolve; });
    const { requests } = setup('tools', { features: FEATURES, tools: TOOLS, integrationStatus: both(), integrationSet: () => result });
    await screen.findByTestId('integration-state-tucu-ui');
    fireEvent.click(screen.getByRole('switch', { name: 'tucu-ui' }));
    expect(await screen.findByTestId('integration-busy-tucu-ui')).toHaveTextContent('Activando');
    expect(screen.getByRole('switch', { name: 'tucu-ui' })).toBeDisabled();
    expect(requests).toContainEqual({ cmd: 'kit.integration.set', integration: 'tucu-ui', enabled: true });
    await act(async () => finish({ ok: true, exitCode: 0, output: 'on', status: status('tucu-ui', { enabled: true, state: 'complete' }) }));
    await waitFor(() => expect(screen.getByTestId('integration-state-tucu-ui')).toHaveTextContent('Activa'));
    expect(screen.queryByTestId('integration-busy-tucu-ui')).toBeNull();
    expect(screen.queryByTestId('integration-failure-tucu-ui')).toBeNull();
  });

  it('a failed attempt shows the trimmed output in an alert and keeps the previous state', async () => {
    setup('tools', {
      features: FEATURES, tools: TOOLS, integrationStatus: both(),
      integrationSet: () => ({ ok: false, exitCode: 1, output: 'npx exploded', status: status('tucu-ui') }),
    });
    await screen.findByTestId('integration-state-tucu-ui');
    fireEvent.click(screen.getByRole('switch', { name: 'tucu-ui' }));
    const alert = await screen.findByTestId('integration-failure-tucu-ui');
    expect(alert).toHaveTextContent('El último intento falló.');
    expect(alert).toHaveTextContent('npx exploded');
    expect(screen.getByTestId('integration-state-tucu-ui')).toHaveTextContent('Desactivada');
  });

  it('a rejected request also surfaces as a failure', async () => {
    setup('tools', {
      features: FEATURES, tools: TOOLS, integrationStatus: both(),
      integrationSet: () => { throw new BridgeError('internal', 'bridge down'); },
    });
    await screen.findByTestId('integration-state-tucu-ui');
    fireEvent.click(screen.getByRole('switch', { name: 'video-maker' }));
    expect(await screen.findByTestId('integration-failure-video-maker')).toHaveTextContent('bridge down');
  });

  it('an incomplete integration offers Reparar, which re-enables it', async () => {
    const { requests } = setup('tools', {
      features: FEATURES, tools: TOOLS,
      integrationStatus: { 'tucu-ui': status('tucu-ui', { enabled: true, state: 'incomplete' }), 'video-maker': status('video-maker') },
      integrationSet: () => ({ ok: true, exitCode: 0, output: '', status: status('tucu-ui', { enabled: true, state: 'complete' }) }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Reparar' }));
    await waitFor(() => expect(requests).toContainEqual({ cmd: 'kit.integration.set', integration: 'tucu-ui', enabled: true }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reparar' })).toBeNull());
  });

  it('an unavailable integration is disabled with the reason', async () => {
    setup('tools', {
      features: FEATURES, tools: TOOLS,
      integrationStatus: { 'tucu-ui': status('tucu-ui', { available: false, state: 'unavailable' }), 'video-maker': status('video-maker') },
    });
    expect(await screen.findByTestId('integration-unavailable-tucu-ui')).toHaveTextContent('sdd/scripts');
    expect(screen.getByRole('switch', { name: 'tucu-ui' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'video-maker' })).toBeEnabled();
  });

  it('disables the switches while disconnected', async () => {
    setup('tools', { features: FEATURES, tools: TOOLS, integrationStatus: both(), connected: false });
    expect(screen.getByRole('switch', { name: 'tucu-ui' })).toBeDisabled();
    expect(screen.getByTestId('kit-integrations')).toHaveTextContent('Sin conexión');
  });
});
