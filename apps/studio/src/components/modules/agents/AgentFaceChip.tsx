'use client';

import type { PresenceState } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { AgentFace } from '../../workspace/AgentFace';

const RING: Record<PresenceState, string> = {
  working: 'ring-2 ring-emerald-400 motion-safe:animate-pulse',
  waiting: 'ring-2 ring-amber-400',
  open: '',
  idle: '',
};

export function AgentFaceChip({ agent, size, state = 'idle' }: { agent: string; size: number; state?: PresenceState }) {
  const { color } = agentMeta(agent);
  return (
    <span
      aria-hidden
      data-testid="presence-ring"
      data-state={state}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-foreground/20 ${RING[state]}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}22 0%, ${color}55 100%)` }}
    >
      <AgentFace agent={agent} size={size} />
    </span>
  );
}
