'use client';

import type { Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { AgentFace } from '../workspace/AgentFace';

interface AgentNodeProps {
  agentId: string;
  x: number;
  y: number;
  presence?: Presence;
  isSelected?: boolean;
  participating?: boolean;
  onSelect: (agentId: string) => void;
}

export function AgentNode({ agentId, x, y, presence, isSelected, participating = true, onSelect }: AgentNodeProps) {
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
      opacity={participating ? 1 : 0.35}
      data-participating={participating}
    >
      {participating && (isWorking || isSelected) && (
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
      <circle
        r="36"
        fill="#090d16"
        stroke={isSelected ? '#ffffff' : statusColor}
        strokeWidth={isSelected ? '3' : '2'}
        className="transition-all duration-300 group-hover:scale-105"
        filter="drop-shadow(0px 4px 12px rgba(0,0,0,0.7))"
      />
      <circle
        r="30"
        fill={`${meta.color}18`}
        stroke={meta.color}
        strokeWidth="1"
        strokeDasharray={isWorking ? '4 2' : undefined}
        className={isWorking ? 'animate-spin' : ''}
        style={{ transformOrigin: '0 0' }}
      />
      <g transform="translate(-24, -24)" className="pointer-events-none drop-shadow">
        <AgentFace agent={agentId} size={48} />
      </g>
      {meta.isLeader && (
        <g transform="translate(-8, -50)" className="pointer-events-none drop-shadow" data-testid="agent-node-crown">
          <path
            d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"
            fill="#facc15"
            stroke="#eab308"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="scale(0.68)"
          />
        </g>
      )}
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
          strokeOpacity="0.6"
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
      <g transform="translate(0, 75)">
        <rect
          x="-55"
          y="-8"
          width="110"
          height="16"
          rx="8"
          fill="#1e293b"
          stroke="#475569"
          strokeWidth="0.8"
        />
        <text
          textAnchor="middle"
          dy="0.32em"
          fill="#38bdf8"
          fontSize="9"
          fontFamily="var(--font-mono, monospace)"
          fontWeight="bold"
          className="pointer-events-none tracking-tight uppercase"
        >
          {meta.role}
        </text>
      </g>
      {presence?.tool && (
        <g transform="translate(0, 98)">
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
          <g transform="translate(-52, -5.5) scale(0.48)">
            <path
              d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"
              fill="#facc15"
              stroke="#facc15"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <text
            textAnchor="middle"
            x="4"
            dy="0.32em"
            fill="#ffffff"
            fontSize="9"
            fontFamily="var(--font-mono, monospace)"
            fontWeight="bold"
            className="pointer-events-none truncate"
          >
            {presence.tool.length > 18 ? `${presence.tool.slice(0, 16)}…` : presence.tool}
          </text>
        </g>
      )}
    </g>
  );
}
