'use client';

import { useNav } from '@/lib/nav/use-nav';
import { AgentMapCanvas } from '../../mission-control/AgentMapCanvas';

export function MapCenter() {
  const selectedAgent = useNav((s) => s.selection.agents);
  const select = useNav((s) => s.select);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      <AgentMapCanvas selectedAgent={selectedAgent} onSelectAgent={(id) => select('agents', id)} />
    </div>
  );
}
