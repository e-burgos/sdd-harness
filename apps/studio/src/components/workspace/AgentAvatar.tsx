import type { SessionStatus } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { ActivityIndicator } from './ActivityIndicator';

export function AgentAvatar({ agent, size = 32, status }: { agent: string; size?: number; status?: SessionStatus | null }) {
  const meta = agentMeta(agent);
  return (
    <span aria-hidden className="relative inline-flex shrink-0">
      <span
        className="inline-flex items-center justify-center rounded-lg font-mono text-[11px] font-semibold text-ink-950"
        style={{ width: size, height: size, backgroundColor: meta.color }}
      >
        {meta.short}
      </span>
      {status !== undefined && <ActivityIndicator status={status} placement="avatar" />}
    </span>
  );
}
