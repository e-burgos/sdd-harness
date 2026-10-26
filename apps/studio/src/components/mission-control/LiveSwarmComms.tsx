'use client';

import React, { useState } from 'react';
import { agentMeta } from '@/lib/agents';
import { AgentFace } from '../workspace/AgentFace';
import type { SwarmDialogue } from './swarm-dialogue';

export function SwarmSpeechBubble({
  dialogue,
  fromNodePos,
}: {
  dialogue: SwarmDialogue;
  fromNodePos: { x: number; y: number };
}) {
  const fromMeta = agentMeta(dialogue.from);
  const toMeta = agentMeta(dialogue.to);

  const bubbleX = fromNodePos.x > 500 ? Math.max(20, fromNodePos.x - 265) : Math.min(740, fromNodePos.x + 35);
  const bubbleY = Math.max(15, Math.min(fromNodePos.y - 75, 750));

  return (
    <g
      transform={`translate(${bubbleX}, ${bubbleY})`}
      className="transition-all duration-500 ease-out pointer-events-none select-none"
      data-testid="swarm-dialogue-bubble"
    >
      <rect
        x="0"
        y="0"
        width="240"
        height="90"
        rx="14"
        fill="rgba(9, 13, 22, 0.94)"
        stroke={fromMeta.color}
        strokeWidth="1.5"
        strokeOpacity="0.8"
        filter="drop-shadow(0 8px 24px rgba(0,0,0,0.85))"
      />

      <polygon
        points={fromNodePos.x > 500 ? '240,40 252,48 240,56' : '0,40 -12,48 0,56'}
        fill="rgba(9, 13, 22, 0.94)"
        stroke={fromMeta.color}
        strokeWidth="1.5"
      />

      <g transform="translate(10, 10)">
        <circle cx="16" cy="16" r="16" fill={`${fromMeta.color}20`} stroke={fromMeta.color} strokeWidth="1" />
        <AgentFace agent={dialogue.from} size={32} />
      </g>

      <text x="48" y="22" fill="#ffffff" fontSize="11" fontWeight="bold">
        {fromMeta.name}
        <tspan fill="#38bdf8" fontSize="10" fontWeight="normal">
          {' '}
          ➔ {toMeta.name}
        </tspan>
        {dialogue.gateId && (
          <tspan fill="#eab308" fontSize="9" fontWeight="bold">
            {' '}
            [{dialogue.gateId.toUpperCase()}]
          </tspan>
        )}
        {dialogue.isLive && (
          <tspan fill="#f43f5e" fontSize="9" fontWeight="bold">
            {' '}
            [EN VIVO]
          </tspan>
        )}
      </text>

      <text x="48" y="34" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="var(--font-mono, monospace)">
        {fromMeta.role.toUpperCase()} ➔ {toMeta.role.toUpperCase()}
      </text>

      <foreignObject x="10" y="42" width="220" height="42">
        <div className="text-[10px] text-white/90 leading-tight font-sans line-clamp-2 select-none">
          &ldquo;{dialogue.text}&rdquo;
        </div>
      </foreignObject>
    </g>
  );
}

export function SwarmCommsConsole({
  currentDialogue,
  isPlaying,
  onTogglePlay,
  onNext,
  dialogueHistory,
  mode,
  onToggleMode,
  liveCount,
  activePresenceCount = 0,
  isPanelCollapsed = false,
}: {
  currentDialogue: SwarmDialogue | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  dialogueHistory: SwarmDialogue[];
  mode: 'live' | 'demo';
  onToggleMode: () => void;
  liveCount: number;
  activePresenceCount?: number;
  isPanelCollapsed?: boolean;
}) {
  const fromMeta = currentDialogue ? agentMeta(currentDialogue.from) : null;
  const toMeta = currentDialogue ? agentMeta(currentDialogue.to) : null;
  const isActuallyLive = mode === 'live' && activePresenceCount > 0;

  return (
    <div
      data-testid="swarm-comms-console"
      className={`absolute bottom-4 left-6 right-6 ${
        isPanelCollapsed ? 'lg:right-6' : 'lg:right-[420px]'
      } z-20 flex flex-col items-center pointer-events-none select-none transition-all duration-300`}
    >
      <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-white/15 bg-ink-950/85 p-3.5 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                mode === 'demo'
                  ? 'bg-sky-400'
                  : isActuallyLive
                    ? 'bg-rose-500 animate-ping'
                    : 'bg-emerald-400'
              }`}
            />
            <span
              className={`font-mono text-[10px] font-extrabold uppercase tracking-wider ${
                mode === 'demo'
                  ? 'text-sky-400'
                  : isActuallyLive
                    ? 'text-rose-400'
                    : 'text-emerald-400'
              }`}
            >
              {mode === 'demo'
                ? 'DEMO GATES SDD'
                : isActuallyLive
                  ? 'COMMS EN VIVO'
                  : 'SISTEMA EN ESPERA'}
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleMode}
            className={`flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-1 transition-all ${
              mode === 'live'
                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30'
                : 'bg-sky-500/20 border border-sky-500/40 text-sky-300 hover:bg-sky-500/30'
            }`}
            title="Alternar entre modo En Vivo y Demostración de Flujo SDD"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                mode === 'live'
                  ? isActuallyLive
                    ? 'bg-rose-400 animate-ping'
                    : 'bg-emerald-400'
                  : 'bg-sky-400'
              }`}
            />
            <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider">
              {mode === 'live' ? `TIEMPO REAL (${liveCount})` : 'DEMO SDD'}
            </span>
          </button>

          <div className="h-4 w-[1px] bg-white/10 shrink-0" />

          {!currentDialogue || (mode === 'live' && liveCount === 0) ? (
            <span className="text-white/60 text-xs italic truncate">
              Sin agentes en ejecución activa · En espera de tareas
            </span>
          ) : (
            fromMeta && toMeta && (
              <div className="flex items-center gap-2 truncate text-xs">
                {currentDialogue.gateId && (
                  <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold shrink-0">
                    {currentDialogue.gateId}
                  </span>
                )}
                <span className="font-bold shrink-0" style={{ color: fromMeta.color }}>
                  {fromMeta.name}
                </span>
                <span className="text-white/40 text-[10px]">➔</span>
                <span className="font-bold shrink-0" style={{ color: toMeta.color }}>
                  {toMeta.name}
                </span>
                <span className="text-white/70 truncate text-[11px]">&ldquo;{currentDialogue.text}&rdquo;</span>
              </div>
            )
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onTogglePlay}
            className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-mono font-medium hover:bg-white/20 transition-colors"
            title={isPlaying ? 'Pausar diálogo' : 'Reanudar diálogo'}
          >
            {isPlaying ? '⏸ Pausa' : '▶ Play'}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-mono font-medium hover:bg-white/20 transition-colors"
            title="Siguiente mensaje"
          >
            ⏭ Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
