'use client';

import { Badge, Button, Tooltip, useTheme } from '@e-burgos/tucu-ui';
import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { deriveConversationGate, gateLabel, type ConversationGate } from '@/lib/conversation-gate';
import { useT } from '@/lib/i18n/i18n';
import { useSelectedConversation } from '@/lib/use-selected-conversation';
import { useStudio } from './BridgeProvider';
import { GateStatusModal } from './GateStatusModal';
import { AgentAvatar } from './workspace/AgentAvatar';

export function StudioHeader() {
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
  const gateMode = snapshot?.tools?.gate ?? snapshot?.gateMode ?? null;
  const [statusOpen, setStatusOpen] = useState(false);
  const thread = useStudio((s) => (selectedThreadId ? (s.threads[selectedThreadId]?.info ?? null) : null));

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-foreground/10 bg-ink-950/90 px-4 backdrop-blur-md z-30 select-none">
      {/* Brand & Active Project */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <AgentAvatar agent="sdd-orchestrator" size={24} showBadge={false} />
          <span className="font-semibold text-sm tracking-tight text-ink-100 flex items-center gap-1.5">
            SDD Studio
            <Badge variant="soft" size="micro" shape="pill" tone="success" className="gap-1.5 px-2 py-0.5 font-mono text-micro">v0.16</Badge>
          </span>
        </div>
        {snapshot?.project && (
          <span className="hidden sm:inline-flex items-center text-xs text-ink-500 border-l border-foreground/10 pl-3 font-mono truncate max-w-[200px]">
            {snapshot.project}
          </span>
        )}
      </div>

      {/* Right Telemetry Pills & Language */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          data-testid="gate-chip"
          data-gate={gate.kind}
          data-gate-mode={gateMode ?? undefined}
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
          {gateMode && (
            <span data-testid="gate-mode" className={`shrink-0 rounded-full px-1.5 text-micro uppercase ${gateMode === 'warn' ? 'bg-amber-500/20 text-amber-300' : 'bg-foreground/10 text-ink-400'}`}>
              {t(gateMode === 'warn' ? 'module.kit.tools.warn' : 'module.kit.tools.block')}
            </span>
          )}
        </button>

        {/* Working Swarm Presence Counter */}
        <Tooltip size="xs" arrow={false} content={t('ui.header.activeHint', { n: workingAgents.length })}>
          <Badge variant="soft" size="micro" shape="pill" tone={workingAgents.length > 0 ? 'info' : 'neutral'} data-testid="presence-pill" className={`gap-1.5 px-2.5 py-1 font-mono text-meta ${workingAgents.length > 0 ? 'animate-pulse' : ''}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${workingAgents.length > 0 ? 'bg-sky-400' : 'bg-emerald-400'}`} />
            <span>{workingAgents.length > 0 ? t('ui.header.activeCount', { n: workingAgents.length }) : t('ui.header.ready')}</span>
          </Badge>
        </Tooltip>

        {/* Language Toggle */}
        <Tooltip size="xs" arrow={false} content={t('ui.header.langToggle')}>
          <Button type="button" onClick={() => setLang(lang === 'es' ? 'en' : 'es')} variant="transparent" color="gray" size="tiny" className="font-mono uppercase">
            {lang}
          </Button>
        </Tooltip>

        <Tooltip size="xs" arrow={false} content={mode === 'dark' ? t('mode.toLight') : t('mode.toDark')}>
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
        </Tooltip>
      </div>
      <GateStatusModal open={statusOpen} onClose={() => setStatusOpen(false)} thread={thread} view={view} gate={gate} snapshot={snapshot} />
    </header>
  );
}
