'use client';

import { Button, Tooltip } from '@e-burgos/tucu-ui';
import React, { useState } from 'react';
import { X, Check, ArrowRight } from 'lucide-react';
import { getGateMeta, type GateId } from '@/lib/gates';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { AgentAvatar } from '../workspace/AgentAvatar';
import { GateIcon } from './GateIcon';

interface GateInspectorDrawerProps {
  gateId: GateId | null;
  onClose: () => void;
  onSelectAgent: (agentId: string) => void;
}

export function GateInspectorDrawer({
  gateId,
  onClose,
  onSelectAgent,
}: GateInspectorDrawerProps) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  if (!gateId) return null;
  const gate = getGateMeta(gateId);
  const respAgent = agentMeta(gate.responsibleAgent);

  const handleCopyCli = () => {
    navigator.clipboard.writeText(gate.cliCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside
      data-testid="gate-inspector-drawer"
      className="absolute top-4 left-4 bottom-4 w-96 lg:w-[400px] rounded-2xl border border-foreground/15 bg-ink-950/95 p-4 shadow-2xl backdrop-blur-xl flex flex-col z-20 animate-in fade-in slide-in-from-left duration-300 select-none overflow-y-auto"
    >
      <div className="flex items-start justify-between pb-3 border-b border-foreground/10 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: `${gate.color}20`,
              borderColor: `${gate.color}50`,
              color: gate.color,
            }}
          >
            <GateIcon gateId={gate.id} className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-ink-100" style={{ color: gate.color }}>
                {gate.name}
              </h3>
              <span className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-micro text-ink-300">
                {gate.group === 'cycle' ? t('ui.gate.group.cycle') : t('ui.gate.group.transversal')}
              </span>
            </div>
            <p className="text-xs text-ink-300 font-sans mt-0.5">{gate.subtitle}</p>
          </div>
        </div>
        <Tooltip size="xs" arrow={false} content={t('ui.gate.close')}>
          <Button type="button" variant="transparent" color="gray" shape="circle" size="tiny" onClick={onClose} aria-label={t('ui.gate.close')}>
            <X className="w-4 h-4" />
          </Button>
        </Tooltip>
      </div>

      <div className="py-3 space-y-4 flex-1">
        <div>
          <h4 className="text-micro font-mono uppercase tracking-wider text-ink-500 mb-1">
            {t('ui.gate.purpose')}
          </h4>
          <p className="text-xs leading-relaxed text-ink-100 bg-foreground/5 p-3 rounded-xl border border-foreground/5">
            {gate.description}
          </p>
        </div>

        <div>
          <h4 className="text-micro font-mono uppercase tracking-wider text-ink-500 mb-2">
            {t('ui.gate.responsible')}
          </h4>
          <div
            onClick={() => onSelectAgent(gate.responsibleAgent)}
            className="flex items-center justify-between p-2.5 rounded-xl border border-foreground/10 bg-foreground/5 hover:bg-foreground/10 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <AgentAvatar agent={gate.responsibleAgent} size={32} />
              <div>
                <p className="text-xs font-bold text-ink-100" style={{ color: respAgent.color }}>
                  {respAgent.name}
                </p>
                <p className="text-micro text-ink-500 font-mono uppercase">{respAgent.role}</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-micro font-mono text-emerald-400">
              {t('ui.gate.viewOnMap')} <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        <div>
          <h4 className="text-micro font-mono uppercase tracking-wider text-ink-500 mb-2">
            {t('ui.gate.involved')}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {gate.associatedAgents.map((aid) => {
              const a = agentMeta(aid);
              return (
                <button
                  key={aid}
                  type="button"
                  onClick={() => onSelectAgent(aid)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-foreground/10 bg-ink-900 hover:bg-foreground/10 transition-colors text-meta font-mono"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="text-ink-100">{a.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-micro font-mono uppercase tracking-wider text-ink-500 mb-2">
            {t('ui.gate.rules')}
          </h4>
          <ul className="space-y-1.5">
            {gate.rules.map((rule, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-ink-100 bg-ink-900/60 p-2 rounded-lg border border-foreground/5"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-micro font-mono uppercase tracking-wider text-ink-500 mb-1.5">
            {t('ui.gate.cli')}
          </h4>
          <div className="flex items-center justify-between p-2.5 rounded-xl border border-foreground/10 bg-ink-950 font-mono text-xs text-emerald-300">
            <span className="truncate mr-2">{gate.cliCommand}</span>
            <Button type="button" variant="transparent" color="gray" size="tiny" onClick={handleCopyCli}>
              {copied ? t('ui.copied') : t('ui.copy')}
            </Button>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-foreground/10 shrink-0">
        <Button type="button" variant="solid" color="gray" size="mini" fullWidth className="font-mono" onClick={onClose}>
          {t('ui.gate.closeSheet')}
        </Button>
      </div>
    </aside>
  );
}
