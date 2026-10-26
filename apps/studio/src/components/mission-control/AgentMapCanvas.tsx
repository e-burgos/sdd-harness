'use client';

import { useState, useEffect, useMemo } from 'react';
import { Bot } from 'lucide-react';
import { agentMeta } from '@/lib/agents';
import { useStudio } from '../BridgeProvider';
import { useConversationSelection } from '@/lib/use-conversation-selection';
import { AgentNode } from './AgentNode';
import { AgentInspectorDrawer } from './AgentInspectorDrawer';
import { ConversationSelector } from './ConversationSelector';
import { GateCard } from './GateCard';
import { GateInspectorDrawer } from './GateInspectorDrawer';
import {
  SDD_GATES,
  CYCLE_GATES,
  TRANSVERSAL_GATES,
  ALL_GATES,
  type GateId,
} from '@/lib/gates';
import { SwarmSpeechBubble, SwarmCommsConsole } from './LiveSwarmComms';

interface AgentPosition {
  id: string;
  x: number;
  y: number;
}

const NODES: AgentPosition[] = [
  { id: 'sdd-orchestrator', x: 500, y: 70 },
  { id: 'sdd-steward', x: 260, y: 130 },
  { id: 'sdd-hermes', x: 740, y: 130 },
  { id: 'sdd-functional', x: 500, y: 215 },
  { id: 'sdd-planner', x: 350, y: 360 },
  { id: 'sdd-architect', x: 650, y: 360 },
  { id: 'sdd-implementor-back', x: 350, y: 530 },
  { id: 'sdd-implementor-front', x: 650, y: 530 },
  { id: 'sdd-reviewer', x: 500, y: 690 },
];

const AGENT_EDGES: { from: string; to: string; label?: string }[] = [
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

const GATE_CONNECTIONS: { gateId: GateId; agentId: string }[] = [
  { gateId: 'gate-a', agentId: 'sdd-orchestrator' },
  { gateId: 'gate-a', agentId: 'sdd-hermes' },
  { gateId: 'gate-b', agentId: 'sdd-functional' },
  { gateId: 'gate-b', agentId: 'sdd-planner' },
  { gateId: 'gate-b', agentId: 'sdd-architect' },
  { gateId: 'gate-b', agentId: 'sdd-implementor-back' },
  { gateId: 'gate-b', agentId: 'sdd-implementor-front' },
  { gateId: 'contexto-gate', agentId: 'sdd-reviewer' },
  { gateId: 'contexto-gate', agentId: 'sdd-orchestrator' },
  { gateId: 'fix-gate', agentId: 'sdd-steward' },
  { gateId: 'fix-gate', agentId: 'sdd-orchestrator' },
  { gateId: 'regla-cero', agentId: 'sdd-steward' },
  { gateId: 'regla-cero', agentId: 'sdd-orchestrator' },
  { gateId: 'memoria-gate', agentId: 'sdd-reviewer' },
  { gateId: 'memoria-gate', agentId: 'sdd-orchestrator' },
];

export function AgentMapCanvas({ onOpenDm, onNewConversation }: { onOpenDm: (agentId: string) => void; onNewConversation: () => void }) {
  const presence = useStudio((s) => s.presence);
  const snapshot = useStudio((s) => s.snapshot);
  const { conversations, selectedThreadId, pick, view } = useConversationSelection();

  const [selectedAgent, setSelectedAgent] = useState<string | null>('sdd-orchestrator');
  const [selectedGate, setSelectedGate] = useState<GateId | null>(null);
  const [gateFilter, setGateFilter] = useState<'cycle' | 'transversal' | 'all'>('cycle');

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const [dialogueIdx, setDialogueIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [inspectedDialogueId, setInspectedDialogueId] = useState<string | null>(null);

  const dialogues = view?.dialogues ?? [];
  const lastDialogueIdx = dialogues.length - 1;

  useEffect(() => {
    setDialogueIdx(Math.max(0, lastDialogueIdx));
    setInspectedDialogueId(null);
  }, [selectedThreadId, lastDialogueIdx]);

  const currentDialogue = dialogues[Math.min(dialogueIdx, lastDialogueIdx)] ?? null;

  useEffect(() => {
    if (!isPlaying || dialogues.length === 0) return;
    const timer = setInterval(() => {
      setDialogueIdx((prev) => {
        if (prev + 1 >= dialogues.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [isPlaying, dialogues.length]);

  const conversationPresence = useMemo(
    () => presence.filter((p) => p.threadId !== null && p.threadId === selectedThreadId),
    [presence, selectedThreadId],
  );
  const presenceMap = new Map(conversationPresence.map((p) => [p.agent, p]));
  const nodeMap = new Map(NODES.map((n) => [n.id, n]));

  const workingAgents = useMemo(
    () => new Set(conversationPresence.filter((p) => p.state === 'working').map((p) => p.agent)),
    [conversationPresence],
  );
  const participantIds = useMemo(() => new Set((view?.participants ?? []).map((p) => p.agentId)), [view]);
  const dimNonParticipants = participantIds.size > 0;

  const activePresenceCount = workingAgents.size;
  const fromPos = (currentDialogue && nodeMap.get(currentDialogue.from)) ?? { x: 500, y: 70 };

  const isInspecting = Boolean(inspectedDialogueId && currentDialogue?.id === inspectedDialogueId);
  const shouldShowBubble = Boolean(currentDialogue) && Boolean(activePresenceCount > 0 || currentDialogue?.isLive || isInspecting);

  const displayedGateIds: GateId[] = useMemo(() => {
    if (gateFilter === 'cycle') return CYCLE_GATES;
    if (gateFilter === 'transversal') return TRANSVERSAL_GATES;
    return ALL_GATES;
  }, [gateFilter]);

  const gateLayouts = useMemo(() => {
    const isAll = gateFilter === 'all';
    const cardWidth = 168;
    const cardHeight = isAll ? 98 : 124;
    const startY = isAll ? 60 : 70;
    const stepY = isAll ? 112 : 160;

    return displayedGateIds.map((id, index) => {
      const x = 20;
      const y = startY + index * stepY;
      return {
        id,
        gate: SDD_GATES[id],
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        anchorX: x + cardWidth,
        anchorY: y + cardHeight / 2,
      };
    });
  }, [displayedGateIds, gateFilter]);

  const gateLayoutMap = new Map(gateLayouts.map((g) => [g.id, g]));

  const handleSelectGate = (gateId: string) => {
    setSelectedGate(gateId as GateId);
  };

  const handleSelectAgentFromGate = (agentId: string) => {
    setSelectedAgent(agentId);
    setSelectedGate(null);
    setIsPanelCollapsed(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | SVGElement | null;
    if (
      target?.closest?.(
        'button, input, textarea, form, [data-testid="gate-card"], .agent-node-interactive, [data-testid="agent-inspector-drawer"], [data-testid="gate-inspector-drawer"], [data-testid="swarm-comms-console"], [data-testid="conversation-selector"], [data-testid="open-panel-button"], [data-testid="zoom-toolbar"]'
      )
    ) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | SVGElement | null;
    if (
      target?.closest?.(
        'button, input, textarea, [data-testid="gate-card"], [data-testid="agent-inspector-drawer"], [data-testid="gate-inspector-drawer"], [data-testid="swarm-comms-console"], [data-testid="zoom-toolbar"]'
      )
    ) {
      return;
    }
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(2.5, Number((prev + 0.15).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.4, Number((prev - 0.15).toFixed(2))));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      data-testid="agent-map-canvas"
      className="relative flex-1 h-full w-full overflow-hidden bg-radial from-ink-900 to-ink-950 flex flex-col select-none"
    >
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-ink-950/40 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <h2 className="text-sm font-semibold text-white tracking-tight">Topología del Enjambre</h2>
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400 font-bold border border-emerald-500/20">
              GATES
            </span>
          </div>
          <span className="text-xs text-white/50 font-mono">
            {snapshot?.project ? `Proyecto: ${snapshot.project}` : `${NODES.length} agentes`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/10 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setGateFilter('cycle')}
              className={`px-2 py-0.5 rounded-md transition-all ${
                gateFilter === 'cycle'
                  ? 'bg-emerald-500 text-ink-950 font-bold shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Ciclo (4)
            </button>
            <button
              type="button"
              onClick={() => setGateFilter('transversal')}
              className={`px-2 py-0.5 rounded-md transition-all ${
                gateFilter === 'transversal'
                  ? 'bg-emerald-500 text-ink-950 font-bold shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Transversales (2)
            </button>
            <button
              type="button"
              onClick={() => setGateFilter('all')}
              className={`px-2 py-0.5 rounded-md transition-all ${
                gateFilter === 'all'
                  ? 'bg-emerald-500 text-ink-950 font-bold shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Todas (6)
            </button>
          </div>

          <div className="h-4 w-[1px] bg-white/10" />

          <div className="flex items-center gap-4 text-xs font-mono text-white/60">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span>{activePresenceCount} en ejecución</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>{NODES.length - activePresenceCount} listos</span>
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-6 py-2">
        <ConversationSelector
          conversations={conversations}
          selectedThreadId={selectedThreadId}
          onPick={pick}
          onNewConversation={onNewConversation}
        />
      </div>

      <div
        className={`relative flex-1 w-full h-full flex items-center justify-center p-4 transition-all duration-300 ${
          !isPanelCollapsed ? 'pr-0 lg:pr-[420px]' : 'pr-0'
        } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="w-full h-full flex items-center justify-center pointer-events-auto"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '500px 430px',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          <svg
            viewBox="0 0 1000 860"
            className="w-full h-full max-h-[85vh] drop-shadow-2xl select-none"
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
              <filter id="gate-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="glow" />
                <feComposite in="SourceGraphic" in2="glow" operator="over" />
              </filter>
            </defs>

            {GATE_CONNECTIONS.map((conn, idx) => {
              const gateLayout = gateLayoutMap.get(conn.gateId);
              const targetNode = nodeMap.get(conn.agentId);
              if (!gateLayout || !targetNode) return null;

              const isGateSelected = selectedGate === conn.gateId;
              const isAgentSelected = selectedAgent === conn.agentId;
              const isHighlight = isGateSelected || isAgentSelected;

              const midX = (gateLayout.anchorX + targetNode.x) / 2;
              const pathData = `M ${gateLayout.anchorX} ${gateLayout.anchorY} C ${gateLayout.anchorX + 50} ${gateLayout.anchorY}, ${midX} ${targetNode.y}, ${targetNode.x} ${targetNode.y}`;

              return (
                <g key={`gate-conn-${conn.gateId}-${conn.agentId}-${idx}`}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke={isHighlight ? gateLayout.gate.color : '#ffffff'}
                    strokeOpacity={isHighlight ? '0.75' : '0.1'}
                    strokeWidth={isHighlight ? '2.5' : '1'}
                    strokeDasharray={isHighlight ? '6 4' : '3 4'}
                    filter={isHighlight ? 'url(#gate-glow)' : undefined}
                    className={isHighlight ? 'animate-[dash_1s_linear_infinite]' : undefined}
                  />
                </g>
              );
            })}

            {AGENT_EDGES.map((edge) => {
              const from = nodeMap.get(edge.from);
              const to = nodeMap.get(edge.to);
              if (!from || !to) return null;

              const isCommunicating =
                Boolean(shouldShowBubble &&
                currentDialogue &&
                ((edge.from === currentDialogue.from && edge.to === currentDialogue.to) ||
                  (edge.from === currentDialogue.to && edge.to === currentDialogue.from)));

              const isFlowActive =
                isCommunicating ||
                workingAgents.has(edge.from) ||
                workingAgents.has(edge.to);

              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              const pathData = `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;

              return (
                <g key={`${edge.from}-${edge.to}`}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke={isCommunicating ? '#10b981' : isFlowActive ? '#38bdf8' : '#ffffff'}
                    strokeOpacity={isCommunicating ? '0.85' : isFlowActive ? '0.5' : '0.12'}
                    strokeWidth={isCommunicating ? '3' : isFlowActive ? '2.5' : '1.5'}
                    filter={isFlowActive || isCommunicating ? 'url(#glow)' : undefined}
                  />
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

            {gateLayouts.map((g) => (
              <foreignObject
                key={g.id}
                x={g.x}
                y={g.y}
                width={g.width}
                height={g.height}
                className="overflow-visible"
              >
                <GateCard
                  gate={g.gate}
                  isSelected={selectedGate === g.id}
                  onSelect={handleSelectGate}
                  width={g.width}
                  height={g.height}
                />
              </foreignObject>
            ))}

            {NODES.map((node) => (
              <AgentNode
                key={node.id}
                agentId={node.id}
                x={node.x}
                y={node.y}
                presence={presenceMap.get(node.id)}
                participating={!dimNonParticipants || participantIds.has(node.id)}
                isSelected={selectedAgent === node.id}
                onSelect={(id) => {
                  setSelectedAgent(id);
                  setSelectedGate(null);
                  setIsPanelCollapsed(false);
                }}
              />
            ))}

            {shouldShowBubble && currentDialogue && (
              <SwarmSpeechBubble dialogue={currentDialogue} fromNodePos={fromPos} />
            )}
          </svg>
        </div>

        <div
          data-testid="zoom-toolbar"
          className="absolute bottom-6 left-6 z-20 flex items-center gap-1.5 rounded-xl border border-white/15 bg-ink-950/85 p-1.5 shadow-xl backdrop-blur-xl select-none"
        >
          <button
            type="button"
            onClick={handleZoomIn}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 font-mono text-xs font-bold text-white/80 hover:bg-white/15 hover:text-white transition-all active:scale-95"
            title="Acercar (+)"
          >
            +
          </button>
          <span className="min-w-[42px] text-center font-mono text-[11px] font-semibold text-emerald-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomOut}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 font-mono text-xs font-bold text-white/80 hover:bg-white/15 hover:text-white transition-all active:scale-95"
            title="Alejar (-)"
          >
            -
          </button>
          <div className="h-4 w-[1px] bg-white/10 mx-0.5" />
          <button
            type="button"
            onClick={handleResetZoom}
            className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 font-mono text-[10px] text-white/70 hover:bg-white/15 hover:text-white transition-all active:scale-95"
            title="Restablecer posición y zoom (100%)"
          >
            <span>⟲</span>
            <span>Ajustar</span>
          </button>
        </div>

        {isPanelCollapsed && (
          <button
            type="button"
            data-testid="open-panel-button"
            onClick={() => setIsPanelCollapsed(false)}
            className="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-xl border border-white/15 bg-ink-950/90 px-3.5 py-2 font-mono text-xs text-emerald-400 shadow-2xl backdrop-blur-md hover:bg-ink-900 hover:border-emerald-500/50 transition-all hover:scale-105 active:scale-95"
            title="Expandir panel lateral"
          >
            <Bot className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-white">Panel</span>
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
              {selectedAgent ? agentMeta(selectedAgent).name : 'Enjambre'}
            </span>
          </button>
        )}

        <SwarmCommsConsole
          currentDialogue={currentDialogue}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          onNext={() => setDialogueIdx((prev) => (dialogues.length === 0 ? 0 : (prev + 1) % dialogues.length))}
          activePresenceCount={activePresenceCount}
          isPanelCollapsed={isPanelCollapsed}
        />

        {!isPanelCollapsed && (
          <AgentInspectorDrawer
            agentId={selectedAgent}
            presence={selectedAgent ? presenceMap.get(selectedAgent) : undefined}
            conversation={view}
            currentDialogueId={currentDialogue?.id}
            onPickConversation={pick}
            onSelectAgent={(id) => {
              setSelectedAgent(id);
              setSelectedGate(null);
            }}
            onSelectDialogue={(dialogue) => {
              setInspectedDialogueId(dialogue.id);
              const idx = dialogues.findIndex((item) => item.id === dialogue.id);
              if (idx >= 0) setDialogueIdx(idx);
            }}
            onClose={() => setIsPanelCollapsed(true)}
            onOpenDm={onOpenDm}
          />
        )}

        <GateInspectorDrawer
          gateId={selectedGate}
          onClose={() => setSelectedGate(null)}
          onSelectAgent={handleSelectAgentFromGate}
        />
      </div>
    </div>
  );
}
