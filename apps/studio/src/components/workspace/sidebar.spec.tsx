import { fireEvent, render, screen, within } from '@testing-library/react';
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

function renderSidebar({ threads = [], view = { channelId: 'general', threadId: null }, snap = snapshot, props = {} }: Setup = {}) {
  const onSelectChannel = vi.fn();
  const onOpenThread = vi.fn();
  const ui = (v: NavView) => (
    <I18nProvider initial="es">
      <SidebarView
        project="studio fixture" kitVersion="0.16.0" authMode="local-claude-login" connection="open"
        tree={buildNavTree(snap, threads, v)}
        presence={[{ agent: 'sdd-planner', state: 'working', threadId: 't', specId: null, tool: 'Read' }]}
        onSelectChannel={onSelectChannel} onOpenThread={onOpenThread}
        {...props}
      />
    </I18nProvider>
  );
  const utils = render(ui(view));
  return { ...utils, onSelectChannel, onOpenThread, rerenderView: (v: NavView) => utils.rerender(ui(v)) };
}

beforeEach(() => window.localStorage.clear());

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

  it('shows an empty text for cycles and fixes without conversations', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir o colapsar s2' }));
    expect(screen.getAllByText('Sin conversaciones').length).toBeGreaterThanOrEqual(2);
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
    const caret = within(tree).getByRole('button', { name: 'Expandir o colapsar # general' });
    fireEvent.click(within(tree).getByRole('button', { name: '# general' }));
    expect(onSelectChannel).toHaveBeenCalledWith('general');
    rerenderView({ channelId: 'general', threadId: null });
    expect(caret).toHaveAttribute('aria-expanded', 'true');
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
  const rows = () => within(screen.getByRole('button', { name: 'Hilos activos' }).closest('section')!).getAllByRole('button').slice(1);

  it('lists only running, waiting-approval and queued threads with attention first, showing title, agent and status', () => {
    renderSidebar({ threads: active });
    expect(rows().map((b) => b.textContent)).toEqual([
      'Waiting chatChronos · esperando aprobación',
      'Running chatDaedalus · trabajando2 pendientes',
      'Queued chatChronos · en cola',
    ]);
  });

  it('opens a thread that belongs to another channel', () => {
    const { onOpenThread } = renderSidebar({ threads: active });
    fireEvent.click(rows()[0]!);
    expect(onOpenThread).toHaveBeenCalledWith(expect.objectContaining({ id: 'w', channelId: 'spec:s1' }));
  });

  it('shows the empty state without active threads', () => {
    renderSidebar({ threads: [active[3]!] });
    expect(screen.getByText('Sin hilos activos')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Hilos activos' }));
    expect(within(screen.getByRole('button', { name: /^Hilos activos/ })).getByText(/requiere tu aprobación/)).toBeInTheDocument();
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
    const statusOf = (name: RegExp) => within(screen.getAllByRole('button', { name })[0]!).getByTestId('activity-indicator').getAttribute('data-status');
    expect(statusOf(/^Run/)).toBe('running');
    expect(statusOf(/^Wait/)).toBe('waiting-approval');
    expect(statusOf(/^Idle/)).toBe('none');
    expect(screen.getAllByRole('button', { name: 'Run, trabajando' }).length).toBeGreaterThan(0);
  });

  it('does not pulse the presence dot without the motion-safe variant', () => {
    renderSidebar();
    const dot = screen.getByRole('button', { name: 'Chronos, trabajando' }).querySelector('span[aria-hidden]')!;
    expect(dot.className.split(/\s+/).filter((c) => /^animate-/.test(c))).toEqual([]);
    expect(dot).toHaveClass('motion-safe:animate-pulse');
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
    for (const name of [/^Hilos activos/, /^Canales/, /^Specs/, /^Fixes/, /^Agentes/]) {
      expect(within(tree).getByRole('button', { name })).toBeInTheDocument();
    }
  });
});
