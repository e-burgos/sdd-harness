import { Clock, ShieldAlert } from 'lucide-react';
import type { SessionStatus } from '@sdd-studio/protocol';

export type ActivityPlacement = 'row' | 'avatar' | 'thread';

export const INDICATED_STATUSES: ReadonlySet<SessionStatus> = new Set(['running', 'waiting-approval', 'queued']);

const DOT_DELAYS = ['0ms', '150ms', '300ms'];

function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.5" data-indicator="typing-dots">
      {DOT_DELAYS.map((delay) => (
        <span key={delay} className="h-1 w-1 rounded-full bg-accent-400 motion-safe:animate-bounce" style={{ animationDelay: delay }} />
      ))}
    </span>
  );
}

function SpinnerRing() {
  return <span className="block h-3 w-3 rounded-full border-2 border-accent-400 border-t-transparent motion-safe:animate-spin" data-indicator="spinner" />;
}

function glyph(status: SessionStatus, placement: ActivityPlacement) {
  if (status === 'running') return placement === 'avatar' ? <SpinnerRing /> : <TypingDots />;
  if (status === 'waiting-approval') return <ShieldAlert size={placement === 'thread' ? 16 : 14} className="text-amberish" data-indicator="shield" />;
  if (status === 'queued') return <Clock size={placement === 'thread' ? 16 : 14} className="text-ink-300" data-indicator="clock" />;
  return null;
}

const SLOT: Record<ActivityPlacement, string> = {
  row: 'inline-flex h-4 w-4 shrink-0 items-center justify-center',
  avatar: 'absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-ink-900',
  thread: 'inline-flex h-6 w-6 shrink-0 items-center justify-center',
};

export function ActivityIndicator({ status, placement }: { status: SessionStatus | null; placement: ActivityPlacement }) {
  const shown = status !== null && INDICATED_STATUSES.has(status) ? status : null;
  if (placement === 'avatar' && shown === null) return null;
  return (
    <span aria-hidden data-testid="activity-indicator" data-status={shown ?? 'none'} className={SLOT[placement]}>
      {shown && glyph(shown, placement)}
    </span>
  );
}
