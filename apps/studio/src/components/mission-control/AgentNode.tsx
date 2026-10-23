'use client';

import type { Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';

interface AgentNodeProps {
  agentId: string;
  x: number;
  y: number;
  presence?: Presence;
  isSelected?: boolean;
  onSelect: (agentId: string) => void;
}

export function AgentNode({ agentId, x, y, presence, isSelected, onSelect }: AgentNodeProps) {
  const meta = agentMeta(agentId);
  const state = presence?.state ?? 'idle';
  const isWorking = state === 'working';
  const isWaiting = state === 'waiting';

  const statusColor = isWorking
    ? '#38bdf8'
    : isWaiting
      ? '#fbbf24'
      : meta.color;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={() => onSelect(agentId)}
      className="cursor-pointer group select-none"
    >
      {/* Outer ambient glow when active or selected */}
      {(isWorking || isSelected) && (
        <circle
          r="48"
          fill="none"
          stroke={meta.color}
          strokeWidth="2"
          opacity={isWorking ? '0.7' : '0.4'}
          className={isWorking ? 'animate-ping' : ''}
          style={{ transformOrigin: '0 0' }}
        />
      )}

      {/* Hexagonal / Circular Node Body */}
      <circle
        r="36"
        fill="#090d16"
        stroke={isSelected ? '#ffffff' : statusColor}
        strokeWidth={isSelected ? '3' : '2'}
        className="transition-all duration-300 group-hover:scale-105"
        filter="drop-shadow(0px 4px 12px rgba(0,0,0,0.7))"
      />

      {/* Gradient Inner Ring */}
      <circle
        r="30"
        fill={`${meta.color}18`}
        stroke={meta.color}
        strokeWidth="1"
        strokeDasharray={isWorking ? '4 2' : undefined}
        className={isWorking ? 'animate-spin' : ''}
        style={{ transformOrigin: '0 0' }}
      />

      {/* Avatar Initials / Symbol */}
      <text
        textAnchor="middle"
        dy="0.35em"
        fill="#ffffff"
        fontFamily="var(--font-mono, monospace)"
        fontWeight="bold"
        fontSize="15"
        className="pointer-events-none drop-shadow"
      >
        {meta.short}
      </text>

      {/* Crown indicator for Clara */}
      {meta.isLeader && (
        <text textAnchor="middle" y="-38" fontSize="18" className="pointer-events-none drop-shadow">
          👑
        </text>
      )}

      {/* Codename Pill Badge Below */}
      <g transform="translate(0, 52)">
        <rect
          x="-50"
          y="-12"
          width="100"
          height="22"
          rx="11"
          fill="#0e1526"
          stroke={meta.color}
          strokeWidth="1"
          strokeOpacity="0.4"
        />
        <text
          textAnchor="middle"
          dy="0.32em"
          fill="#ffffff"
          fontSize="11"
          fontWeight="600"
          className="pointer-events-none tracking-wide"
        >
          {meta.name}
        </text>
      </g>

      {/* Role description below badge */}
      <text
        y="78"
        textAnchor="middle"
        fill="#94a3b8"
        fontSize="9.5"
        fontFamily="var(--font-mono, monospace)"
        className="pointer-events-none tracking-tight uppercase"
      >
        {meta.role}
      </text>

      {/* Active tool indicator tag if present */}
      {presence?.tool && (
        <g transform="translate(0, 94)">
          <rect
            x="-65"
            y="-9"
            width="130"
            height="18"
            rx="9"
            fill="#0369a1"
            stroke="#38bdf8"
            strokeWidth="1"
          />
          <text
            textAnchor="middle"
            dy="0.32em"
            fill="#ffffff"
            fontSize="9"
            fontFamily="var(--font-mono, monospace)"
            fontWeight="bold"
            className="pointer-events-none truncate"
          >
            ⚡ {presence.tool.length > 18 ? `${presence.tool.slice(0, 16)}…` : presence.tool}
          </text>
        </g>
      )}
    </g>
  );
}
