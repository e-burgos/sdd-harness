'use client';

import { Button, useTheme } from '@e-burgos/tucu-ui';
import React, { useState } from 'react';
import { MessageSquare, Network, Globe, Activity, Sun, Moon } from 'lucide-react';
import { deriveConversationGate, gateLabel, type ConversationGate } from '@/lib/conversation-gate';
import { useT } from '@/lib/i18n/i18n';
import { useSelectedConversation } from '@/lib/use-selected-conversation';
import type { StudioView } from '@/lib/use-studio-view';
import { useStudio } from './BridgeProvider';
import { GateStatusModal } from './GateStatusModal';
import { SegmentedControl } from './SegmentedControl';
import { AgentAvatar } from './workspace/AgentAvatar';

interface StudioHeaderProps {
  activeView: StudioView;
  onSelectView: (view: StudioView) => void;
}

export function StudioHeader({ activeView, onSelectView }: StudioHeaderProps) {
  const { t, lang, setLang } = useT();
  const mode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);
  const snapshot = useStudio((s) => s.snapshot);
  const presence = useStudio((s) => s.presence ?? []);

  const workingAgents = (presence ?? []).filter((p) => p.state === 'working');
  const activeCycle = snapshot?.cycles?.find((c) => c.status === 'in-progress');
  const { view, selectedThreadId } = useSelectedConversation();
  const gate: ConversationGate = view
    ? deriveConversationGate(view, snapshot)
    : activeCycle
      ? { kind: 'spec', specId: activeCycle.specId, cycle: activeCycle.cycle }
      : { kind: 'idle' };
  const label = gateLabel(gate, t);
  const [statusOpen, setStatusOpen] = useState(false);
  const thread = useStudio((s) => (selectedThreadId ? (s.threads[selectedThreadId]?.info ?? null) : null));

  const views: { id: StudioView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'workspace', label: t('view.workspace'), icon: MessageSquare },
    { id: 'agent-map', label: t('view.agentMap'), icon: Network },
    { id: 'ecosystem', label: t('view.ecosystem'), icon: Globe },
    { id: 'telemetry', label: t('view.telemetry'), icon: Activity },
  ];

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-foreground/10 bg-ink-950/90 px-4 backdrop-blur-md z-30 select-none">
      {/* Brand & Active Project */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <AgentAvatar agent="sdd-orchestrator" size={24} showBadge={false} />
          <span className="font-semibold text-sm tracking-tight text-ink-100 flex items-center gap-1.5">
            SDD Studio
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-micro font-medium text-emerald-400 border border-emerald-500/20">
              v0.16
            </span>
          </span>
        </div>
        {snapshot?.project && (
          <span className="hidden sm:inline-flex items-center text-xs text-ink-500 border-l border-foreground/10 pl-3 font-mono truncate max-w-[200px]">
            {snapshot.project}
          </span>
        )}
      </div>

      {/* Main View Switcher Segmented Control */}
      <SegmentedControl
        semantics="nav"
        emphasis="neutral"
        ariaLabel={t('segment.views')}
        value={activeView}
        onChange={onSelectView}
        options={views.map((v) => ({
          id: v.id,
          label: v.label,
          ariaLabel: v.label,
          icon: <v.icon className="h-3.5 w-3.5 shrink-0" />,
          labelClassName: 'hidden md:inline',
        }))}
      />

      {/* Right Telemetry Pills & Language */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          data-testid="gate-chip"
          data-gate={gate.kind}
          title={label}
          aria-label={t('gate.modal.open')}
          aria-haspopup="dialog"
          onClick={() => setStatusOpen(true)}
          className={`hidden max-w-[320px] items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-meta transition-colors lg:flex ${
            gate.kind === 'fix'
              ? 'border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              : gate.kind === 'spec'
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                : 'border-foreground/10 bg-foreground/5 text-ink-500 hover:bg-foreground/10'
          }`}
        >
          {gate.kind !== 'idle' && <span className="h-1.5 w-1.5 shrink-0 animate-ping rounded-full bg-current" />}
          <span className="truncate">{label}</span>
        </button>

        {/* Working Swarm Presence Counter */}
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-meta font-mono border ${
            workingAgents.length > 0
              ? 'bg-sky-500/10 text-sky-300 border-sky-500/25 animate-pulse'
              : 'bg-foreground/5 text-ink-300 border-foreground/10'
          }`}
          title={`${workingAgents.length} agentes ejecutando tareas actualmente`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${workingAgents.length > 0 ? 'bg-sky-400' : 'bg-emerald-400'}`} />
          <span>{workingAgents.length > 0 ? `${workingAgents.length} activos` : 'Equipo listo'}</span>
        </div>

        {/* Language Toggle */}
        <Button
          type="button"
          onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
          variant="transparent"
          color="gray"
          size="tiny"
          className="font-mono uppercase"
          title="Cambiar idioma / Toggle language"
        >
          {lang}
        </Button>

        <Button
          type="button"
          data-testid="mode-toggle"
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          variant="transparent"
          color="gray"
          size="tiny"
          shape="circle"
          aria-label={mode === 'dark' ? t('mode.toLight') : t('mode.toDark')}
        >
          {mode === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <GateStatusModal open={statusOpen} onClose={() => setStatusOpen(false)} thread={thread} view={view} gate={gate} snapshot={snapshot} />
    </header>
  );
}
