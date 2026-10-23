'use client';

import type { Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { AgentAvatar } from '../workspace/AgentAvatar';

interface AgentInspectorDrawerProps {
  agentId: string | null;
  presence?: Presence;
  onClose: () => void;
  onOpenDm: (agentId: string) => void;
}

export function AgentInspectorDrawer({
  agentId,
  presence,
  onClose,
  onOpenDm,
}: AgentInspectorDrawerProps) {
  if (!agentId) return null;
  const meta = agentMeta(agentId);
  const state = presence?.state ?? 'idle';

  return (
    <aside
      data-testid="agent-inspector-drawer"
      className="absolute top-4 right-4 bottom-4 w-88 rounded-2xl border border-white/15 bg-ink-950/95 p-5 shadow-2xl backdrop-blur-xl flex flex-col z-20 animate-in fade-in slide-in-from-right duration-300 select-none overflow-y-auto"
    >
      {/* Header with Close */}
      <div className="flex items-start justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <AgentAvatar agent={agentId} size={44} status={presence?.state === 'working' ? 'running' : null} />
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-base text-white">{meta.name}</h3>
              {meta.isLeader && (
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300 font-bold">
                  LEADER
                </span>
              )}
            </div>
            <p className="text-xs text-white/50 font-mono uppercase">{meta.role}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          title="Cerrar inspector"
        >
          ✕
        </button>
      </div>

      {/* Body Details */}
      <div className="py-4 space-y-4 flex-1">
        <div>
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-white/40 mb-1">
            Título & Especialidad
          </h4>
          <p className="text-sm font-medium text-white/90">{meta.title}</p>
        </div>

        <div>
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-white/40 mb-1">
            Personalidad & Enfoque
          </h4>
          <p className="text-xs leading-relaxed text-white/70 bg-white/5 p-3 rounded-xl border border-white/5">
            "{meta.personality}"
          </p>
        </div>

        <div>
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-white/40 mb-1.5">
            Estado de Misión
          </h4>
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                state === 'working'
                  ? 'bg-sky-400 animate-ping'
                  : state === 'waiting'
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
              }`}
            />
            <span className="text-xs font-mono font-medium text-white capitalize">
              {state === 'working' ? 'Ejecutando turno en vivo' : state === 'waiting' ? 'Esperando aprobación' : 'En espera (Ready)'}
            </span>
          </div>
        </div>

        {presence?.tool && (
          <div>
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-white/40 mb-1">
              Herramienta en Ejecución
            </h4>
            <div className="rounded-lg bg-sky-950/40 border border-sky-500/30 p-2.5 font-mono text-xs text-sky-200 break-all">
              ⚡ {presence.tool}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={() => {
            onOpenDm(agentId);
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-ink-950 py-2.5 px-4 font-semibold text-xs tracking-wide shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
        >
          <span>💬</span>
          <span>Abrir chat directo con {meta.name}</span>
        </button>
      </div>
    </aside>
  );
}
