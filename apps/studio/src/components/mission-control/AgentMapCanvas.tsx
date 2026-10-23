'use client';

import { useState } from 'react';
import { useBridge } from '../BridgeProvider';
import { AgentNode } from './AgentNode';
import { AgentInspectorDrawer } from './AgentInspectorDrawer';

interface AgentPosition {
  id: string;
  x: number;
  y: number;
}

const NODES: AgentPosition[] = [
  { id: 'sdd-orchestrator', x: 500, y: 100 },
  { id: 'sdd-steward', x: 180, y: 140 },
  { id: 'sdd-hermes', x: 820, y: 140 },
  { id: 'sdd-functional', x: 500, y: 220 },
  { id: 'sdd-planner', x: 330, y: 340 },
  { id: 'sdd-architect', x: 670, y: 340 },
  { id: 'sdd-implementor-back', x: 330, y: 460 },
  { id: 'sdd-implementor-front', x: 670, y: 460 },
  { id: 'sdd-reviewer', x: 500, y: 550 },
];

const EDGES: { from: string; to: string; label?: string }[] = [
  { from: 'sdd-steward', to: 'sdd-orchestrator', label: 'kit status' },
  { from: 'sdd-hermes', to: 'sdd-orchestrator', label: 'new spec' },
  { from: 'sdd-orchestrator', to: 'sdd-functional', label: 'brief' },
  { from: 'sdd-functional', to: 'sdd-planner', label: 'user stories' },
  { from: 'sdd-functional', to: 'sdd-architect', label: 'requirements' },
  { from: 'sdd-planner', to: 'sdd-architect', label: 'contracts' },
  { from: 'sdd-planner', to: 'sdd-implementor-back', label: 'tasks-be' },
  { from: 'sdd-architect', to: 'sdd-implementor-front', label: 'tasks-fe' },
  { from: 'sdd-implementor-back', to: 'sdd-reviewer', label: 'PR / test' },
  { from: 'sdd-implementor-front', to: 'sdd-reviewer', label: 'UI / views' },
  { from: 'sdd-reviewer', to: 'sdd-orchestrator', label: 'gate approve' },
];

export function AgentMapCanvas({ onOpenDm }: { onOpenDm: (agentId: string) => void }) {
  const { presence, snapshot } = useBridge();
  const [selectedAgent, setSelectedAgent] = useState<string | null>('sdd-orchestrator');

  const presenceMap = new Map(presence.map((p) => [p.agent, p]));
  const nodeMap = new Map(NODES.map((n) => [n.id, n]));

  const activePresenceCount = presence.filter((p) => p.state === 'working').length;

  return (
    <div
      data-testid="agent-map-canvas"
      className="relative flex-1 h-full w-full overflow-hidden bg-radial from-ink-900 to-ink-950 flex flex-col select-none"
    >
      {/* Background Micro-Grid */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Banner Status Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-ink-950/40 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <h2 className="text-sm font-semibold text-white tracking-tight">Topología del Enjambre</h2>
          </div>
          <span className="text-xs text-white/50 font-mono">
            {snapshot?.project ? `Proyecto: ${snapshot.project}` : '9 agentes en línea'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-white/60">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <span>{activePresenceCount} en ejecución</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>9 listos</span>
          </span>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center p-4">
        <svg
          viewBox="0 0 1000 620"
          className="w-full h-full max-h-[82vh] transition-transform duration-300 drop-shadow-2xl"
        >
          <defs>
            <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>
          </defs>

          {/* Edges Conduits */}
          {EDGES.map((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;

            const isFlowActive =
              presenceMap.get(edge.from)?.state === 'working' ||
              presenceMap.get(edge.to)?.state === 'working';

            // Quadratic bezier midpoint curve
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            const pathData = `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;

            return (
              <g key={`${edge.from}-${edge.to}`}>
                {/* Background Shadow Edge */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={isFlowActive ? '#38bdf8' : '#ffffff'}
                  strokeOpacity={isFlowActive ? '0.4' : '0.12'}
                  strokeWidth={isFlowActive ? '3' : '1.5'}
                  filter={isFlowActive ? 'url(#glow)' : undefined}
                />
                {/* Active Flow Animation Line */}
                {isFlowActive && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    strokeDasharray="8 6"
                    className="animate-[dash_1s_linear_infinite]"
                  />
                )}
              </g>
            );
          })}

          {/* Agent Nodes */}
          {NODES.map((node) => (
            <AgentNode
              key={node.id}
              agentId={node.id}
              x={node.x}
              y={node.y}
              presence={presenceMap.get(node.id)}
              isSelected={selectedAgent === node.id}
              onSelect={setSelectedAgent}
            />
          ))}
        </svg>

        {/* Selected Agent Inspector Drawer */}
        <AgentInspectorDrawer
          agentId={selectedAgent}
          presence={selectedAgent ? presenceMap.get(selectedAgent) : undefined}
          onClose={() => setSelectedAgent(null)}
          onOpenDm={onOpenDm}
        />
      </div>
    </div>
  );
}
