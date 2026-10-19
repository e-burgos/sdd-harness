import type { Presence, SessionStatus } from '@sdd-studio/protocol';
import type { ThreadState } from './timeline';

export interface ActivityEntry {
  threadId: string;
  title: string;
  status: SessionStatus;
  agents: { agent: string; state: Presence['state']; tool: string | null }[];
}

const BUSY = new Set<SessionStatus>(['running', 'waiting-approval', 'queued']);

export function activityOf(threads: Record<string, ThreadState>, presence: Presence[]): ActivityEntry[] {
  return Object.values(threads).flatMap((t) => {
    const info = t.info;
    if (!info || !BUSY.has(info.status)) return [];
    const agents = presence
      .filter((p) => p.threadId === info.id && p.state !== 'idle')
      .map((p) => ({ agent: p.agent, state: p.state, tool: p.tool }))
      .sort((a, b) => Number(b.agent === info.agent) - Number(a.agent === info.agent));
    return [{ threadId: info.id, title: info.title, status: info.status, agents }];
  });
}
