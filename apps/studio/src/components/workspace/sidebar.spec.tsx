import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { buildNavTree, type NavView } from '@/lib/store/nav-tree';
import { COLLAPSED_KEY_PREFIX } from '@/lib/use-collapsed-state';
import { SidebarView, type SidebarViewProps } from './Sidebar';

const options = { agent: 'a', model: 'kit' as const, effort: null, permissionMode: 'default' as const };
const thread = (over: Partial<ThreadInfo> & { id: string }): ThreadInfo => ({
  channelId: 'general', title: over.id, agent: 'sdd-planner', options, status: 'idle', createdAt: '1', lastActivity: '2026-01-01',
  link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount: 0, ...over,
});
const cycleLink = (specId: string, cycle: string): ThreadInfo['link'] => ({ target: { kind: 'cycle', specId, cycle }, source: 'auto' });

const snapshot: WorkspaceSnapshot = {
  project: 'studio fixture', profile: 'team', kitVersion: '0.16.0', gateMode: 'block', pricing: null, stale: [], skills: [],
  agents: [{ id: 'sdd-planner', description: '', model: null, source: 'sdd', path: 'p' }],
  specs: [
    { id: 's1', title: 'Uno', status: 'in-progress', folder: 'f', module: null, app: null, dependsOn: [] },
    { id: 's2', title: 'Dos', status: 'completed', folder: 'f', module: null, app: null, dependsOn: [] },
  ],
  cycles: [
    { specId: 's1', cycle: 'cycle-01', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 },
    { specId: 's1', cycle: 'cycle-02', status: 'completed', flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 },
  ],
  fixes: [
    { id: 'FIX-1', title: 'one', status: 'in-progress', severity: null, specId: null, createdAt: '1', closedAt: null },
    { id: 'FIX-2', title: 'two', status: 'in-progress', severity: null, specId: null, createdAt: '1', closedAt: null },
  ],
};

interface Setup {
  threads?: ThreadInfo[];
  view?: NavView;
  snap?: WorkspaceSnapshot | null;
  props?: Partial<SidebarViewProps>;
}

const defaultPresence: SidebarViewProps['presence'] = [{ agent: 'sdd-planner', state: 'working', threadId: 't', specId: null, tool: 'Read' }];

function renderSidebar({ threads = [], view = { channelId: 'general', threadId: null }, snap = snapshot, props = {} }: Setup = {}) {
  const onSelectChannel = vi.fn();
  const onOpenThread = vi.fn();
  const ui = (v: NavView) => (
    <I18nProvider initial="es">
      <SidebarView
        project="studio fixture" kitVersion="0.16.0" authMode="local-claude-login" connection="open"
        tree={buildNavTree(snap, threads, v, props.presence ?? defaultPresence)}
        presence={defaultPresence}
        onSelectChannel={onSelectChannel} onOpenThread={onOpenThread}
        {...props}
      />
    </I18nProvider>
  );
  const utils = render(ui(view));
  return { ...utils, onSelectChannel, onOpenThread, rerenderView: (v: NavView) => utils.rerender(ui(v)) };
}

beforeEach(() => window.localStorage.clear());

describe('Sidebar new conversation', () => {
  it('shows the button in the header only when a handler is given', () => {
    const { unmount } = renderSidebar();
    expect(screen.queryByTestId('new-conversation-button')).toBeNull();
    unmount();
    const onNewConversation = vi.fn();
    renderSidebar({ props: { onNewConversation } });
    fireEvent.click(screen.getByRole('button', { name: /Nueva conversación/ }));
    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });
});

describe('Sidebar tree', () => {
  it('lists CHANNELS without spec channels, SPECS, FIXES and AGENTS', () => {
    const { onSelectChannel } = renderSidebar();
    expect(screen.getByRole('button', { name: 'Canales' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Specs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fixes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agentes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '# general' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /# s1/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '# general' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chronos, trabajando' }));
    expect(onSelectChannel.mock.calls).toEqual([['general'], ['dm:sdd-planner']]);
    expect(screen.getByText('conectado', { selector: '.sr-only' })).toBeInTheDocument();
  });

  it.each([
    ['open', 'conectado', 'bg-accent-400'],
    ['reconnecting', 'reconectando', 'bg-amberish'],
    ['connecting', 'reconectando', 'bg-amberish'],
    ['failed', 'sin conexión', 'bg-roseish'],
    ['idle', 'sin conexión', 'bg-roseish'],
  ] as const)('shows the %s connection state in the dot', (connection, label, cls) => {
    renderSidebar({ snap: null, props: { connection } });
    expect(screen.getByText(label, { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByTestId('conn-dot')).toHaveClass(cls);
  });

  it('shows specs with their cycles and conversations and opens a thread', () => {
    const threads = [thread({ id: 'plan-chat', title: 'Plan chat', channelId: 'spec:s1', link: cycleLink('s1', 'cycle-01') })];
    const { onOpenThread, onSelectChannel } = renderSidebar({ threads });
    expect(screen.getByText('cycle-01')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Plan chat' }));
    expect(onOpenThread).toHaveBeenCalledWith(expect.objectContaining({ id: 'plan-chat', channelId: 'spec:s1' }));
    fireEvent.click(screen.getByRole('button', { name: 's1, en curso' }));
    expect(onSelectChannel).toHaveBeenCalledWith('spec:s1');
  });

  it('marks the opened thread as current', () => {
    const threads = [thread({ id: 'plan-chat', title: 'Plan chat', channelId: 'spec:s1', link: cycleLink('s1', 'cycle-01') })];
    renderSidebar({ threads, view: { channelId: 'spec:s1', threadId: 'plan-chat' } });
    expect(screen.getByRole('button', { name: 'Plan chat' })).toHaveAttribute('aria-current', 'true');
  });

  it('summarises the conversations of a spec in a single line instead of repeating an empty text per node', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir o colapsar s2' }));
    expect(screen.getAllByTestId('conversations-line')).toHaveLength(2);
    expect(screen.getAllByText('Sin conversaciones')).toHaveLength(2);
    const withThreads = [thread({ id: 'p', title: 'Plan', channelId: 'spec:s1', link: cycleLink('s1', 'cycle-01') }), thread({ id: 'q', title: 'Other', channelId: 'spec:s1', link: cycleLink('s1', 'cycle-01') })];
    cleanup();
    renderSidebar({ threads: withThreads });
    expect(screen.getByText('2 conversaciones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plan' })).toBeInTheDocument();
  });

  it('shows the empty text when there are no specs and no fixes', () => {
    renderSidebar({ snap: { ...snapshot, specs: [], cycles: [], fixes: [] } });
    expect(screen.getByText('No hay specs todavía')).toBeInTheDocument();
    expect(screen.getByText('No hay fixes todavía')).toBeInTheDocument();
  });

  it('shows "Sin ciclos" for a spec without cycles', () => {
    renderSidebar({ snap: { ...snapshot, cycles: [] } });
    expect(screen.getAllByText('Sin ciclos')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Expandir o colapsar s2' }));
    expect(screen.getAllByText('Sin ciclos')).toHaveLength(2);
  });

  it('lists a thread without a cycle under "Sin ciclo"', () => {
    renderSidebar({ threads: [thread({ id: 'loose', title: 'Loose', channelId: 'spec:s1' })] });
    expect(screen.getByText('Sin ciclo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loose' })).toBeInTheDocument();
  });

  it('shows 25 threads per node and reveals the rest on demand', () => {
    const threads = Array.from({ length: 30 }, (_, i) => thread({ id: `t${i}`, title: `Thread ${i}`, lastActivity: `2026-01-${String(i + 1).padStart(2, '0')}` }));
    renderSidebar({ threads });
    expect(screen.queryByRole('button', { name: 'Thread 0' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar 5 más' }));
    expect(screen.getByRole('button', { name: 'Thread 0' })).toBeInTheDocument();
  });
});

describe('Sidebar collapsing', () => {
  it('toggles a section from its header with aria-expanded and keeps the others', () => {
    renderSidebar();
    const header = screen.getByRole('button', { name: 'Canales' });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: '# general' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Chronos, trabajando' })).toBeInTheDocument();
    fireEvent.click(header);
    expect(screen.getByRole('button', { name: '# general' })).toBeInTheDocument();
  });

  it('collapses and expands with the left and right arrow keys', () => {
    renderSidebar();
    const header = screen.getByRole('button', { name: 'Specs' });
    fireEvent.keyDown(header, { key: 'ArrowLeft' });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(header, { key: 'ArrowRight' });
    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses a spec through its caret while its name still opens the channel', () => {
    renderSidebar();
    const caret = screen.getByRole('button', { name: 'Expandir o colapsar s1' });
    expect(caret).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(caret);
    expect(caret).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('cycle-01')).toBeNull();
  });

  it('opens a channel from its name without collapsing it', () => {
    const { onSelectChannel, rerenderView } = renderSidebar({ threads: [thread({ id: 'g1' })], view: { channelId: 'fixes', threadId: null } });
    const tree = screen.getByTestId('sidebar-tree');
    expect(within(tree).queryByRole('button', { name: 'g1' })).toBeNull();
    fireEvent.click(within(tree).getByRole('button', { name: /^# general/ }));
    expect(onSelectChannel).toHaveBeenCalledWith('general');
    rerenderView({ channelId: 'general', threadId: null });
    expect(within(tree).getByRole('button', { name: /^# general/ })).toHaveAttribute('aria-current', 'page');
    expect(within(tree).getByRole('button', { name: 'g1' })).toBeInTheDocument();
  });

  it('defaults completed specs and closed cycles to collapsed', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Expandir o colapsar s2' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'cycle-02' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps a visible signal when a collapsed node contains the opened thread', () => {
    const threads = [thread({ id: 'plan-chat', title: 'Plan chat', channelId: 'spec:s1', link: cycleLink('s1', 'cycle-01') })];
    renderSidebar({ threads, view: { channelId: 'spec:s1', threadId: 'plan-chat' } });
    fireEvent.click(screen.getByRole('button', { name: 'Specs' }));
    expect(within(screen.getByRole('button', { name: /^Specs/ })).getByText(/contiene el hilo abierto/)).toBeInTheDocument();
  });

  it('flags a collapsed section that contains a thread waiting for approval', () => {
    const threads = [thread({ id: 'w', status: 'waiting-approval', channelId: 'spec:s1', link: cycleLink('s1', 'cycle-01') })];
    renderSidebar({ threads });
    fireEvent.click(screen.getByRole('button', { name: 'Specs' }));
    expect(within(screen.getByRole('button', { name: /^Specs/ })).getByText(/requiere tu aprobación/)).toBeInTheDocument();
  });

  it('keeps the collapsed state while navigating and after a remount', () => {
    const { rerenderView, unmount } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /^Canales/ }));
    rerenderView({ channelId: 'dm:sdd-planner', threadId: null });
    expect(screen.getByRole('button', { name: /^Canales/ })).toHaveAttribute('aria-expanded', 'false');
    unmount();
    renderSidebar();
    expect(screen.getByRole('button', { name: /^Canales/ })).toHaveAttribute('aria-expanded', 'false');
    expect(JSON.parse(window.localStorage.getItem(`${COLLAPSED_KEY_PREFIX}studio fixture`)!)).toEqual({ 'section:channels': true });
  });

  it('does not fail with corrupted persisted state', () => {
    window.localStorage.setItem(`${COLLAPSED_KEY_PREFIX}studio fixture`, '{{{');
    renderSidebar();
    expect(screen.getByRole('button', { name: /^Canales/ })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Sidebar active threads', () => {
  const active = [
    thread({ id: 'q', title: 'Queued chat', status: 'queued', lastActivity: '2026-03-01' }),
    thread({ id: 'r', title: 'Running chat', status: 'running', agent: 'sdd-architect', lastActivity: '2026-02-01', pendingCount: 2 }),
    thread({ id: 'w', title: 'Waiting chat', status: 'waiting-approval', channelId: 'spec:s1', link: cycleLink('s1', 'cycle-01') }),
    thread({ id: 'done', title: 'Done chat', status: 'idle' }),
  ];
  const activeSectionEl = () => screen.getByRole('button', { name: /^En curso/ }).closest('section')!;
  const rows = () => within(screen.getByRole('button', { name: 'En curso' }).closest('section')!).getAllByRole('button').slice(1);

  it('lists only running, waiting-approval and queued threads with attention first, showing title, agent and status', () => {
    renderSidebar({ threads: active });
    const [waiting, running, queued] = rows();
    expect(rows()).toHaveLength(3);
    expect(waiting).toHaveTextContent(/Waiting chat.*Chronos.*aprobar/);
    expect(running).toHaveTextContent(/Running chat.*Daedalus.*2 pendientes.*trabajando/);
    expect(queued).toHaveTextContent(/Queued chat.*Chronos.*en cola/);
  });

  it('opens a thread that belongs to another channel', () => {
    const { onOpenThread } = renderSidebar({ threads: active });
    fireEvent.click(rows()[0]!);
    expect(onOpenThread).toHaveBeenCalledWith(expect.objectContaining({ id: 'w', channelId: 'spec:s1' }));
  });

  it('hides the whole section without active threads', () => {
    renderSidebar({ threads: [active[3]!] });
    expect(screen.queryByRole('button', { name: /^En curso/ })).toBeNull();
    expect(screen.queryByText('Sin hilos activos')).toBeNull();
  });

  it('shows a status chip per row and a warning accent only on the waiting one', () => {
    renderSidebar({ threads: active });
    const [waiting, running, queued] = rows();
    expect(within(waiting!).getByTestId('thread-status-chip')).toHaveTextContent('aprobar');
    expect(within(running!).getByTestId('thread-status-chip')).toHaveTextContent('trabajando');
    expect(within(queued!).getByTestId('thread-status-chip')).toHaveTextContent('en cola');
    expect(waiting).toHaveClass('border-l-2', 'border-amberish', 'rounded-l-none');
    expect(running).not.toHaveClass('border-l-2');
  });

  it('shows the active thread count in the header', () => {
    renderSidebar({ threads: active });
    expect(within(activeSectionEl()).getByTestId('section-summary')).toHaveTextContent('3');
  });

  it('warns that the list may be stale when the connection is down', () => {
    renderSidebar({ threads: active, props: { connection: 'reconnecting' } });
    expect(screen.getByText('Estado posiblemente desactualizado')).toBeInTheDocument();
  });

  it('does not warn while connected', () => {
    renderSidebar({ threads: active });
    expect(screen.queryByText('Estado posiblemente desactualizado')).toBeNull();
  });

  it('keeps the attention signal on the collapsed section and still lists the thread in the tree section', () => {
    renderSidebar({ threads: active });
    fireEvent.click(screen.getByRole('button', { name: /^En curso/ }));
    expect(within(screen.getByRole('button', { name: /^En curso/ })).getByText(/requiere tu aprobación/)).toBeInTheDocument();
  });
});

describe('Sidebar indicators', () => {
  it('shows an indicator in the row of each busy thread and none for idle ones', () => {
    const threads = [
      thread({ id: 'r', title: 'Run', status: 'running' }),
      thread({ id: 'w', title: 'Wait', status: 'waiting-approval' }),
      thread({ id: 'i', title: 'Idle', status: 'idle' }),
    ];
    renderSidebar({ threads });
    const statusOf = (name: RegExp) => within(screen.getAllByRole('button', { name }).at(-1)!).getByTestId('activity-indicator').getAttribute('data-status');
    expect(statusOf(/^Run/)).toBe('running');
    expect(statusOf(/^Wait/)).toBe('waiting-approval');
    expect(statusOf(/^Idle/)).toBe('none');
    expect(screen.getAllByRole('button', { name: 'Run, trabajando' }).length).toBeGreaterThan(0);
  });

  it('does not pulse the presence dot without the motion-safe variant', () => {
    renderSidebar();
    const ring = within(screen.getByRole('button', { name: 'Chronos, trabajando' })).getByTestId('presence-ring');
    expect(ring.className.split(/\s+/).filter((c) => /^animate-/.test(c))).toEqual([]);
    expect(ring).toHaveClass('motion-safe:animate-pulse', 'ring-emerald-400');
  });
});

describe('Sidebar layout', () => {
  const manyThreads = Array.from({ length: 20 }, (_, i) => thread({ id: `t${i}`, title: `Thread ${i}`, status: 'running' }));

  it('scrolls only the tree while the header and footer stay fixed', () => {
    renderSidebar({ threads: manyThreads });
    const nav = screen.getByRole('navigation');
    const tree = screen.getByTestId('sidebar-tree');
    expect(nav).not.toHaveClass('overflow-y-auto');
    expect(nav).toHaveClass('flex', 'h-full', 'min-h-0', 'flex-col');
    expect(tree).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    const header = nav.querySelector('header')!;
    const footer = nav.querySelector('footer')!;
    expect(header).toHaveClass('shrink-0');
    expect(footer).toHaveClass('shrink-0');
    expect(tree.contains(header)).toBe(false);
    expect(tree.contains(footer)).toBe(false);
  });

  it('keeps every section reachable inside the scrolling tree', () => {
    renderSidebar({ threads: manyThreads });
    const tree = screen.getByTestId('sidebar-tree');
    for (const name of [/^En curso/, /^Canales/, /^Specs/, /^Fixes/, /^Agentes/]) {
      expect(within(tree).getByRole('button', { name })).toBeInTheDocument();
    }
  });
});

describe('Sidebar active threads', () => {
  const renderActive = (threads: ThreadInfo[], presence: SidebarViewProps['presence']) =>
    render(
      <I18nProvider initial="es">
        <SidebarView
          project="studio fixture" kitVersion="0.16.0" authMode="local-claude-login" connection="open"
          tree={buildNavTree(snapshot, threads, { channelId: 'general', threadId: null }, presence)}
          presence={presence} onSelectChannel={vi.fn()} onOpenThread={vi.fn()}
        />
      </I18nProvider>,
    );

  it('names the agent working on an active thread and the tool it runs', () => {
    renderActive(
      [thread({ id: 'a1', status: 'running', agent: 'sdd-orchestrator' })],
      [{ agent: 'sdd-implementor-back', state: 'working', threadId: 'a1', specId: null, tool: 'Edit' }],
    );
    expect(screen.getByTestId('active-thread-agents')).toHaveTextContent('Vulcan · Edit');
  });

  it('falls back to the thread owner when presence has nobody on it', () => {
    renderActive([thread({ id: 'a1', status: 'running', agent: 'sdd-orchestrator' })], []);
    expect(screen.getByTestId('active-thread-agents')).toHaveTextContent('Clara');
  });
});

describe('Sidebar search', () => {
  const searchBox = () => screen.getByRole('textbox', { name: 'Buscar' });
  const type = (value: string) => fireEvent.change(searchBox(), { target: { value } });

  it('filters specs, keeps matching ancestors and hides sections without matches', () => {
    const threads = [thread({ id: 'plan-chat', title: 'Plan chat', channelId: 'spec:s1', link: cycleLink('s1', 'cycle-01') })];
    renderSidebar({ threads });
    type('plan');
    const tree = screen.getByTestId('sidebar-tree');
    expect(within(tree).getByRole('button', { name: /^Specs/ })).toBeInTheDocument();
    expect(within(tree).getByRole('button', { name: 's1, en curso' })).toBeInTheDocument();
    expect(within(tree).getByRole('button', { name: 'cycle-01' })).toBeInTheDocument();
    expect(within(tree).getByRole('button', { name: 'Plan chat' })).toBeInTheDocument();
    expect(within(tree).queryByRole('button', { name: 'Expandir o colapsar s2' })).toBeNull();
    for (const hidden of [/^Canales/, /^Fixes/]) expect(within(tree).queryByRole('button', { name: hidden })).toBeNull();
  });

  it('matches case-insensitively on fixes, agents and channels', () => {
    renderSidebar();
    type('FIX-2');
    expect(screen.getByRole('button', { name: 'FIX-2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'FIX-1' })).toBeNull();
    type('chronos');
    expect(screen.getByRole('button', { name: 'Chronos, trabajando' })).toBeInTheDocument();
    type('GENERAL');
    expect(screen.getByRole('button', { name: /^# general/ })).toBeInTheDocument();
  });

  it('expands collapsed nodes while searching', () => {
    renderSidebar({ threads: [thread({ id: 'old', title: 'Old chat', channelId: 'spec:s2', link: cycleLink('s2', 'cycle-01') })] });
    expect(screen.queryByRole('button', { name: 'Old chat' })).toBeNull();
    type('old chat');
    expect(screen.getByRole('button', { name: 'Old chat' })).toBeInTheDocument();
  });

  it('shows an empty-result line, and Escape clears the query', () => {
    renderSidebar();
    type('zzz');
    expect(screen.getByTestId('sidebar-no-results')).toHaveTextContent('Sin resultados para «zzz»');
    fireEvent.keyDown(searchBox(), { key: 'Escape' });
    expect(searchBox()).toHaveValue('');
    expect(screen.queryByTestId('sidebar-no-results')).toBeNull();
    expect(screen.getByRole('button', { name: /^Canales/ })).toBeInTheDocument();
  });

  it('focuses the search with Cmd+K and Ctrl+K', () => {
    renderSidebar();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(searchBox()).toHaveFocus();
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(searchBox()).toHaveFocus();
  });
});

describe('Sidebar section headers and rows', () => {
  const rich: WorkspaceSnapshot = {
    ...snapshot,
    cycles: [
      { specId: 's1', cycle: 'cycle-01', status: 'completed', flow: 'full', apps: [], tasks: [], tasksTotal: 4, tasksDone: 4 },
      { specId: 's1', cycle: 'cycle-02', status: 'in-progress', flow: 'lite', apps: [], tasks: [], tasksTotal: 7, tasksDone: 3 },
    ],
    fixes: [
      { id: 'FIX-1', title: 'one', status: 'in-progress', severity: 'high', specId: null, createdAt: '1', closedAt: null },
      { id: 'FIX-2', title: 'two', status: 'pending', severity: 'media', specId: null, createdAt: '1', closedAt: null },
      { id: 'FIX-3', title: 'three', status: 'pending', severity: 'baja', specId: null, createdAt: '1', closedAt: null },
      { id: 'FIX-4', title: 'four', status: 'pending', severity: null, specId: null, createdAt: '1', closedAt: null },
      { id: 'FIX-5', title: 'five', status: 'closed', severity: 'high', specId: null, createdAt: '1', closedAt: '2' },
    ],
  };
  const summaryOf = (name: RegExp) => within(screen.getByRole('button', { name }).closest('section')!).getByTestId('section-summary');

  it('summarises specs, fixes and agents in the headers', () => {
    renderSidebar({ snap: rich });
    expect(summaryOf(/^Specs/)).toHaveTextContent('1 activa · 2');
    expect(summaryOf(/^Fixes/)).toHaveTextContent('4 abiertos');
    expect(summaryOf(/^Agentes/)).toHaveTextContent('1 trabajando');
  });

  it('shows the latest cycle chip and task progress on a spec and in its cycles', () => {
    renderSidebar({ snap: rich });
    const specRow = screen.getByRole('button', { name: 's1, en curso' }).parentElement!;
    expect(within(specRow).getByTestId('cycle-chip')).toHaveTextContent('c02 · lite');
    expect(within(specRow).getByTestId('mini-progress')).toHaveTextContent('3/7');
    expect(within(specRow).getByTestId('spec-status-dot')).toHaveAttribute('data-status', 'in-progress');
    const cycleRow = screen.getByRole('button', { name: 'cycle-02' }).parentElement!;
    expect(within(cycleRow).getByTestId('cycle-chip')).toHaveTextContent('lite');
  });

  it('colours fix severity and shows none when unknown', () => {
    renderSidebar({ snap: rich });
    const chipOf = (id: string) => screen.getByRole('button', { name: id }).parentElement!.querySelector('[data-testid="severity-chip"]');
    expect(chipOf('FIX-1')).toHaveTextContent('alta');
    expect(chipOf('FIX-2')).toHaveTextContent('media');
    expect(chipOf('FIX-3')).toHaveTextContent('baja');
    expect(chipOf('FIX-4')).toBeNull();
  });

  it('shows the task or the role-and-free text under an agent', () => {
    const threads = [thread({ id: 'r', title: 'Run', status: 'running' })];
    renderSidebar({
      threads,
      props: { presence: [{ agent: 'sdd-planner', state: 'working', threadId: 'r', specId: null, tool: 'Read' }] },
    });
    expect(within(screen.getByRole('button', { name: 'Chronos, trabajando' })).getByTestId('agent-subline')).toHaveTextContent('Read');
    cleanup();
    renderSidebar({ props: { presence: [] } });
    expect(within(screen.getByRole('button', { name: 'Chronos, inactivo' })).getByTestId('agent-subline')).toHaveTextContent('Planner · libre');
  });

  it('keeps the channel count and shows channels as chips', () => {
    renderSidebar({ threads: [thread({ id: 'g1' }), thread({ id: 'g2' })] });
    const chips = screen.getByTestId('channel-chips');
    expect(within(chips).getByRole('button', { name: /^# general, 2 conversaciones/ })).toBeInTheDocument();
  });
});

describe('Sidebar icons mode', () => {
  it('shows a footer toggle that collapses to icons and a rail that expands again', () => {
    const onToggleIcons = vi.fn();
    const { unmount } = renderSidebar({ props: { onToggleIcons } });
    fireEvent.click(screen.getByRole('button', { name: 'Colapsar a íconos' }));
    expect(onToggleIcons).toHaveBeenCalledTimes(1);
    unmount();
    const { onSelectChannel } = renderSidebar({ props: { onToggleIcons, iconsOnly: true, onNewConversation: vi.fn() } });
    expect(screen.getByTestId('sidebar-rail')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Buscar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '# general' }));
    expect(onSelectChannel).toHaveBeenCalledWith('general');
    fireEvent.click(screen.getByRole('button', { name: 'Chronos' }));
    expect(onSelectChannel).toHaveBeenCalledWith('dm:sdd-planner');
    fireEvent.click(screen.getByRole('button', { name: 'Expandir sidebar' }));
    expect(onToggleIcons).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Nueva conversación' })).toBeInTheDocument();
  });
});
