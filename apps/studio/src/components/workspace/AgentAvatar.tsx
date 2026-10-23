import type { SessionStatus } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { ActivityIndicator } from './ActivityIndicator';

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
        className={`relative inline-flex items-center justify-center rounded-xl font-mono text-[11px] font-bold text-ink-950 transition-all duration-300 shadow-sm border border-white/20 ${
          isRunning ? 'ring-2 ring-emerald-400/80 animate-pulse' : ''
        }`}
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${meta.color}dd 0%, ${meta.color} 100%)`,
          boxShadow: isRunning ? `0 0 12px ${meta.accentGlow}` : undefined,
        }}
      >
        <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">{meta.short}</span>
        {isLeader && size >= 24 && (
          <span
            aria-hidden
            className="absolute -top-1.5 -right-1 text-[10px] leading-none select-none drop-shadow-md"
            title="Líder del enjambre"
          >
            👑
          </span>
        )}
      </span>
      {status !== undefined && showBadge && <ActivityIndicator status={status} placement="avatar" />}
    </span>
  );
}
