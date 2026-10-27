import type { Presence, PresenceState } from '@sdd-studio/protocol';

const RANK: Record<PresenceState, number> = { working: 0, waiting: 1, open: 2, idle: 3 };

export function presenceOfAgent(presence: readonly Presence[], agentId: string): Presence | null {
  const own = presence.filter((entry) => entry.agent === agentId).sort((a, b) => RANK[a.state] - RANK[b.state]);
  return own[0] ?? null;
}

export const isAgentActive = (entry: Presence | null): boolean => entry !== null && entry.state !== 'idle';

export type PresenceLabelKey =
  | 'module.agents.presence.working'
  | 'module.agents.presence.waiting'
  | 'module.agents.presence.active'
  | 'module.agents.presence.inactive';

export function presenceLabelKey(entry: Presence | null): PresenceLabelKey {
  if (entry === null || entry.state === 'idle') return 'module.agents.presence.inactive';
  if (entry.state === 'working') return 'module.agents.presence.working';
  if (entry.state === 'waiting') return 'module.agents.presence.waiting';
  return 'module.agents.presence.active';
}

export function presenceDotClass(entry: Presence | null): string {
  if (entry === null || entry.state === 'idle') return 'border border-ink-500';
  if (entry.state === 'working') return 'bg-emerald-400 motion-safe:animate-pulse';
  if (entry.state === 'waiting') return 'bg-amber-400';
  return 'bg-emerald-400';
}
