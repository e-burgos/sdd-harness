'use client';

import { Check } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { MOTION_MIN_WIDTH } from '@/lib/motion/motion-tokens';
import type { SeamState } from '@/lib/motion/seam-shader';
import { useMotionAllowed } from '@/lib/motion/use-motion-allowed';
import { useSectionMotion } from '@/lib/motion/use-section-motion';
import type { WizardScope } from '@/lib/wizard/catalog';
import { useWizard } from '../../wizard-context';
import { BackMock, FrontMock } from './DoorMocks';
import { createScopeDoorsMotion, type DoorsController } from './scope-doors-motion';
import { SeamCanvas } from './SeamCanvas';

type DoorSide = Exclude<WizardScope, 'fullstack'>;

const DOOR_TONE: Record<DoorSide, { eyebrow: string; accent: string; ring: string; align: string }> = {
  front: {
    eyebrow: 'text-[#fdba74]',
    accent: 'bg-gradient-to-r from-[#fbbf24] to-[#f97316] bg-clip-text text-transparent',
    ring: 'shadow-[inset_0_0_0_1px_rgba(251,146,60,0.55),inset_0_0_80px_-30px_rgba(251,146,60,0.55)]',
    align: 'items-start text-left',
  },
  back: {
    eyebrow: 'text-[#7dd3fc]',
    accent: 'bg-gradient-to-r from-[#38bdf8] to-[#2dd4bf] bg-clip-text text-transparent',
    ring: 'shadow-[inset_0_0_0_1px_rgba(56,189,248,0.55),inset_0_0_80px_-30px_rgba(56,189,248,0.55)]',
    align: 'items-start text-left md:items-end md:text-right',
  },
};

const STATIC_BACKDROP =
  'bg-[radial-gradient(ellipse_at_18%_45%,rgba(234,88,12,0.32),transparent_55%),radial-gradient(ellipse_at_82%_45%,rgba(14,165,233,0.32),transparent_55%)]';

function SplitLabel({ text, accent }: { text: string; accent: string }) {
  const words = text.split(' ');
  const last = words.pop() ?? '';
  return (
    <span className="text-display font-semibold tracking-tight">
      {words.length > 0 && <span className="text-[#fafafa]">{words.join(' ')} </span>}
      <span className={accent}>{last}</span>
    </span>
  );
}

function SelectedMark({ label }: { label: string }) {
  return (
    <span className="wizard-pop inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 font-mono text-micro uppercase tracking-wider text-white/80">
      <Check aria-hidden size={12} />
      {label}
    </span>
  );
}

function Door({ side, selected, dimmed, onSelect }: { side: DoorSide; selected: boolean; dimmed: boolean; onSelect(): void }) {
  const { t } = useT();
  const tone = DOOR_TONE[side];
  const label = t(`wizard.scope.${side}.label` as keyof Dict);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-door={side}
      data-testid={`scope-${side}`}
      onClick={onSelect}
      className={`group relative flex flex-col md:min-h-[21rem] justify-between gap-6 rounded-2xl p-6 outline-none transition-[opacity,box-shadow,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:bg-white/[0.04] ${tone.align} ${selected ? `${tone.ring} bg-white/[0.03]` : 'hover:bg-white/[0.02]'} ${dimmed ? 'opacity-60 hover:opacity-100 focus-visible:opacity-100' : ''}`}
    >
      <span data-door-copy={side} className={`flex flex-col gap-2 ${tone.align}`}>
        <span className={`font-mono text-micro uppercase tracking-[0.25em] ${tone.eyebrow}`}>{t(`wizard.scope.${side}.eyebrow` as keyof Dict)}</span>
        <SplitLabel text={label} accent={tone.accent} />
        <span className="max-w-[22rem] text-small text-white/60">{t(`wizard.scope.${side}.hint` as keyof Dict)}</span>
        {selected && <SelectedMark label={t('wizard.scope.selected')} />}
      </span>
      {side === 'front' ? <FrontMock statusBuilding={t('wizard.scope.mock.building')} statusLive={t('wizard.scope.mock.live')} /> : <BackMock />}
    </button>
  );
}

function FullstackPill({ selected, onSelect }: { selected: boolean; onSelect(): void }) {
  const { t } = useT();
  return (
    <div className="relative flex justify-center px-6 pb-6">
      <div className="flex flex-col items-center gap-2">
        <div data-pill>
        <button
          type="button"
          role="radio"
          aria-checked={selected}
          data-door="fullstack"
          data-testid="scope-fullstack"
          onClick={onSelect}
          className={`relative flex items-center gap-3 rounded-full p-px outline-none transition-[box-shadow] duration-500 focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.25)] ${selected ? 'bg-gradient-to-r from-[#f97316] via-white/70 to-[#38bdf8] shadow-[0_0_40px_-6px_rgba(255,255,255,0.35)]' : 'bg-white/15 hover:bg-white/30'}`}
        >
          <span data-magnet className="flex items-center gap-3 rounded-full bg-[#0a0a0d]/90 px-5 py-2.5 backdrop-blur">
            <span className="font-mono text-micro uppercase tracking-[0.25em] text-white/50">{t('wizard.scope.fullstack.eyebrow')}</span>
            <span className="text-copy font-semibold">
              <span className="bg-gradient-to-r from-[#fdba74] to-[#7dd3fc] bg-clip-text text-transparent">{t('wizard.scope.fullstack.label')}</span>
            </span>
            {selected && <Check aria-hidden size={14} className="wizard-pop text-white" />}
          </span>
        </button>
        </div>
        <span className="max-w-md text-center text-small text-white/55">{t('wizard.scope.fullstack.hint')}</span>
      </div>
    </div>
  );
}

export function ScopeDoors() {
  const { t } = useT();
  const { state, requestChange } = useWizard();
  const animate = useMotionAllowed(MOTION_MIN_WIDTH);
  const stageRef = useRef<HTMLDivElement>(null);
  const seam = useMemo<SeamState>(() => ({ split: 0.5, mouseX: 0.5, mouseY: 0.5, hover: 0 }), []);
  const controller = useRef<DoorsController | null>(null);
  const build = useMemo(() => createScopeDoorsMotion(seam, controller), [seam]);
  const motion = useSectionMotion(stageRef, build, animate);

  useEffect(() => {
    controller.current?.settle(state.scope);
  }, [state.scope]);

  const choose = (scope: WizardScope) => requestChange({ type: 'scope', scope });
  const someSelected = state.scope !== null;

  return (
    <div
      ref={stageRef}
      role="radiogroup"
      aria-label={t('wizard.scope.group')}
      data-selected={state.scope ?? undefined}
      data-testid="scope-doors"
      data-intro={motion === 'loading' ? 'pending' : undefined}
      className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-[#050507] text-[#fafafa] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
    >
      {animate ? <SeamCanvas state={seam} /> : <div aria-hidden className={`absolute inset-0 ${STATIC_BACKDROP}`} />}
      {!animate && <span aria-hidden className="absolute inset-y-8 left-1/2 hidden w-px bg-gradient-to-b from-transparent via-white/40 to-transparent md:block" />}
      <div className="relative grid grid-cols-1 gap-2 p-2 md:grid-cols-2">
        <Door side="front" selected={state.scope === 'front'} dimmed={someSelected && state.scope === 'back'} onSelect={() => choose('front')} />
        <Door side="back" selected={state.scope === 'back'} dimmed={someSelected && state.scope === 'front'} onSelect={() => choose('back')} />
      </div>
      <FullstackPill selected={state.scope === 'fullstack'} onSelect={() => choose('fullstack')} />
    </div>
  );
}
