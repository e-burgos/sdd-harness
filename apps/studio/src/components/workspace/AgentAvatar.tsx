import { agentMeta } from '@/lib/agents';

export function AgentAvatar({ agent, size = 32 }: { agent: string; size?: number }) {
  const meta = agentMeta(agent);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-semibold text-ink-950"
      style={{ width: size, height: size, backgroundColor: meta.color }}
    >
      {meta.short}
    </span>
  );
}
