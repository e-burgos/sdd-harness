'use client';

import { Blocks, Code, Compass, Lightbulb, ListChecks, ListTodo, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useRef, type CSSProperties } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { useElementSize } from '../use-element-size';

type AgentId = 'orchestrator' | 'functional' | 'planner' | 'architect' | 'implementor' | 'reviewer';

const AGENTS: ReadonlyArray<{ id: AgentId; icon: LucideIcon }> = [
  { id: 'orchestrator', icon: Compass },
  { id: 'functional', icon: ListChecks },
  { id: 'planner', icon: ListTodo },
  { id: 'architect', icon: Blocks },
  { id: 'implementor', icon: Code },
  { id: 'reviewer', icon: ShieldCheck },
];

const RADIUS_X = 33;
const RADIUS_Y = 38;

function orbitPoint(index: number): { x: number; y: number } {
  const angle = ((index / AGENTS.length) * 360 - 90) * (Math.PI / 180);
  return { x: 50 + RADIUS_X * Math.cos(angle), y: 50 + RADIUS_Y * Math.sin(angle) };
}

function OrbitLinks({ width, height }: { width: number; height: number }) {
  if (width === 0 || height === 0) return null;
  const cx = width / 2;
  const cy = height / 2;
  return (
    <svg aria-hidden viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 hidden h-full w-full lg:block">
      {AGENTS.map((agent, index) => {
        const point = orbitPoint(index);
        const x2 = (point.x / 100) * width;
        const y2 = (point.y / 100) * height;
        return (
          <g key={agent.id}>
            <line data-link x1={cx} y1={cy} x2={x2} y2={y2} pathLength={100} strokeDasharray="100" className="stroke-foreground/15" strokeWidth={1} />
            <line data-spot={index} data-lit="false" x1={cx} y1={cy} x2={x2} y2={y2} pathLength={100} className="entry-link-pulse stroke-accent-400 opacity-0 transition-opacity duration-500 data-[lit=true]:opacity-100" strokeWidth={1.5} />
          </g>
        );
      })}
    </svg>
  );
}

function Hub() {
  const { t } = useT();
  return (
    <div className="flex justify-center lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2">
      <div data-hub>
        <div data-float>
          <div className="entry-hub relative flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-full border border-foreground/15 bg-ink-900/80 text-center shadow-[0_0_80px_-20px_var(--color-accent-400)] backdrop-blur">
            <Lightbulb aria-hidden size={22} className="text-amber-300" />
            <span className="text-copy font-semibold text-ink-50">{t('entry.welcome.hub')}</span>
            <span className="relative h-4 w-full">
              <span data-hub-default className="absolute inset-0 font-mono text-micro text-ink-400 transition-opacity duration-300">
                {t('entry.welcome.hubSub')}
              </span>
              {AGENTS.map((agent, index) => (
                <span
                  key={agent.id}
                  aria-hidden
                  data-spot={index}
                  data-lit="false"
                  className="absolute inset-0 font-mono text-micro text-accent-300 opacity-0 transition-[opacity,filter] duration-300 [filter:blur(4px)] data-[lit=true]:opacity-100 data-[lit=true]:[filter:blur(0)]"
                >
                  {t(`entry.artifact.${agent.id}` as keyof Dict)}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentOrbit() {
  const { t } = useT();
  const stageRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(stageRef);
  return (
    <figure data-orbit aria-label={t('entry.welcome.orbit')} className="relative w-full">
      <div ref={stageRef} className="relative flex flex-col gap-5 lg:block lg:aspect-[1.12] lg:w-full">
        <OrbitLinks width={size.width} height={size.height} />
        <Hub />
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:contents">
          {AGENTS.map((agent, index) => {
            const point = orbitPoint(index);
            const Icon = agent.icon;
            const style = { '--x': `${point.x}%`, '--y': `${point.y}%` } as CSSProperties;
            return (
              <li key={agent.id} style={style} className="lg:absolute lg:left-[var(--x)] lg:top-[var(--y)] lg:-translate-x-1/2 lg:-translate-y-1/2">
                <div data-node={index}>
                  <div
                    data-spot={index}
                    data-lit="false"
                    className="flex items-center gap-2 rounded-xl border border-foreground/10 bg-ink-900/70 px-3 py-2 backdrop-blur transition-[border-color,box-shadow,background-color] duration-500 data-[lit=true]:border-accent-400/70 data-[lit=true]:bg-ink-850/90 data-[lit=true]:shadow-[0_0_32px_-8px_var(--color-accent-400)] lg:w-44"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-dim text-accent-300">
                      <Icon aria-hidden size={14} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-ui font-semibold text-ink-100">{t(`entry.agent.${agent.id}` as keyof Dict)}</span>
                      <span className="truncate font-mono text-micro text-ink-400">{t(`entry.artifact.${agent.id}` as keyof Dict)}</span>
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </figure>
  );
}
