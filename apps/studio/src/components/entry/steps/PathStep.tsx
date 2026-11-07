'use client';

import { motion } from 'framer-motion';
import { Check, FolderGit2, FolderPlus, PlugZap, type LucideIcon } from 'lucide-react';
import { forwardRef, useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { bezier, duration } from '@/lib/motion/motion-tokens';
import { ENTRY_PATHS, type EntryPath } from '../entry-model';
import { StepHeader } from './StepHeader';

const DOOR_TONE: Record<EntryPath, { icon: LucideIcon; eyebrow: string; tile: string; ring: string; glow: string }> = {
  new: {
    icon: FolderPlus,
    eyebrow: 'text-amber-300',
    tile: 'bg-gradient-to-br from-[#fbbf24]/25 to-[#f97316]/10 text-amber-300',
    ring: 'border-amber-400/70 shadow-[0_0_0_1px_rgba(251,146,60,0.45),0_24px_60px_-28px_rgba(251,146,60,0.8)]',
    glow: 'rgba(251,146,60,0.18)',
  },
  existing: {
    icon: FolderGit2,
    eyebrow: 'text-sky-300',
    tile: 'bg-gradient-to-br from-[#38bdf8]/25 to-[#2dd4bf]/10 text-sky-300',
    ring: 'border-sky-400/70 shadow-[0_0_0_1px_rgba(56,189,248,0.45),0_24px_60px_-28px_rgba(56,189,248,0.8)]',
    glow: 'rgba(56,189,248,0.18)',
  },
  running: {
    icon: PlugZap,
    eyebrow: 'text-emerald-300',
    tile: 'bg-gradient-to-br from-emerald-400/25 to-emerald-400/5 text-emerald-300',
    ring: 'border-emerald-400/70 shadow-[0_0_0_1px_rgba(52,211,153,0.4),0_24px_60px_-28px_rgba(52,211,153,0.8)]',
    glow: 'rgba(52,211,153,0.16)',
  },
};

const ARROW_STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

function trackSpotlight(event: PointerEvent<HTMLElement>): void {
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty('--mx', `${event.clientX - box.left}px`);
  event.currentTarget.style.setProperty('--my', `${event.clientY - box.top}px`);
}

interface DoorProps {
  path: EntryPath;
  index: number;
  selected: boolean;
  focusable: boolean;
  gentle: boolean;
  onSelect(path: EntryPath): void;
  onHover(path: EntryPath | null): void;
  onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void;
  register(index: number, el: HTMLButtonElement | null): void;
}

function Door({ path, index, selected, focusable, gentle, onSelect, onHover, onKeyDown, register }: DoorProps) {
  const { t } = useT();
  const tone = DOOR_TONE[path];
  const Icon = tone.icon;
  const hintId = useId();
  const label = t(`entry.path.${path}.label` as keyof Dict);
  return (
    <button
      ref={(el) => register(index, el)}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      aria-describedby={hintId}
      tabIndex={focusable ? 0 : -1}
      data-testid={`entry-path-${path}`}
      data-door={path}
      onClick={() => onSelect(path)}
      onKeyDown={(event) => onKeyDown(event, index)}
      onPointerMove={trackSpotlight}
      onPointerEnter={() => onHover(path)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(path)}
      onBlur={() => onHover(null)}
      style={{ ['--door-glow' as string]: tone.glow }}
      className={`group relative flex min-h-[13rem] flex-col gap-4 overflow-hidden rounded-2xl border bg-ink-900/70 p-5 text-left outline-none backdrop-blur transition-[border-color,box-shadow,translate] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${selected ? tone.ring : 'border-foreground/10 hover:border-foreground/25'}`}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(240px_circle_at_var(--mx,50%)_var(--my,0%),var(--door-glow),transparent_70%)]" />
      {selected && gentle && (
        <motion.span
          layoutId="entry-door-selected"
          aria-hidden
          className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-foreground/70 to-transparent"
          transition={{ duration: duration.step, ease: bezier.out }}
        />
      )}
      <span className="relative flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone.tile}`}>
          <Icon aria-hidden size={20} />
        </span>
        {path === 'new' && (
          <span className="relative overflow-hidden rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-micro uppercase tracking-[0.18em] text-amber-300">
            {t('entry.path.recommended')}
            <span aria-hidden className="wizard-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </span>
        )}
      </span>
      <span className="relative flex flex-col gap-1.5">
        <span className={`font-mono text-micro uppercase tracking-[0.25em] ${tone.eyebrow}`}>{t(`entry.path.${path}.eyebrow` as keyof Dict)}</span>
        <span className="text-title font-semibold text-ink-50">{label}</span>
        <span id={hintId} className="text-small text-ink-300">
          {t(`entry.path.${path}.hint` as keyof Dict)}
        </span>
      </span>
      <span className="relative mt-auto h-5">
        {selected && (
          <span className="wizard-pop inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 font-mono text-micro uppercase tracking-wider text-ink-100">
            <Check aria-hidden size={12} />
            {t('entry.path.selected')}
          </span>
        )}
      </span>
    </button>
  );
}

interface PathStepProps {
  path: EntryPath | null;
  gentle: boolean;
  onSelect(path: EntryPath): void;
  onHover(path: EntryPath | null): void;
}

export const PathStep = forwardRef<HTMLHeadingElement, PathStepProps>(function PathStep({ path, gentle, onSelect, onHover }, titleRef) {
  const { t } = useT();
  const doors = useRef<Array<HTMLButtonElement | null>>([]);
  const focusIndex = path ? ENTRY_PATHS.indexOf(path) : 0;
  const moveTo = (index: number) => {
    const next = ENTRY_PATHS[index];
    if (!next) return;
    onSelect(next);
    doors.current[index]?.focus({ preventScroll: true });
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const total = ENTRY_PATHS.length;
    if (event.key in ARROW_STEP) {
      event.preventDefault();
      moveTo((index + (ARROW_STEP[event.key] ?? 0) + total) % total);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveTo(total - 1);
    }
  };
  return (
    <section data-entry-step="path" className="flex flex-col gap-6">
      <StepHeader ref={titleRef} title={t('entry.path.title')} description={t('entry.path.desc')} gentle={gentle} />
      <div role="radiogroup" aria-label={t('entry.path.group')} className="wizard-stagger grid grid-cols-1 gap-3 md:grid-cols-3">
        {ENTRY_PATHS.map((option, index) => (
          <Door
            key={option}
            path={option}
            index={index}
            selected={path === option}
            focusable={index === focusIndex}
            gentle={gentle}
            onSelect={onSelect}
            onHover={onHover}
            onKeyDown={handleKeyDown}
            register={(i, el) => {
              doors.current[i] = el;
            }}
          />
        ))}
      </div>
    </section>
  );
});
