import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { DEFAULT_CLAUDE_TOOLS_CONFIG, type ClaudeCounts, type ClaudeInventory, type ClaudeToolsConfig, type ServerEvent } from '@sdd-studio/protocol';
import { BridgeError } from '@/lib/bridge/client';
import { bridgeValue, renderShell } from '../../shell/shell-test-utils';
import { ChromeBanner } from '../../ChromeBanner';
import { claudeModule } from './index';

const { Panel, Center, Scope } = claudeModule;
const Provider = Scope as NonNullable<typeof Scope>;

const WAIT = { timeout: 4000 };
const REVISION = 'aaaaaaaaaaaaaaaa';

const counts = (over: Partial<ClaudeCounts> = {}): ClaudeCounts => ({ skills: 0, agents: 0, plugins: 0, mcpServers: 0, mcpTools: 0, ...over });

const INVENTORY: ClaudeInventory = {
  capturedAt: '2026-11-20T10:00:00Z',
  plugins: [
    { id: 'tools@market', name: 'tools', scope: 'user' },
    { id: 'repo@market', name: 'repo', scope: 'project' },
  ],
  mcpServers: [
    { name: 'github', status: 'connected', source: 'user' },
    { name: 'docs', status: 'needs-auth', source: 'project' },
  ],
  counts: { project: counts({ skills: 10, agents: 2 }), all: counts({ skills: 30, agents: 4, plugins: 2, mcpServers: 2, mcpTools: 12 }) },
};

interface Options {
  features?: string[];
  config?: ClaudeToolsConfig;
  inventory?: ClaudeInventory | null;
  setHandler?: (cmd: Record<string, unknown>) => unknown;
  refreshed?: ClaudeInventory;
  connected?: boolean;
  scope?: 'global' | 'project';
  chrome?: { state: string; detail?: string | null };
  handle?: (cmd: Record<string, unknown>) => unknown;
}

function setup(section: string | null, options: Options = {}) {
  const requests: Array<Record<string, unknown>> = [];
  const listeners = new Set<(event: ServerEvent) => void>();
  const features = options.features ?? ['claude-tools'];
  const client = {
    state: { status: 'open' },
    supports: (feature: string) => features.includes(feature),
    onEvent: (fn: (event: ServerEvent) => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    request: (cmd: Record<string, unknown>) => {
      requests.push(cmd);
      switch (cmd.cmd) {
        case 'claude.tools.get':
          return Promise.resolve({ config: options.config ?? DEFAULT_CLAUDE_TOOLS_CONFIG, revision: REVISION, inventory: options.inventory === undefined ? INVENTORY : options.inventory, browserMcpVersion: '1.13.0', ...(options.scope ? { scope: options.scope, hasProjectOverride: options.scope === 'project' } : {}) });
        case 'claude.tools.set':
          return Promise.resolve(options.setHandler ? options.setHandler(cmd) : { config: cmd.config, revision: 'bbbbbbbbbbbbbbbb', changed: true });
        case 'claude.tools.useGlobal':
          return Promise.resolve({ config: options.config ?? DEFAULT_CLAUDE_TOOLS_CONFIG, revision: 'dddddddddddddddd', inventory: INVENTORY, browserMcpVersion: '1.13.0', scope: 'global', hasProjectOverride: false });
        case 'claude.inventory.refresh':
          return Promise.resolve({ inventory: options.refreshed ?? INVENTORY });
        case 'claude.browser.check':
          return Promise.resolve({ state: 'connected', detail: null, ...options.chrome, checkedAt: '2026-11-20T10:00:00Z' });
        default:
          if (options.handle) return Promise.resolve(options.handle(cmd));
          return Promise.resolve({});
      }
    },
  };
  const value = bridgeValue({ client, connection: { status: options.connected === false ? 'reconnecting' : 'open' } } as never);
  if (section) {
    window.localStorage.setItem(
      'sdd-studio.nav.v1:fixture-project',
      JSON.stringify({ module: 'claude', selection: { specs: null, fixes: null, agents: null, kit: null, claude: section, architecture: null, metrics: null }, specTab: 'summary', specCycle: null, home: { kind: 'channel', channelId: 'general' }, filters: { homeConversations: 'active', specs: 'active', map: 'all', activity: [] } }),
    );
  }
  const view = renderShell(
    <Provider>
      <ChromeBanner />
      <Panel />
      <Center />
    </Provider>,
    { value },
  );
  return { ...view, requests, emit: (event: ServerEvent) => act(() => listeners.forEach((fn) => fn(event))) };
}

const sets = (requests: Array<Record<string, unknown>>) => requests.filter((r) => r.cmd === 'claude.tools.set');

describe('Claude module', () => {
  beforeEach(() => window.localStorage.clear());

  it('lists the four sections in the panel', async () => {
    const { container } = setup(null);
    const rows = container.querySelectorAll('[data-panel-group="sections"] button');
    expect([...rows].map((row) => row.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Fuentes'), expect.stringContaining('Plugins'), expect.stringContaining('MCP'), expect.stringContaining('Navegador')]));
    await waitFor(() => expect(within(container.querySelector('[data-panel-group="sections"]') as HTMLElement).getByText('Plugins').parentElement).toHaveTextContent('2'), WAIT);
  });

  it('shows sources with project fixed on and the counts of the inventory', async () => {
    setup('sources');
    const card = await screen.findByTestId('claude-sources', undefined, WAIT);
    expect(within(card).getByRole('switch', { name: 'Proyecto' })).toBeDisabled();
    expect(within(card).getByRole('switch', { name: 'Usuario' })).not.toBeChecked();
    expect(screen.getByText(/desde el próximo turno de cada conversación/)).toBeInTheDocument();
    expect(screen.getByTestId('claude-counts')).toHaveTextContent('+20');
  });

  it('sends set with the expected revision when a source is toggled', async () => {
    const { requests } = setup('sources');
    const card = await screen.findByTestId('claude-sources', undefined, WAIT);
    fireEvent.click(within(card).getByRole('switch', { name: 'Usuario' }));
    await waitFor(() => expect(sets(requests)).toHaveLength(1), WAIT);
    expect(sets(requests)[0]).toMatchObject({ cmd: 'claude.tools.set', expectedRevision: REVISION, config: { sources: { user: true, local: false } } });
    expect(await screen.findByTestId('claude-notice', undefined, WAIT)).toHaveTextContent('Guardado');
  });

  it('warns about cost with the numbers once a source is on and the threshold is passed', async () => {
    const heavy: ClaudeInventory = { ...INVENTORY, counts: { project: counts({ skills: 10 }), all: counts({ skills: 150, mcpTools: 12 }) } };
    setup('sources', { config: { ...DEFAULT_CLAUDE_TOOLS_CONFIG, sources: { user: true, local: false } }, inventory: heavy });
    expect(await screen.findByTestId('claude-cost-warning', undefined, WAIT)).toHaveTextContent('140 skills');
  });

  it('turns a plugin off by id and flags plugins whose source is off', async () => {
    const { requests } = setup('plugins');
    const card = await screen.findByTestId('claude-plugins', undefined, WAIT);
    expect(card).toHaveTextContent('No se carga');
    fireEvent.click(within(card).getByRole('switch', { name: 'repo' }));
    await waitFor(() => expect(sets(requests)).toHaveLength(1), WAIT);
    expect(sets(requests)[0]).toMatchObject({ config: { disabledPlugins: ['repo@market'] } });
  });

  it('shows MCP status badges, the auth hint and turns a server off by name', async () => {
    const { requests } = setup('mcp', { config: { ...DEFAULT_CLAUDE_TOOLS_CONFIG, disabledMcpServers: ['github'] } });
    const card = await screen.findByTestId('claude-mcp', undefined, WAIT);
    expect(within(card).getByTestId('claude-mcp-status-github')).toHaveTextContent('apagado en Studio');
    expect(within(card).getByTestId('claude-mcp-status-docs')).toHaveTextContent('requiere autenticación');
    expect(card).toHaveTextContent('/mcp');
    fireEvent.click(within(card).getByRole('switch', { name: 'docs' }));
    await waitFor(() => expect(sets(requests)).toHaveLength(1), WAIT);
    expect(sets(requests)[0]).toMatchObject({ config: { disabledMcpServers: ['github', 'docs'] } });
  });

  it('enables the browser, validates the url and lists Claude in Chrome as unavailable', async () => {
    const { requests } = setup('browser');
    const card = await screen.findByTestId('claude-browser', undefined, WAIT);
    expect(card).toHaveTextContent('1.13.0');
    expect(card).toHaveTextContent('Studio usa su propio Chrome');
    expect(card).toHaveTextContent('~/.sdd-studio/chrome-profile');
    expect(card).not.toHaveTextContent('chrome://inspect');
    expect(card).not.toHaveTextContent('--autoConnect');
    fireEvent.click(within(card).getByRole('switch', { name: 'Chrome (DevTools)' }));
    await waitFor(() => expect(sets(requests)).toHaveLength(1), WAIT);
    expect(sets(requests)[0]).toMatchObject({ config: { browser: { enabled: false, browserUrl: null } } });
    const input = within(card).getByLabelText('URL de depuración (avanzado)');
    fireEvent.change(input, { target: { value: 'ws://nope' } });
    expect(within(card).getByRole('alert')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Guardar URL' })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'http://127.0.0.1:9222' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Guardar URL' }));
    await waitFor(() => expect(sets(requests)).toHaveLength(2), WAIT);
    expect(sets(requests)[1]).toMatchObject({ config: { browser: { browserUrl: 'http://127.0.0.1:9222' } } });
    const inChrome = screen.getByTestId('claude-in-chrome');
    expect(inChrome).toHaveTextContent('no disponible');
    expect(within(inChrome).queryByRole('switch')).toBeNull();
  });

  it('asks for a refresh when there is no inventory and then loads it', async () => {
    const { requests } = setup('plugins', { inventory: null });
    expect(await screen.findByTestId('claude-inventory-empty', undefined, WAIT)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Actualizar inventario/ }));
    await waitFor(() => expect(requests.some((r) => r.cmd === 'claude.inventory.refresh')).toBe(true), WAIT);
    expect(await screen.findByTestId('claude-plugins', undefined, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('claude-captured')).toHaveTextContent('Inventario del');
  });

  it('reloads and warns on a conflict', async () => {
    const { requests } = setup('sources', {
      setHandler: () => {
        throw new BridgeError('conflict', 'revision changed');
      },
    });
    const card = await screen.findByTestId('claude-sources', undefined, WAIT);
    fireEvent.click(within(card).getByRole('switch', { name: 'Local' }));
    expect(await screen.findByText(/cambió desde otro lado/, undefined, WAIT)).toBeInTheDocument();
    await waitFor(() => expect(requests.filter((r) => r.cmd === 'claude.tools.get')).toHaveLength(2), WAIT);
  });

  it('reloads when the bridge announces claude-tools.changed', async () => {
    const { requests, emit } = setup('sources');
    await screen.findByTestId('claude-sources', undefined, WAIT);
    emit({ kind: 'bot.event', channelId: 'general', botKind: 'claude-tools.changed', payload: { changed: ['mcp'], revision: 'cccccccccccccccc' } } as ServerEvent);
    await waitFor(() => expect(requests.filter((r) => r.cmd === 'claude.tools.get')).toHaveLength(2), WAIT);
  });

  it('degrades with a notice when the bridge lacks the feature', async () => {
    const { requests } = setup('sources', { features: [] });
    expect(await screen.findAllByText(/no soporta esta función/, undefined, WAIT)).not.toHaveLength(0);
    expect(requests).toHaveLength(0);
  });

  describe('config scope', () => {
    const scoped = ['claude-tools', 'claude-tools-scope'];

    it('shows the global scope with a customize action on every section', async () => {
      setup('plugins', { features: scoped, scope: 'global' });
      const bar = await screen.findByTestId('claude-scope', undefined, WAIT);
      expect(bar).toHaveTextContent('Configuración global');
      expect(within(bar).getByRole('button', { name: 'Personalizar este proyecto' })).toBeInTheDocument();
      expect(within(bar).queryByRole('button', { name: 'Volver a la global' })).toBeNull();
    });

    it('shows the project scope with back-to-global and save-as-global actions', async () => {
      setup('browser', { features: scoped, scope: 'project' });
      const bar = await screen.findByTestId('claude-scope', undefined, WAIT);
      expect(bar).toHaveTextContent('propia de este proyecto');
      expect(within(bar).getByRole('button', { name: 'Volver a la global' })).toBeInTheDocument();
      expect(within(bar).getByRole('button', { name: 'Guardar como global' })).toBeInTheDocument();
    });

    it('customizes the project sending the current config with project scope and revision', async () => {
      const { requests } = setup('sources', {
        features: scoped,
        scope: 'global',
        setHandler: (cmd) => ({ config: cmd.config, revision: 'bbbbbbbbbbbbbbbb', changed: true, scope: 'project', hasProjectOverride: true }),
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Personalizar este proyecto' }, WAIT));
      await waitFor(() => expect(sets(requests)).toHaveLength(1), WAIT);
      expect(sets(requests)[0]).toMatchObject({ scope: 'project', expectedRevision: REVISION, config: DEFAULT_CLAUDE_TOOLS_CONFIG });
      expect(await screen.findByRole('button', { name: 'Volver a la global' }, WAIT)).toBeInTheDocument();
    });

    it('saves the project config as global', async () => {
      const { requests } = setup('sources', { features: scoped, scope: 'project' });
      fireEvent.click(await screen.findByRole('button', { name: 'Guardar como global' }, WAIT));
      await waitFor(() => expect(sets(requests)).toHaveLength(1), WAIT);
      expect(sets(requests)[0]).toMatchObject({ scope: 'global', expectedRevision: REVISION });
    });

    it('goes back to the global sending useGlobal with the revision', async () => {
      const { requests } = setup('sources', { features: scoped, scope: 'project' });
      fireEvent.click(await screen.findByRole('button', { name: 'Volver a la global' }, WAIT));
      await waitFor(() => expect(requests.some((r) => r.cmd === 'claude.tools.useGlobal')).toBe(true), WAIT);
      expect(requests.find((r) => r.cmd === 'claude.tools.useGlobal')).toMatchObject({ expectedRevision: REVISION });
      expect(await screen.findByRole('button', { name: 'Personalizar este proyecto' }, WAIT)).toBeInTheDocument();
    });

    it('reloads on a conflict while changing scope', async () => {
      const { requests } = setup('sources', {
        features: scoped,
        scope: 'global',
        setHandler: () => {
          throw new BridgeError('conflict', 'revision changed');
        },
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Personalizar este proyecto' }, WAIT));
      expect(await screen.findByText(/cambió desde otro lado/, undefined, WAIT)).toBeInTheDocument();
      await waitFor(() => expect(requests.filter((r) => r.cmd === 'claude.tools.get')).toHaveLength(2), WAIT);
    });

    it('shows nothing about scope without the feature', async () => {
      setup('sources', { features: ['claude-tools'], scope: 'global' });
      await screen.findByTestId('claude-sources', undefined, WAIT);
      expect(screen.queryByTestId('claude-scope')).toBeNull();
    });
  });

  describe('claude-connect', () => {
    const CONNECT = ['claude-tools', 'claude-connect'];
    const mcp = (name: string, status: string): ClaudeInventory => ({ ...INVENTORY, mcpServers: [{ name, status: status as never, source: 'user' }] });

    it('shows no banner without the feature', async () => {
      const { requests } = setup('browser', { chrome: { state: 'permission-pending' } });
      await screen.findByTestId('claude-browser', undefined, WAIT);
      expect(screen.queryByTestId('chrome-banner')).not.toBeInTheDocument();
      expect(screen.queryByTestId('claude-browser-status')).not.toBeInTheDocument();
      expect(requests.some((r) => r.cmd === 'claude.browser.check')).toBe(false);
    });

    it('shows nothing when Chrome is connected or off', async () => {
      const { unmount } = setup('browser', { features: CONNECT });
      await screen.findByTestId('claude-browser-state', undefined, WAIT);
      expect(screen.queryByTestId('chrome-banner')).not.toBeInTheDocument();
      unmount();
      setup('browser', { features: CONNECT, chrome: { state: 'off' } });
      await screen.findByTestId('claude-browser-state', undefined, WAIT);
      expect(screen.queryByTestId('chrome-banner')).not.toBeInTheDocument();
    });

    it('shows the detail with a retry for unknown and for legacy bridge states, and can be dismissed', async () => {
      const { requests } = setup('browser', { features: CONNECT, chrome: { state: 'unknown', detail: 'No se encontró Google Chrome' } });
      const banner = await screen.findByTestId('chrome-banner', undefined, WAIT);
      expect(banner).toHaveTextContent('No se encontró Google Chrome');
      expect(banner).not.toHaveTextContent('chrome://inspect');
      const before = requests.filter((r) => r.cmd === 'claude.browser.check').length;
      fireEvent.click(within(banner).getByRole('button', { name: 'Reintentar' }));
      await waitFor(() => expect(requests.filter((r) => r.cmd === 'claude.browser.check').length).toBeGreaterThan(before));
      fireEvent.click(within(banner).getByRole('button', { name: /cerrar|dismiss/i }));
      expect(screen.queryByTestId('chrome-banner')).not.toBeInTheDocument();
    });

    it('maps the legacy permission-pending state to a generic retry', async () => {
      setup('browser', { features: CONNECT, chrome: { state: 'permission-pending' } });
      const banner = await screen.findByTestId('chrome-banner', undefined, WAIT);
      expect(banner).toHaveTextContent('No se pudo comprobar la conexión con Chrome');
      expect(within(banner).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    });

    it('opens the Studio Chrome from the chrome-closed banner', async () => {
      const { requests } = setup('browser', { features: CONNECT, chrome: { state: 'chrome-closed' } });
      const banner = await screen.findByTestId('chrome-banner', undefined, WAIT);
      expect(banner).toHaveTextContent('El Chrome de Studio está cerrado');
      fireEvent.click(within(banner).getByRole('button', { name: 'Abrir Chrome de Studio' }));
      await waitFor(() => expect(requests).toContainEqual({ cmd: 'claude.browser.openSettings' }));
    });

    it('follows claude-browser.changed and hides the banner once connected', async () => {
      const { emit } = setup('browser', { features: CONNECT, chrome: { state: 'chrome-closed' } });
      const banner = await screen.findByTestId('chrome-banner', undefined, WAIT);
      expect(within(banner).getByRole('button', { name: 'Abrir Chrome de Studio' })).toBeInTheDocument();
      emit({ kind: 'bot.event', channelId: 'general', botKind: 'claude-browser.changed', payload: { state: 'connected', checkedAt: '2026-11-20T10:01:00Z', detail: null } } as never);
      await waitFor(() => expect(screen.queryByTestId('chrome-banner')).not.toBeInTheDocument());
    });

    it('shows the status badge and checks on demand in the Browser section', async () => {
      const { requests } = setup('browser', { features: CONNECT, chrome: { state: 'chrome-closed' } });
      const line = await screen.findByTestId('claude-browser-status', undefined, WAIT);
      await waitFor(() => expect(within(line).getByTestId('claude-browser-state')).toHaveTextContent('Chrome cerrado'));
      const before = requests.filter((r) => r.cmd === 'claude.browser.check').length;
      fireEvent.click(within(line).getByRole('button', { name: 'Comprobar' }));
      await waitFor(() => expect(requests.filter((r) => r.cmd === 'claude.browser.check').length).toBeGreaterThan(before));
      fireEvent.click(within(line).getByRole('button', { name: 'Abrir Chrome de Studio' }));
      await waitFor(() => expect(requests).toContainEqual({ cmd: 'claude.browser.openSettings' }));
    });

    it('signs in to an MCP and refreshes its status from the returned inventory', async () => {
      const { requests } = setup('mcp', {
        features: CONNECT,
        inventory: mcp('docs', 'needs-auth'),
        handle: (cmd) => (cmd.cmd === 'claude.mcp.login' ? { name: 'docs', outcome: 'ok', output: '', inventory: mcp('docs', 'connected') } : {}),
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Iniciar sesión' }, WAIT));
      await waitFor(() => expect(screen.getByTestId('claude-mcp-status-docs')).toHaveTextContent('conectado'));
      expect(requests).toContainEqual({ cmd: 'claude.mcp.login', name: 'docs' });
      expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
    });

    it('explains each non-ok login outcome and keeps the output in a collapsible detail', async () => {
      const outcomes = [
        ['not-oauth', 'Este servidor no usa OAuth (stdio)'],
        ['header-auth', 'header Authorization'],
        ['timeout', 'Se agotó el tiempo'],
        ['failed', 'No se pudo iniciar sesión'],
        ['unknown-server', 'no conoce este servidor'],
        ['terminal', 'Se abrió una terminal'],
      ] as const;
      for (const [outcome, text] of outcomes) {
        window.localStorage.clear();
        const { unmount } = setup('mcp', {
          features: CONNECT,
          inventory: mcp('docs', 'needs-auth'),
          handle: (cmd) => (cmd.cmd === 'claude.mcp.login' ? { name: 'docs', outcome, output: 'salida cruda', inventory: null } : {}),
        });
        fireEvent.click(await screen.findByRole('button', { name: 'Iniciar sesión' }, WAIT));
        await waitFor(() => expect(screen.getByTestId('claude-mcp-op-docs')).toHaveTextContent(text), WAIT);
        const note = screen.getByTestId('claude-mcp-op-docs');
        const informative = outcome === 'not-oauth' || outcome === 'header-auth' || outcome === 'terminal';
        expect(Boolean(note.querySelector('details'))).toBe(!informative);
        unmount();
      }
    });

    it('shows progress while the login runs', async () => {
      let finish: (value: unknown) => void = () => undefined;
      setup('mcp', {
        features: CONNECT,
        inventory: mcp('docs', 'needs-auth'),
        handle: (cmd) => (cmd.cmd === 'claude.mcp.login' ? new Promise((resolve) => (finish = resolve)) : {}),
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Iniciar sesión' }, WAIT));
      expect(await screen.findByText('Se abrió el navegador para autorizar…')).toBeInTheDocument();
      await act(async () => finish({ name: 'docs', outcome: 'ok', output: '', inventory: mcp('docs', 'connected') }));
    });

    it('reconnects a failed MCP and shows its new status', async () => {
      const { requests } = setup('mcp', {
        features: CONNECT,
        inventory: mcp('docs', 'failed'),
        handle: (cmd) => (cmd.cmd === 'claude.mcp.reconnect' ? { name: 'docs', status: 'connected', inventory: mcp('docs', 'connected') } : {}),
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Reconectar' }, WAIT));
      await waitFor(() => expect(screen.getByTestId('claude-mcp-status-docs')).toHaveTextContent('conectado'));
      expect(requests).toContainEqual({ cmd: 'claude.mcp.reconnect', name: 'docs' });
    });

    it('notes that claude.ai connectors do not load with an API key', async () => {
      setup('mcp', {
        features: CONNECT,
        inventory: mcp('plugin:google:gmail', 'needs-auth'),
        handle: (cmd) => (cmd.cmd === 'claude.mcp.login' ? { name: 'plugin:google:gmail', outcome: 'failed', output: 'x', inventory: null } : {}),
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Iniciar sesión' }, WAIT));
      expect(await screen.findByText('Los conectores de claude.ai no cargan con API key.')).toBeInTheDocument();
    });

    it('keeps today\'s hint and no buttons without the feature', async () => {
      setup('mcp', { inventory: mcp('docs', 'needs-auth') });
      await screen.findByTestId('claude-mcp', undefined, WAIT);
      expect(screen.getByText('Autenticalo una vez desde Claude Code (/mcp).')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
    });
  });
});
