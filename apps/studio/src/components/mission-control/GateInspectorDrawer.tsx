'use client';

import React, { useState } from 'react';
import { getGateMeta, type GateId } from '@/lib/gates';
import { agentMeta } from '@/lib/agents';
import { AgentAvatar } from '../workspace/AgentAvatar';

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
      className="absolute top-4 left-4 bottom-4 w-96 lg:w-[400px] rounded-2xl border border-white/15 bg-ink-950/95 p-4 shadow-2xl backdrop-blur-xl flex flex-col z-20 animate-in fade-in slide-in-from-left duration-300 select-none overflow-y-auto"
    >
      <div className="flex items-start justify-between pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center text-xl shrink-0 border"
            style={{
              backgroundColor: `${gate.color}20`,
              borderColor: `${gate.color}50`,
            }}
          >
            {gate.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-white" style={{ color: gate.color }}>
                {gate.name}
              </h3>
              <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white/70">
                {gate.group === 'cycle' ? 'CICLO SDD' : 'TRANSVERSAL'}
              </span>
            </div>
            <p className="text-xs text-white/60 font-sans mt-0.5">{gate.subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors text-xs"
          title="Cerrar inspector de gate"
        >
          ✕
        </button>
      </div>

      <div className="py-3 space-y-4 flex-1">
        <div>
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">
            Propósito del Gate
          </h4>
          <p className="text-xs leading-relaxed text-white/85 bg-white/5 p-3 rounded-xl border border-white/5">
            {gate.description}
          </p>
        </div>

        <div>
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">
            Agente Responsable
          </h4>
          <div
            onClick={() => onSelectAgent(gate.responsibleAgent)}
            className="flex items-center justify-between p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <AgentAvatar agent={gate.responsibleAgent} size={32} />
              <div>
                <p className="text-xs font-bold text-white" style={{ color: respAgent.color }}>
                  {respAgent.name}
                </p>
                <p className="text-[10px] text-white/40 font-mono uppercase">{respAgent.role}</p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">Ver en mapa ➔</span>
          </div>
        </div>

        <div>
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">
            Agentes Involucrados
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {gate.associatedAgents.map((aid) => {
              const a = agentMeta(aid);
              return (
                <button
                  key={aid}
                  type="button"
                  onClick={() => onSelectAgent(aid)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-ink-900 hover:bg-white/10 transition-colors text-[11px] font-mono"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="text-white/80">{a.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">
            Reglas & Checklist Canónica
          </h4>
          <ul className="space-y-1.5">
            {gate.rules.map((rule, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-white/75 bg-ink-900/60 p-2 rounded-lg border border-white/5"
              >
                <span className="text-emerald-400 text-xs shrink-0 mt-0.5">✔</span>
                <span className="leading-snug">{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1.5">
            Comando de Verificación CLI
          </h4>
          <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/10 bg-black/60 font-mono text-xs text-emerald-300">
            <span className="truncate mr-2">{gate.cliCommand}</span>
            <button
              type="button"
              onClick={handleCopyCli}
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white shrink-0 transition-colors"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-white/10 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-full flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 text-white py-2 text-xs font-mono font-medium transition-colors"
        >
          Cerrar Ficha Técnica
        </button>
      </div>
    </aside>
  );
}
