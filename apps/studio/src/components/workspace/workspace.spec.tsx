import { fireEvent, render, screen } from '@testing-library/react';
import type { ThreadInfo } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { Workspace } from './Workspace';

const options = { agent: 'sdd-planner', model: 'kit' as const, effort: null, permissionMode: 'default' as const };
const info = (id: string): ThreadInfo => ({
  id, channelId: 'general', title: `Chat ${id}`, agent: 'sdd-planner', options, status: 'idle', createdAt: '1', lastActivity: '1',
  link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount: 0,
});

function mount() {
  const store = createStudioStore();
  store.getState().setThreads([info('t1'), info('t2')]);
  const value = {
    client: { request: vi.fn().mockResolvedValue({}) },
    store,
    connection: { status: 'idle' },
    authMode: null,
    apiKeySource: null,
    setApiKey: vi.fn(),
  } as unknown as BridgeContextValue;
  return render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <Workspace />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
}

describe('Workspace layout', () => {
  it('gives the grid an explicit shrinkable row so panels scroll on their own', () => {
    const { container } = mount();
    const grid = container.firstElementChild!;
    expect(grid).toHaveClass('grid-rows-[minmax(0,1fr)]');
  });

  it('has a single scroller in the sidebar tree, the channel and the right panel', () => {
    mount();
    expect(screen.getByTestId('sidebar-tree')).toHaveClass('overflow-y-auto');
    expect(screen.getByRole('navigation')).not.toHaveClass('overflow-y-auto');
    const channel = screen.getByRole('heading', { name: '# general' }).closest('section')!;
    expect(channel.querySelectorAll('.overflow-y-auto')).toHaveLength(1);
    const panel = screen.getByRole('complementary');
    expect(panel).toHaveClass('overflow-y-auto');
    expect(panel.querySelectorAll('.overflow-y-auto')).toHaveLength(0);
  });

  it('switches threads from the sidebar with a fresh thread view per thread', () => {
    mount();
    fireEvent.click(screen.getAllByRole('button', { name: 'Chat t1' })[0]!);
    const first = screen.getByTestId('thread-scroller');
    fireEvent.click(screen.getAllByRole('button', { name: 'Chat t2' })[0]!);
    expect(screen.getByTestId('thread-scroller')).not.toBe(first);
  });
});
