import { render, screen } from '@testing-library/react';
import type { SessionStatus } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { ActivityIndicator } from './ActivityIndicator';
import { AgentAvatar } from './AgentAvatar';

const tokens = (el: HTMLElement) => [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))].flatMap((n) => n.getAttribute('class')?.split(/\s+/) ?? []);
const shape = (el: HTMLElement) => el.querySelector('[data-indicator]')?.getAttribute('data-indicator') ?? null;

describe('ActivityIndicator', () => {
  it.each([
    ['running', 'typing-dots'],
    ['waiting-approval', 'shield'],
    ['queued', 'clock'],
  ] as const)('shows a distinct %s shape in a row', (status, expected) => {
    render(<ActivityIndicator status={status} placement="row" />);
    expect(shape(screen.getByTestId('activity-indicator'))).toBe(expected);
  });

  it('uses a spinner ring on the avatar while running', () => {
    render(<ActivityIndicator status="running" placement="avatar" />);
    expect(shape(screen.getByTestId('activity-indicator'))).toBe('spinner');
  });

  it.each(['idle', 'interrupted', 'error', null] as (SessionStatus | null)[])('draws nothing for %s but keeps the row slot', (status) => {
    render(<ActivityIndicator status={status} placement="row" />);
    const slot = screen.getByTestId('activity-indicator');
    expect(slot.querySelector('[data-indicator]')).toBeNull();
    expect(tokens(slot)).toContain('w-4');
  });

  it('renders no avatar badge when idle', () => {
    render(<ActivityIndicator status="idle" placement="avatar" />);
    expect(screen.queryByTestId('activity-indicator')).toBeNull();
  });

  it('keeps the same slot size whether or not the indicator is visible', () => {
    const { rerender } = render(<ActivityIndicator status="running" placement="row" />);
    const size = () => (screen.getByTestId('activity-indicator').getAttribute('class') ?? '').split(/\s+/).filter((c) => /^(h|w)-/.test(c));
    const running = size();
    rerender(<ActivityIndicator status="idle" placement="row" />);
    expect(size()).toEqual(running);
  });

  it.each(['running', 'waiting-approval', 'queued'] as const)('animates %s only behind motion-safe', (status) => {
    for (const placement of ['row', 'avatar', 'thread'] as const) {
      const { unmount } = render(<ActivityIndicator status={status} placement={placement} />);
      const classes = tokens(screen.getByTestId('activity-indicator'));
      expect(classes.filter((c) => /^animate-/.test(c))).toEqual([]);
      if (status === 'running') expect(classes.some((c) => c.startsWith('motion-safe:animate-'))).toBe(true);
      unmount();
    }
  });

  it('is hidden from assistive tech so the surrounding text carries the status', () => {
    render(<ActivityIndicator status="running" placement="row" />);
    expect(screen.getByTestId('activity-indicator')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('AgentAvatar', () => {
  it('shows the badge only when a status is given and the agent is busy', () => {
    const { rerender } = render(<I18nProvider initial="es"><AgentAvatar agent="sdd-planner" /></I18nProvider>);
    expect(screen.queryByTestId('activity-indicator')).toBeNull();
    rerender(<I18nProvider initial="es"><AgentAvatar agent="sdd-planner" status="running" /></I18nProvider>);
    expect(screen.getByTestId('activity-indicator')).toHaveAttribute('data-status', 'running');
    rerender(<I18nProvider initial="es"><AgentAvatar agent="sdd-planner" status="idle" /></I18nProvider>);
    expect(screen.queryByTestId('activity-indicator')).toBeNull();
  });

  it('keeps the avatar size independent of the badge', () => {
    const { container } = render(<AgentAvatar agent="sdd-planner" size={24} status="running" />);
    expect(container.querySelector<HTMLElement>('span > span')?.style.width).toBe('24px');
  });
});
