import { render, screen } from '@testing-library/react';
import type { ThreadInfo } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { ActivityIndicator, type ActivityPlacement } from './ActivityIndicator';
import { ThreadView } from './ThreadView';

const options = { agent: 'sdd-planner', model: 'kit' as const, effort: null, permissionMode: 'default' as const };
const info = (status: ThreadInfo['status']): ThreadInfo => ({
  id: 't1', channelId: 'general', title: 'hilo', agent: 'sdd-planner', options, status, createdAt: '1', lastActivity: '1',
  link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount: 0,
});

const classesOf = (root: HTMLElement) =>
  [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))].flatMap((n) => n.getAttribute('class')?.split(/\s+/) ?? []);
const shapeOf = (root: HTMLElement) => root.querySelector('[data-indicator]')?.getAttribute('data-indicator');

describe('indicators under prefers-reduced-motion (CA-011.4)', () => {
  const placements: ActivityPlacement[] = ['row', 'avatar', 'thread'];

  it.each(placements)('has no unconditional animation in %s for any status', (placement) => {
    for (const status of ['running', 'waiting-approval', 'queued'] as const) {
      const { unmount } = render(<ActivityIndicator status={status} placement={placement} />);
      const animated = classesOf(screen.getByTestId('activity-indicator')).filter((c) => c.includes('animate-'));
      expect(animated.every((c) => c.startsWith('motion-safe:'))).toBe(true);
      unmount();
    }
  });

  it.each(placements)('keeps running, waiting-approval and queued distinguishable by shape in %s even when static', (placement) => {
    const shapes = (['running', 'waiting-approval', 'queued'] as const).map((status) => {
      const { unmount } = render(<ActivityIndicator status={status} placement={placement} />);
      const shape = shapeOf(screen.getByTestId('activity-indicator'));
      unmount();
      return shape;
    });
    expect(new Set(shapes).size).toBe(3);
    expect(shapes.every(Boolean)).toBe(true);
  });

  it.each([
    ['running', 'trabajando'],
    ['waiting-approval', 'esperando aprobación'],
    ['queued', 'en cola'],
  ] as const)('labels the thread with text for %s so the state is not only visual', (status, label) => {
    const store = createStudioStore();
    store.getState().setThreads([info(status)]);
    store.getState().loadHistory('t1', []);
    const value = { client: { request: vi.fn() }, store, connection: { status: 'idle' } } as unknown as BridgeContextValue;
    render(
      <I18nProvider initial="es">
        <BridgeContext.Provider value={value}>
          <ThreadView threadId="t1" onBack={vi.fn()} composer={null} />
        </BridgeContext.Provider>
      </I18nProvider>,
    );
    expect(screen.getByTestId('thread-activity')).toHaveTextContent(label);
  });
});
