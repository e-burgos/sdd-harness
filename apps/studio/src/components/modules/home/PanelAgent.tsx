import type { Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { ROW_ICON } from '@/lib/typography-tokens';
import { AgentFace } from '../../workspace/AgentFace';

const RING: Record<Presence['state'], string> = {
  working: 'ring-2 ring-emerald-400 motion-safe:animate-pulse',
  waiting: 'ring-2 ring-amber-400',
  open: '',
  idle: '',
};

export function PanelAgent({ agent, state }: { agent: string; state?: Presence['state'] }) {
  const meta = agentMeta(agent);
  return (
    <span
      aria-hidden
      data-testid="panel-agent"
      data-state={state ?? 'none'}
      className={`inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-md ${RING[state ?? 'idle']}`}
      style={{ width: ROW_ICON, height: ROW_ICON, background: `linear-gradient(135deg, ${meta.color}22 0%, ${meta.color}55 100%)` }}
    >
      <AgentFace agent={agent} size={ROW_ICON} />
    </span>
  );
}
