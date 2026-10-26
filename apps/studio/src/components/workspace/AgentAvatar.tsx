import { Crown } from 'lucide-react';
import type { SessionStatus } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { ActivityIndicator } from './ActivityIndicator';
import { AgentFace } from './AgentFace';

export function AgentAvatar({
  agent,
  size = 32,
  status,
  showBadge = true,
}: {
  agent: string;
  size?: number;
  status?: SessionStatus | null;
  showBadge?: boolean;
}) {
  const meta = agentMeta(agent);
  const isLeader = meta.isLeader;
  const isRunning = status === 'running';

  return (
    <span
      className="relative inline-flex shrink-0 select-none group"
      title={`${meta.name} (${meta.title}) · ${meta.personality}`}
    >
      <span
        className={`relative inline-flex items-center justify-center rounded-xl transition-all duration-300 shadow-sm border border-white/20 overflow-hidden ${
          isRunning ? 'ring-2 ring-emerald-400/80 animate-pulse' : ''
        }`}
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${meta.color}22 0%, ${meta.color}55 100%)`,
          boxShadow: isRunning ? `0 0 12px ${meta.accentGlow}` : undefined,
        }}
      >
        <AgentFace agent={agent} size={size} />
        {isLeader && size >= 24 && (
          <span
            aria-hidden
            data-testid="agent-leader-crown"
            className="absolute -top-1 -right-0.5 p-0.5 rounded-full bg-ink-950/90 text-amber-400 select-none drop-shadow-md z-10 border border-amber-400/30"
            title="Líder del enjambre"
          >
            <Crown className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
          </span>
        )}
      </span>
      {status !== undefined && showBadge && <ActivityIndicator status={status} placement="avatar" />}
    </span>
  );
}
