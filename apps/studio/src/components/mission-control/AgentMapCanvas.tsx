'use client';

import { useState, useEffect } from 'react';
import { useStudio } from '../BridgeProvider';
import { AgentNode } from './AgentNode';
import { AgentInspectorDrawer } from './AgentInspectorDrawer';
import { SDD_SWARM_SCRIPT } from './swarm-dialogue';
import { SwarmSpeechBubble, SwarmCommsConsole } from './LiveSwarmComms';

interface AgentPosition {
  id: string;
  x: number;
  y: number;
}

const NODES: AgentPosition[] = [
  { id: 'sdd-orchestrator', x: 500, y: 75 },
  { id: 'sdd-steward', x: 190, y: 115 },
  { id: 'sdd-hermes', x: 810, y: 115 },
  { id: 'sdd-functional', x: 500, y: 200 },
  { id: 'sdd-planner', x: 330, y: 315 },
  { id: 'sdd-architect', x: 670, y: 315 },
  { id: 'sdd-implementor-back', x: 330, y: 430 },
  { id: 'sdd-implementor-front', x: 670, y: 430 },
  { id: 'sdd-reviewer', x: 500, y: 540 },
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
  const presence = useStudio((s) => s.presence ?? []);
  const snapshot = useStudio((s) => s.snapshot);
  const [selectedAgent, setSelectedAgent] = useState<string | null>('sdd-orchestrator');

  const [dialogueIdx, setDialogueIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setDialogueIdx((prev) => (prev + 1) % SDD_SWARM_SCRIPT.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const presenceMap = new Map((presence ?? []).map((p) => [p.agent, p]));
  const nodeMap = new Map(NODES.map((n) => [n.id, n]));

  const activePresenceCount = (presence ?? []).filter((p) => p.state === 'working').length;
  const currentDialogue = SDD_SWARM_SCRIPT[dialogueIdx];
  const fromPos = nodeMap.get(currentDialogue.from) ?? { x: 500, y: 75 };

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
      <div
        className={`relative flex-1 w-full h-full flex items-center justify-center p-4 transition-all duration-300 ${
          selectedAgent ? 'pr-0 lg:pr-96' : ''
        }`}
      >
        <svg
          viewBox="0 0 1000 700"
          className="w-full h-full max-h-[85vh] transition-transform duration-300 drop-shadow-2xl"
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

            const isCommunicating =
              (edge.from === currentDialogue.from && edge.to === currentDialogue.to) ||
              (edge.from === currentDialogue.to && edge.to === currentDialogue.from);

            const isFlowActive =
              isCommunicating ||
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
                  stroke={isCommunicating ? '#10b981' : isFlowActive ? '#38bdf8' : '#ffffff'}
                  strokeOpacity={isCommunicating ? '0.85' : isFlowActive ? '0.4' : '0.12'}
                  strokeWidth={isCommunicating ? '3' : isFlowActive ? '2.5' : '1.5'}
                  filter={isFlowActive || isCommunicating ? 'url(#glow)' : undefined}
                />
                {/* Active Flow Animation Line */}
                {(isFlowActive || isCommunicating) && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke={isCommunicating ? '#10b981' : '#38bdf8'}
                    strokeWidth={isCommunicating ? '3.5' : '2.5'}
                    strokeDasharray={isCommunicating ? '10 6' : '8 6'}
                    className="animate-[dash_0.8s_linear_infinite]"
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

          {/* Active Swarm Speech Bubble */}
          <SwarmSpeechBubble dialogue={currentDialogue} fromNodePos={fromPos} />
        </svg>

        {/* Live Swarm Inter-Agent Comms Console */}
        <SwarmCommsConsole
          currentDialogue={currentDialogue}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          onNext={() => setDialogueIdx((prev) => (prev + 1) % SDD_SWARM_SCRIPT.length)}
          dialogueHistory={SDD_SWARM_SCRIPT}
        />

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
