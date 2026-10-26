'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bot,
  User,
  X,
  Zap,
  Folder,
  FileText,
  MessageSquare,
  Users,
  MapPin,
  DoorOpen,
  Moon,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { AgentAvatar } from '../workspace/AgentAvatar';
import { AgentFace } from '../workspace/AgentFace';
import { LiveAgentChatFeed } from './LiveAgentChatFeed';
import { ChatDialogueCard } from './ChatDialogueCard';
import {
  type SwarmDialogue,
  type HarnessProvider,
  extractRuntimeDialogues,
} from './swarm-dialogue';
import { useStudio } from '../BridgeProvider';
import {
  getAgentGeneratedDocuments,
  type AgentGeneratedDocument,
} from '@/lib/agent-documents';
import { DocumentViewerModal } from './DocumentViewerModal';

interface AgentInspectorDrawerProps {
  agentId: string | null;
  presence?: Presence;
  mode?: 'live' | 'demo';
  dialogueHistory?: SwarmDialogue[];
  currentDialogue?: SwarmDialogue | null;
  selectedSpecId?: string;
  onSelectSpecId?: (specId: string) => void;
  selectedFixId?: string;
  onSelectFixId?: (fixId: string) => void;
  onSelectAgent?: (agentId: string) => void;
  onSelectDialogue?: (dialogue: SwarmDialogue) => void;
  onClose: () => void;
  onOpenDm: (agentId: string) => void;
}

export function AgentInspectorDrawer({
  agentId,
  presence,
  mode = 'live',
  dialogueHistory = [],
  currentDialogue,
  selectedSpecId: controlledSpecId,
  onSelectSpecId,
  selectedFixId: controlledFixId,
  onSelectFixId,
  onSelectAgent,
  onSelectDialogue,
  onClose,
  onOpenDm,
}: AgentInspectorDrawerProps) {
  const snapshot = useStudio((s) => s.snapshot);
  const threads = useStudio((s) => s.threads ?? {});

  const [activeTab, setActiveTab] = useState<'agent' | 'swarm'>(() => (agentId ? 'agent' : 'swarm'));
  const [showFullProfile, setShowFullProfile] = useState(false);
  const [swarmLimit, setSwarmLimit] = useState(50);
  const [showAgentDocs, setShowAgentDocs] = useState(true);
  const [viewingDoc, setViewingDoc] = useState<AgentGeneratedDocument | null>(null);

  // Requirement 8: Selector de Spec Gate
  const specsList = useMemo(() => {
    if (snapshot?.specs && snapshot.specs.length > 0) return snapshot.specs;
    return [
      { id: 'spec-e-burgos-004-studio-gates-topology', title: 'Topología interactiva de Gates', status: 'completed' },
      { id: 'spec-e-burgos-003-studio-mission-control', title: 'Mission Control y agentes en vivo', status: 'completed' },
      { id: 'spec-e-burgos-002-studio-ui-polish', title: 'Pulido de UI y eventos', status: 'completed' },
      { id: 'spec-e-burgos-001-studio-session-ux', title: 'UX de sesión e imágenes', status: 'completed' },
    ];
  }, [snapshot?.specs]);

  const [internalSpecId, setInternalSpecId] = useState<string>(() => specsList[0]?.id ?? 'spec-e-burgos-004-studio-gates-topology');
  const [specScope, setSpecScope] = useState<'all' | 'cycle' | 'fix' | 'internal'>('all');

  // Requirement 9: Selector de Fix Gate
  const fixesList = useMemo(() => {
    if (snapshot?.fixes && snapshot.fixes.length > 0) return snapshot.fixes;
    return [
      { id: 'FIX-e-burgos-003-001', title: 'Fix undefined filter y caras dibujadas', severity: 'medium', status: 'validated' },
      { id: 'FIX-e-burgos-002', title: 'Fix build mock types and FileResult', severity: 'high', status: 'validated' },
      { id: 'FIX-e-burgos-001', title: 'Run pnpm sdd:validate in CI', severity: 'low', status: 'validated' },
    ];
  }, [snapshot?.fixes]);

  const [internalFixId, setInternalFixId] = useState<string>('');
  const [fixFilter, setFixFilter] = useState<'all' | 'bugfix' | 'hotfix' | 'improvement'>('all');

  const activeSpecId = controlledSpecId ?? internalSpecId;
  const activeFixId = controlledFixId ?? internalFixId;

  const handleSelectSpec = (newSpecId: string) => {
    setInternalSpecId(newSpecId);
    setInternalFixId('');
    onSelectSpecId?.(newSpecId);
    onSelectFixId?.('');
  };

  const handleSelectFix = (newFixId: string) => {
    setInternalFixId(newFixId);
    onSelectFixId?.(newFixId);
  };

  // Refs para auto-scroll (Requirement 1)
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (agentId) {
      setActiveTab('agent');
    } else {
      setActiveTab('swarm');
    }
  }, [agentId]);

  // Requirement 1: Al tocar botón enjambre debe scrollear automáticamente hasta abajo
  useEffect(() => {
    if (activeTab === 'swarm') {
      const timer = setTimeout(scrollToBottom, 60);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  const meta = agentId ? agentMeta(agentId) : null;
  const state = presence?.state ?? 'idle';

  // Obtener los diálogos filtrados según el Spec / Fix seleccionado o historial general
  const activeDialogues = useMemo(() => {
    const extracted = extractRuntimeDialogues(presence ? [presence] : [], threads, {
      specId: activeSpecId,
      fixId: activeFixId || undefined,
      limit: swarmLimit,
    });
    if (dialogueHistory && dialogueHistory.length > 0) {
      if (activeFixId) {
        return extracted;
      }
      if (activeSpecId && activeSpecId !== 'spec-e-burgos-004-studio-gates-topology') {
        return extracted;
      }
      return dialogueHistory;
    }
    return extracted;
  }, [presence, threads, activeSpecId, activeFixId, swarmLimit, dialogueHistory]);

  // Orden cronológico: abajo el último mensaje (Requirement 2)
  const displayedDialogues = useMemo(() => {
    // Tomar los últimos 50 mensajes de la conversación
    return activeDialogues.slice(-swarmLimit);
  }, [activeDialogues, swarmLimit]);

  // Requirement 4 & 5: Proveedor y Sesión del enjambre
  const currentProvider: HarnessProvider = useMemo(() => {
    const fromDialogue = displayedDialogues.find((d) => d.provider)?.provider;
    if (fromDialogue) return fromDialogue;
    return 'claude';
  }, [displayedDialogues]);

  const currentSessionId = useMemo(() => {
    const fromDialogue = displayedDialogues.find((d) => d.engineSessionId)?.engineSessionId;
    if (fromDialogue) return fromDialogue;
    if (activeFixId) return `session-${activeFixId.toLowerCase()}`;
    if (activeSpecId) return `session-${activeSpecId.replace('spec-e-burgos-', 'spec-')}`;
    const threadList = Object.values(threads).filter((t) => t.info);
    if (threadList.length > 0) {
      return (
        (threadList[0]?.info as unknown as { engineSessionId?: string; providerSessionId?: string })
          ?.engineSessionId ??
        (threadList[0]?.info as unknown as { providerSessionId?: string })?.providerSessionId ??
        threadList[0]?.info?.id ??
        'session-live-default'
      );
    }
    return 'session-live-default';
  }, [displayedDialogues, activeFixId, activeSpecId, threads]);

  // Requirement 6: Dónde está parado el enjambre
  const locationSummary = useMemo(() => {
    if (activeFixId) {
      const fix = fixesList.find((f) => f.id === activeFixId);
      return {
        label: `${activeFixId}`,
        badge: 'FIX GATE',
        detail: fix?.title || 'Corrección de error en caliente',
        status: 'validated',
      };
    }
    const spec = specsList.find((s) => s.id === activeSpecId);
    return {
      label: activeSpecId ? activeSpecId.replace('spec-e-burgos-', 'spec-') : 'spec-004',
      badge: 'SPEC GATE',
      detail: spec?.title || 'Ciclo de desarrollo activo',
      status: spec?.status === 'completed' ? 'completed' : 'in-progress',
    };
  }, [activeFixId, activeSpecId, fixesList, specsList]);

  // Requirement 7: Documentos generados por el agente seleccionado
  const agentDocuments: AgentGeneratedDocument[] = useMemo(() => {
    if (!agentId) return [];
    return getAgentGeneratedDocuments(agentId, {
      specId: activeSpecId,
      cycleId: 'cycle-01',
      fixId: activeFixId || undefined,
    });
  }, [agentId, activeSpecId, activeFixId]);

  const filteredFixes = useMemo(() => {
    if (fixFilter === 'all') return fixesList;
    return fixesList.filter((f) => {
      const titleLower = f.title.toLowerCase();
      const idLower = f.id.toLowerCase();
      if (fixFilter === 'bugfix') return titleLower.includes('bug') || idLower.includes('bug');
      if (fixFilter === 'hotfix') return titleLower.includes('hot') || idLower.includes('hot');
      if (fixFilter === 'improvement') return titleLower.includes('improvement') || titleLower.includes('validate');
      return true;
    });
  }, [fixesList, fixFilter]);

  return (
    <aside
      data-testid="agent-inspector-drawer"
      className="absolute top-4 right-4 bottom-4 w-96 lg:w-[420px] rounded-2xl border border-white/15 bg-ink-950/95 p-4 shadow-2xl backdrop-blur-xl flex flex-col z-20 animate-in fade-in slide-in-from-right duration-300 select-none overflow-hidden"
    >
      {/* Drawer Top Navigation Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center bg-white/5 p-0.5 rounded-xl border border-white/10 text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              setActiveTab('swarm');
              setTimeout(scrollToBottom, 60);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              activeTab === 'swarm'
                ? 'bg-emerald-500 text-ink-950 font-bold shadow'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Enjambre</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (agentId) setActiveTab('agent');
            }}
            disabled={!agentId}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              activeTab === 'agent'
                ? 'bg-emerald-500 text-ink-950 font-bold shadow'
                : !agentId
                  ? 'text-white/30 cursor-not-allowed'
                  : 'text-white/60 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{meta ? meta.name : 'Agente'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {activeTab === 'agent' && meta && (
            <button
              type="button"
              onClick={() => setShowFullProfile(!showFullProfile)}
              className="rounded-lg px-2 py-1 text-[10px] font-mono text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              title="Alternar vista de perfil completo"
            >
              {showFullProfile ? 'Ocultar info' : 'Ver info'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors text-xs"
            title="Contraer panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {activeTab === 'agent' ? (
        meta && agentId ? (
          <>
            {/* Header del Agente */}
            <div className="flex items-center gap-3 py-2.5 border-b border-white/10 shrink-0">
              <AgentAvatar agent={agentId} size={42} status={presence?.state === 'working' ? 'running' : null} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm text-white truncate">{meta.name}</h3>
                  {meta.isLeader && (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300 font-bold shrink-0">
                      LEADER
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-white/50 font-mono uppercase truncate">{meta.role}</p>
              </div>
            </div>

            <div className="py-2 shrink-0 space-y-1.5 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      state === 'working'
                        ? 'bg-sky-400 animate-ping'
                        : state === 'waiting'
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                    }`}
                  />
                  <span className="text-[11px] font-mono font-medium text-white capitalize">
                    {state === 'working'
                      ? 'Ejecutando turno en vivo'
                      : state === 'waiting'
                        ? 'Esperando aprobación'
                        : 'En espera (Ready)'}
                  </span>
                </div>
                <span className="text-[10px] text-white/40 font-mono truncate max-w-[160px]">
                  {meta.title}
                </span>
              </div>

              {presence?.tool && (
                <div className="flex items-center gap-1.5 rounded-md bg-sky-950/40 border border-sky-500/30 px-2 py-1 font-mono text-[10px] text-sky-200 truncate">
                  <Zap className="w-3 h-3 text-sky-400 shrink-0" />
                  <span className="truncate">{presence.tool}</span>
                </div>
              )}

              {showFullProfile && (
                <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                  <p className="text-[11px] leading-relaxed text-white/70 bg-white/5 p-2.5 rounded-lg border border-white/5">
                    &ldquo;{meta.personality}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Requirement 7: Documentos generados por este agente (Imagen 2) */}
            <div className="py-2 border-b border-white/10 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <button
                  type="button"
                  onClick={() => setShowAgentDocs(!showAgentDocs)}
                  className="flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <Folder className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Documentos Generados ({agentDocuments.length})</span>
                  {showAgentDocs ? (
                    <ChevronUp className="w-3 h-3 text-white/40" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-white/40" />
                  )}
                </button>
                <span className="text-[9px] font-mono text-white/40 truncate max-w-[140px]">
                  {activeFixId || activeSpecId.replace('spec-e-burgos-', '')}
                </span>
              </div>

              {showAgentDocs && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 animate-in fade-in duration-200">
                  {agentDocuments.length === 0 ? (
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-[10px] text-white/60 leading-relaxed font-sans">
                      <p className="font-mono text-emerald-400 font-semibold mb-0.5">
                        Sin documentos generados en este ciclo.
                      </p>
                      <p>
                        Rol de {meta.name}: {meta.title}. Participa en fases de spec o gate cruzado.
                      </p>
                    </div>
                  ) : (
                    agentDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setViewingDoc(doc)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setViewingDoc(doc);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-emerald-500/40 hover:bg-white/10 transition-all flex flex-col gap-0.5 cursor-pointer group"
                        title={`Ver documento en modal: ${doc.name}`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="flex items-center gap-1.5 font-bold text-white group-hover:text-emerald-300 transition-colors truncate max-w-[190px]" title={doc.path}>
                            <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">{doc.name}</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <span
                              className={`px-1 py-0.2 rounded text-[8px] font-extrabold uppercase ${
                                doc.type === 'spec'
                                  ? 'bg-sky-500/20 text-sky-300'
                                  : doc.type === 'plan' || doc.type === 'wbs'
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : doc.type === 'code'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : doc.type === 'context'
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {doc.type}
                            </span>
                            <span className="text-[9px] text-white/40 group-hover:text-emerald-400 transition-colors">↗</span>
                          </div>
                        </div>
                        <p className="text-[9px] text-white/70 line-clamp-1 font-sans">{doc.description}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Split-View: Feed de conversación en vivo abajo */}
            <div className="flex-1 min-h-0 py-2 flex flex-col">
              <LiveAgentChatFeed agentId={agentId} mode={mode} onOpenDm={onOpenDm} />
            </div>

            <div className="pt-2 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onOpenDm(agentId);
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-ink-950 py-2 px-3 font-semibold text-xs tracking-wide shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Abrir chat directo con {meta.name}</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white/50 space-y-3">
            <Users className="w-8 h-8 text-white/30" />
            <p className="text-xs font-semibold text-white/80">Ningún agente seleccionado</p>
            <p className="text-[11px] text-white/50 max-w-[260px] leading-relaxed">
              Haz clic en cualquiera de los nodos del mapa para inspeccionar a un agente y ver los documentos que generó.
            </p>
          </div>
        )
      ) : (
        /* Tab: ENJAMBRE */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header con ubicación, proveedor y sesión (Requirements 4, 5, 6) */}
          <div className="p-2.5 bg-ink-900/70 border-b border-white/10 rounded-t-xl shrink-0 space-y-2">
            {/* Requirement 6: Dónde está parado el enjambre */}
            <div className="flex items-center justify-between gap-1 text-[11px] font-mono">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-emerald-400 font-extrabold text-[10px] flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> PARADO EN:
                </span>
                <span className="font-semibold text-white text-[10px] truncate" title={locationSummary.detail}>
                  {locationSummary.label}
                </span>
              </div>
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {locationSummary.status}
              </span>
            </div>

            {/* Requirements 4 & 5: Proveedor y Sesión del enjambre */}
            <div className="flex items-center justify-between text-[9px] font-mono bg-white/5 px-2 py-1.5 rounded-lg border border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="text-white/50 uppercase">PROVEEDOR:</span>
                <span
                  className={`px-1.5 py-0.5 rounded font-extrabold flex items-center gap-1 ${
                    currentProvider === 'gemini'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : currentProvider === 'copilot'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      currentProvider === 'gemini'
                        ? 'bg-sky-400'
                        : currentProvider === 'copilot'
                          ? 'bg-emerald-400'
                          : 'bg-purple-400'
                    }`}
                  />
                  <span>
                    {currentProvider === 'gemini'
                      ? 'Google Gemini'
                      : currentProvider === 'copilot'
                        ? 'GitHub Copilot'
                        : 'Claude Code'}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-1 truncate max-w-[180px]" title={`Sesión: ${currentSessionId}`}>
                <span className="text-white/50 uppercase">SESIÓN:</span>
                <span className="text-sky-300 font-mono truncate">{currentSessionId.slice(0, 14)}...</span>
              </div>
            </div>

            {/* Selectores de Spec Gate y Fix Gate (Requirements 8 & 9) */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              {/* Requirement 8: Selector de Spec Gate */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[9px] font-mono text-white/50">
                  <span className="uppercase font-semibold flex items-center gap-1">
                    <DoorOpen className="w-3 h-3 text-emerald-400" /> Spec Gate
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSpecScope('cycle')}
                      className={`text-[8px] px-1 rounded ${specScope === 'cycle' ? 'bg-emerald-500 text-ink-950 font-bold' : 'text-white/40'}`}
                      title="Filtrar por ciclos"
                    >
                      Ciclo
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpecScope('fix')}
                      className={`text-[8px] px-1 rounded ${specScope === 'fix' ? 'bg-emerald-500 text-ink-950 font-bold' : 'text-white/40'}`}
                      title="Filtrar por fixes"
                    >
                      Fix
                    </button>
                  </div>
                </div>
                <select
                  value={activeSpecId}
                  onChange={(e) => handleSelectSpec(e.target.value)}
                  className="w-full bg-ink-950 border border-white/15 rounded px-1.5 py-1 text-[10px] font-mono text-white focus:outline-none focus:border-emerald-500/50"
                >
                  {specsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id.replace('spec-e-burgos-', '')} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Requirement 9: Selector de Fix Gate */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[9px] font-mono text-white/50">
                  <span className="uppercase font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" /> Fix Gate
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFixFilter('bugfix')}
                      className={`text-[8px] px-1 rounded ${fixFilter === 'bugfix' ? 'bg-amber-500 text-ink-950 font-bold' : 'text-white/40'}`}
                      title="Filtrar BUGFIX"
                    >
                      Bug
                    </button>
                    <button
                      type="button"
                      onClick={() => setFixFilter('all')}
                      className={`text-[8px] px-1 rounded ${fixFilter === 'all' ? 'bg-amber-500 text-ink-950 font-bold' : 'text-white/40'}`}
                      title="Todos los fixes"
                    >
                      All
                    </button>
                  </div>
                </div>
                <select
                  value={activeFixId}
                  onChange={(e) => handleSelectFix(e.target.value)}
                  className="w-full bg-ink-950 border border-white/15 rounded px-1.5 py-1 text-[10px] font-mono text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">(Sin Fix - Ver Ciclo)</option>
                  {filteredFixes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.id} [{f.severity || 'fix'}]
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Subheader de estado de mensajes */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-white/5 shrink-0">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  mode === 'live'
                    ? displayedDialogues.length > 0
                      ? 'bg-rose-400 animate-ping'
                      : 'bg-emerald-400'
                    : 'bg-sky-400'
                }`}
              />
              <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                {mode === 'live'
                  ? `Comms del Enjambre (${displayedDialogues.length})`
                  : `Registro SDD & Gates (${displayedDialogues.length})`}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={scrollToBottom}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                title="Bajar al último mensaje"
              >
                ↓ Abajo
              </button>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                {mode === 'live' ? 'TIEMPO REAL' : 'DEMO'}
              </span>
            </div>
          </div>

          {/* Lista de mensajes scrolleable con orden cronológico (Requirement 1 & 2) */}
          <div
            ref={scrollContainerRef}
            data-testid="swarm-comms-scroll"
            className="flex-1 overflow-y-auto p-2.5 space-y-2 text-xs select-text scroll-smooth bg-ink-900/40 rounded-b-xl border border-white/5"
          >
            {displayedDialogues.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-4 text-center text-white/50 space-y-2">
                <Moon className="w-8 h-8 text-white/30" />
                <p className="text-xs font-sans leading-relaxed">
                  Sin eventos activos para esta conversación.
                </p>
                <p className="text-[10px] font-mono text-white/40">
                  Usa el selector de Spec Gate o Fix Gate para navegar por las conversaciones registradas.
                </p>
              </div>
            ) : (
              <>
                {displayedDialogues.length >= swarmLimit && (
                  <div className="flex justify-center pb-1">
                    <button
                      type="button"
                      onClick={() => setSwarmLimit((v) => v + 50)}
                      className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1 font-mono text-[10px] text-emerald-400 hover:text-emerald-300 transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <span>↑</span>
                      <span>Cargar mensajes anteriores (+50)</span>
                    </button>
                  </div>
                )}

                {/* Mensajes ordenados cronológicamente: el más nuevo queda abajo */}
                {displayedDialogues.map((item, idx) => {
                  const sMeta = agentMeta(item.from);
                  const rMeta = agentMeta(item.to);
                  const isCurrent = item.id === currentDialogue?.id;
                  const seq = item.seq ?? idx + 1;

                  return (
                    <ChatDialogueCard
                      key={`${item.id}-${idx}`}
                      id={item.id}
                      senderId={item.from}
                      senderName={sMeta.name}
                      senderColor={sMeta.color}
                      receiverId={item.to}
                      receiverName={rMeta.name}
                      receiverColor={rMeta.color}
                      text={item.text}
                      gateId={item.gateId}
                      badge={item.isLive ? 'LIVE' : undefined}
                      isLive={item.isLive}
                      isCurrent={isCurrent}
                      seqNumber={seq}
                      timestamp={item.timestamp}
                      provider={item.provider || currentProvider}
                      onClick={() => {
                        onSelectAgent?.(item.from);
                        onSelectDialogue?.(item);
                      }}
                    />
                  );
                })}

                {/* Elemento ancla para auto-scroll (Requirement 1) */}
                <div ref={messagesEndRef} data-testid="swarm-messages-end" className="h-1" />
              </>
            )}
          </div>
        </div>
      )}

      <DocumentViewerModal document={viewingDoc} onClose={() => setViewingDoc(null)} />
    </aside>
  );
}
