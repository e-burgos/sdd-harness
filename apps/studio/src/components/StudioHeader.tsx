'use client';

import React from 'react';
import { MessageSquare, Network, Globe, Activity } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import type { StudioView } from '@/lib/use-studio-view';
import { useStudio } from './BridgeProvider';
import { AgentAvatar } from './workspace/AgentAvatar';

interface StudioHeaderProps {
  activeView: StudioView;
  onSelectView: (view: StudioView) => void;
}

export function StudioHeader({ activeView, onSelectView }: StudioHeaderProps) {
  const { t, lang, setLang } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const presence = useStudio((s) => s.presence ?? []);

  const workingAgents = (presence ?? []).filter((p) => p.state === 'working');
  const activeCycle = snapshot?.cycles?.find((c) => c.status === 'in-progress');

  const views: { id: StudioView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'workspace', label: t('view.workspace'), icon: MessageSquare },
    { id: 'agent-map', label: t('view.agentMap'), icon: Network },
    { id: 'ecosystem', label: t('view.ecosystem'), icon: Globe },
    { id: 'telemetry', label: t('view.telemetry'), icon: Activity },
  ];

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-ink-950/90 px-4 backdrop-blur-md z-30 select-none">
      {/* Brand & Active Project */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <AgentAvatar agent="sdd-orchestrator" size={24} showBadge={false} />
          <span className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
            SDD Studio
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
              v0.16
            </span>
          </span>
        </div>
        {snapshot?.project && (
          <span className="hidden sm:inline-flex items-center text-xs text-white/50 border-l border-white/10 pl-3 font-mono truncate max-w-[200px]">
            {snapshot.project}
          </span>
        )}
      </div>

      {/* Main View Switcher Segmented Control */}
      <nav className="flex items-center rounded-xl bg-ink-900/80 p-1 border border-white/10 shadow-inner">
        {views.map((v) => {
          const isActive = activeView === v.id;
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelectView(v.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-ink-800 text-white shadow-sm border border-white/15'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">{v.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Telemetry Pills & Language */}
      <div className="flex items-center gap-2.5">
        {/* Active Cycle Status Pill */}
        {activeCycle ? (
          <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-mono text-emerald-300 border border-emerald-500/25">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>
              {activeCycle.specId.slice(0, 16)}… ({activeCycle.cycle})
            </span>
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-mono text-white/40 border border-white/10">
            <span>SPEC GATE IDLE</span>
          </div>
        )}

        {/* Working Swarm Presence Counter */}
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-mono border ${
            workingAgents.length > 0
              ? 'bg-sky-500/10 text-sky-300 border-sky-500/25 animate-pulse'
              : 'bg-white/5 text-white/60 border-white/10'
          }`}
          title={`${workingAgents.length} agentes ejecutando tareas actualmente`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${workingAgents.length > 0 ? 'bg-sky-400' : 'bg-emerald-400'}`} />
          <span>{workingAgents.length > 0 ? `${workingAgents.length} activos` : 'Equipo listo'}</span>
        </div>

        {/* Language Toggle */}
        <button
          type="button"
          onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors uppercase"
          title="Cambiar idioma / Toggle language"
        >
          {lang}
        </button>
      </div>
    </header>
  );
}
