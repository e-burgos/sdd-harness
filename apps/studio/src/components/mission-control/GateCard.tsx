'use client';

import React from 'react';
import type { GateMeta, GateStatus } from '@/lib/gates';
import { agentMeta } from '@/lib/agents';

interface GateCardProps {
  gate: GateMeta;
  status?: GateStatus;
  isSelected?: boolean;
  isActive?: boolean;
  onSelect: (gateId: string) => void;
  width?: number;
  height?: number;
}

export function GateCard({
  gate,
  status = 'passing',
  isSelected = false,
  isActive = false,
  onSelect,
  width = 165,
  height = 122,
}: GateCardProps) {
  const respMeta = agentMeta(gate.responsibleAgent);

  const statusBg =
    status === 'passing'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : status === 'active'
        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
        : status === 'blocked'
          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
          : 'bg-white/5 text-white/50 border-white/10';

  const statusDot =
    status === 'passing'
      ? 'bg-emerald-400'
      : status === 'active'
        ? 'bg-sky-400 animate-ping'
        : status === 'blocked'
          ? 'bg-rose-400 animate-pulse'
          : 'bg-white/30';

  return (
    <div
      data-testid={`gate-card-${gate.id}`}
      onClick={() => onSelect(gate.id)}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderColor: isActive ? gate.color : undefined,
        boxShadow: isActive ? `0 0 24px ${gate.color}60` : undefined,
      }}
      className={`group relative flex flex-col justify-between rounded-xl border p-2.5 transition-all duration-200 cursor-pointer select-none backdrop-blur-md ${
        isSelected
          ? 'bg-ink-900/95 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)] scale-[1.02]'
          : isActive
            ? 'bg-ink-900/95 animate-pulse scale-[1.02]'
            : 'bg-ink-950/80 border-white/15 hover:border-white/30 hover:bg-ink-900/90 hover:shadow-lg'
      }`}
    >
      <div
        className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${gate.color}20, transparent 70%)`,
        }}
      />

      <div className="flex items-start justify-between gap-1 z-10">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base select-none shrink-0" role="img" aria-label={gate.name}>
            {gate.icon}
          </span>
          <div className="min-w-0">
            <h4
              className="text-xs font-mono font-bold tracking-tight truncate leading-tight"
              style={{ color: gate.color }}
            >
              {gate.shortLabel}
            </h4>
            <p className="text-[9px] font-sans text-white/50 truncate leading-none mt-0.5">
              {gate.subtitle}
            </p>
          </div>
        </div>

        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-mono shrink-0 ${statusBg}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
          <span className="uppercase text-[8px] font-bold">
            {status === 'passing' ? 'OK' : status === 'active' ? 'RUN' : status === 'blocked' ? 'STOP' : 'IDLE'}
          </span>
        </div>
      </div>

      <div className="z-10 my-1">
        <p className="text-[10px] text-white/70 line-clamp-2 leading-snug font-sans">
          {gate.description}
        </p>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-white/10 z-10 text-[9px] font-mono text-white/40">
        <div className="flex items-center gap-1 truncate">
          <span className="text-white/30 text-[8px]">RESP:</span>
          <span className="font-semibold truncate" style={{ color: respMeta.color }}>
            {respMeta.name}
          </span>
        </div>
        <span className="text-[8px] text-emerald-400/80 group-hover:text-emerald-300 transition-colors">
          Info ➔
        </span>
      </div>
    </div>
  );
}
