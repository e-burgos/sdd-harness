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

  // Position bubble near the speaker
  const bubbleX = fromNodePos.x > 500 ? fromNodePos.x - 265 : fromNodePos.x + 35;
  const bubbleY = fromNodePos.y - 75;

  return (
    <g
      transform={`translate(${bubbleX}, ${bubbleY})`}
      className="transition-all duration-500 ease-out pointer-events-none select-none"
      data-testid="swarm-dialogue-bubble"
    >
      {/* Glow backdrop */}
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

      {/* Pointer Triangle to Agent */}
      <polygon
        points={fromNodePos.x > 500 ? '240,40 252,48 240,56' : '0,40 -12,48 0,56'}
        fill="rgba(9, 13, 22, 0.94)"
        stroke={fromMeta.color}
        strokeWidth="1.5"
      />

      {/* Speaker Mini Face */}
      <g transform="translate(10, 10)">
        <circle cx="16" cy="16" r="16" fill={`${fromMeta.color}20`} stroke={fromMeta.color} strokeWidth="1" />
        <AgentFace agent={dialogue.from} size={32} />
      </g>

      {/* Sender & Receiver Header */}
      <text x="48" y="22" fill="#ffffff" fontSize="11" fontWeight="bold">
        {fromMeta.name}
        <tspan fill="#38bdf8" fontSize="10" fontWeight="normal">
          {' '}
          ➔ {toMeta.name}
        </tspan>
      </text>

      <text x="48" y="34" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="var(--font-mono, monospace)">
        {fromMeta.role.toUpperCase()} ➔ {toMeta.role.toUpperCase()}
      </text>

      {/* Dialogue Message Text */}
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
}: {
  currentDialogue: SwarmDialogue;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  dialogueHistory: SwarmDialogue[];
}) {
  const [showLog, setShowLog] = useState(false);

  const fromMeta = agentMeta(currentDialogue.from);
  const toMeta = agentMeta(currentDialogue.to);

  return (
    <div className="absolute bottom-4 left-6 right-6 lg:right-96 z-20 flex flex-col items-center pointer-events-none select-none">
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-white/15 bg-ink-950/85 p-3.5 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-3 text-white">
        {/* Live Indicator & Speaker Info */}
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2 shrink-0">
            <span className={`h-2.5 w-2.5 rounded-full ${isPlaying ? 'bg-rose-500 animate-ping' : 'bg-amber-400'}`} />
            <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider text-rose-400">
              COMMS EN VIVO
            </span>
          </div>

          <div className="h-4 w-[1px] bg-white/10 shrink-0" />

          <div className="flex items-center gap-2 truncate text-xs">
            <span className="font-bold shrink-0" style={{ color: fromMeta.color }}>
              {fromMeta.name}
            </span>
            <span className="text-white/40 text-[10px]">➔</span>
            <span className="font-bold shrink-0" style={{ color: toMeta.color }}>
              {toMeta.name}
            </span>
            <span className="text-white/70 truncate text-[11px]">&ldquo;{currentDialogue.text}&rdquo;</span>
          </div>
        </div>

        {/* Controls */}
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
          <button
            type="button"
            onClick={() => setShowLog(!showLog)}
            className={`rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition-colors ${
              showLog ? 'bg-emerald-500 text-ink-950 font-bold' : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
            title="Ver registro completo"
          >
            📜 Registro
          </button>
        </div>
      </div>

      {/* Dialogue Log Modal/Flyout */}
      {showLog && (
        <div className="pointer-events-auto mt-2 w-full max-w-2xl rounded-2xl border border-white/15 bg-ink-950/95 p-4 shadow-2xl backdrop-blur-2xl max-h-60 overflow-y-auto space-y-2.5 animate-in fade-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Registro de Conversaciones del Enjambre
            </span>
            <button
              type="button"
              onClick={() => setShowLog(false)}
              className="text-xs text-white/50 hover:text-white"
            >
              ✕ Cerrar
            </button>
          </div>
          <div className="space-y-2">
            {dialogueHistory.map((item, idx) => {
              const sMeta = agentMeta(item.from);
              const rMeta = agentMeta(item.to);
              const isCurrent = item.id === currentDialogue.id;

              return (
                <div
                  key={item.id}
                  className={`rounded-xl p-2 text-xs font-sans border transition-all ${
                    isCurrent
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                      : 'border-white/5 bg-white/5 text-white/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 font-mono text-[10px]">
                    <span className="font-bold" style={{ color: sMeta.color }}>
                      {sMeta.name} ({sMeta.role}) ➔ {rMeta.name} ({rMeta.role})
                    </span>
                    <span className="text-white/40">Paso #{idx + 1}</span>
                  </div>
                  <p className="leading-snug">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
