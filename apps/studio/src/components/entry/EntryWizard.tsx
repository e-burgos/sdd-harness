'use client';

import { Button } from '@e-burgos/tucu-ui';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { MOTION_MIN_WIDTH } from '@/lib/motion/motion-tokens';
import { useMotionAllowed } from '@/lib/motion/use-motion-allowed';
import { StepStage } from '../modules/new-project/motion/StepStage';
import { useFocusOnStepChange, useStepDirection } from '../modules/new-project/motion/use-step-focus';
import { openBridgeLink } from './bridge-link';
import type { SeamTarget } from './entry-backdrop-motion';
import {
  EDGE_SEAM_SPLIT_BY_PATH,
  NEUTRAL_SEAM_SPLIT,
  SEAM_SPLIT_BY_PATH,
  stepsForPath,
  type EntryPath,
  type EntryStepId,
  type RequirementId,
} from './entry-model';
import { readStoredEntry, storeEntry } from './entry-storage';
import { EntryBackdrop } from './EntryBackdrop';
import { EntryProgress } from './EntryProgress';
import { ConnectStep } from './steps/ConnectStep';
import { JourneyStep } from './steps/JourneyStep';
import { PathStep } from './steps/PathStep';
import { RequirementsStep } from './steps/RequirementsStep';
import { WelcomeStep } from './steps/WelcomeStep';

export interface EntryWizardProps {
  error?: string;
  navigate?: (href: string) => void;
}

function seamTargetFor(step: EntryStepId, path: EntryPath | null, hovered: EntryPath | null): SeamTarget {
  const focus = step === 'path' ? (hovered ?? path) : path;
  if (step === 'welcome' || focus === null) return { split: NEUTRAL_SEAM_SPLIT, hover: 0.2 };
  if (step === 'path') return { split: SEAM_SPLIT_BY_PATH[focus], hover: hovered ? 1 : 0.5 };
  return { split: EDGE_SEAM_SPLIT_BY_PATH[focus], hover: 0.3 };
}

function usePersistedEntry() {
  const [path, setPath] = useState<EntryPath | null>(null);
  const [checked, setChecked] = useState<readonly RequirementId[]>([]);
  const restored = useRef(false);
  useEffect(() => {
    const stored = readStoredEntry();
    setPath(stored.path);
    setChecked(stored.checked);
    restored.current = true;
  }, []);
  useEffect(() => {
    if (restored.current) storeEntry({ path, checked });
  }, [path, checked]);
  return { path, setPath, checked, setChecked };
}

function Brand() {
  const { t } = useT();
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-400 to-sky-400 text-ink-950 shadow-[0_0_24px_-6px_var(--color-accent-400)]"
      >
        <Sparkles size={14} />
      </span>
      <span className="text-copy font-semibold text-ink-50">{t('entry.brand')}</span>
    </span>
  );
}

export function EntryWizard({ error, navigate = openBridgeLink }: EntryWizardProps) {
  const { t, lang, setLang } = useT();
  const gentle = useMotionAllowed(0);
  const rich = useMotionAllowed(MOTION_MIN_WIDTH);
  const { path, setPath, checked, setChecked } = usePersistedEntry();
  const [step, setStep] = useState<EntryStepId>(error ? 'connect' : 'welcome');
  const [hovered, setHovered] = useState<EntryPath | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollerRef = useRef<HTMLElement>(null);

  const effectivePath = path ?? (error ? 'running' : null);
  const steps = stepsForPath(effectivePath);
  const position = Math.max(0, steps.indexOf(step));
  const direction = useStepDirection(position);
  useFocusOnStepChange(step, titleRef, scrollerRef);
  const seamTarget = useMemo(() => seamTargetFor(step, effectivePath, hovered), [step, effectivePath, hovered]);

  const goTo = (index: number) => {
    const next = steps[index];
    if (next) setStep(next);
  };
  const toggleRequirement = (id: RequirementId, value: boolean) =>
    setChecked((current) => (value ? [...current.filter((item) => item !== id), id] : current.filter((item) => item !== id)));
  const jumpToConnect = () => {
    setPath('running');
    setStep('connect');
  };

  const last = position === steps.length - 1;
  const nextBlocked = step === 'path' && path === null;
  const nextLabel = steps[position + 1] === 'connect' ? t('entry.nav.toConnect') : t('entry.nav.next');

  return (
    <div data-testid="entry-wizard" data-step={step} className="fixed inset-0 isolate flex flex-col overflow-clip bg-ink-950 text-ink-100">
      <EntryBackdrop animate={rich} target={seamTarget} />
      <header className="relative flex shrink-0 items-center gap-4 px-4 pb-3 pt-4 sm:px-8 lg:gap-10">
        <Brand />
        <EntryProgress steps={steps} current={position} onJump={goTo} />
        <Button type="button" variant="transparent" color="gray" size="tiny" className="shrink-0 text-ui" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
          {t('lang.switch')}
        </Button>
      </header>
      <main ref={scrollerRef} aria-label={t('entry.region')} className="relative flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 sm:px-8 lg:py-10">
          <div className="my-auto w-full">
            <StepStage stepKey={step} direction={direction} animate={gentle}>
              {step === 'welcome' && <WelcomeStep ref={titleRef} gentle={gentle} rich={rich} onStart={() => setStep('path')} onHaveBridge={jumpToConnect} />}
              {step === 'path' && <PathStep ref={titleRef} path={path} gentle={gentle} onSelect={setPath} onHover={setHovered} />}
              {step === 'requirements' && <RequirementsStep ref={titleRef} checked={checked} gentle={gentle} onToggle={toggleRequirement} />}
              {step === 'journey' && <JourneyStep ref={titleRef} path={effectivePath} gentle={gentle} rich={rich} />}
              {step === 'connect' && <ConnectStep ref={titleRef} path={effectivePath ?? 'running'} error={error} gentle={gentle} onNavigate={navigate} />}
            </StepStage>
          </div>
        </div>
      </main>
      {step !== 'welcome' && (
        <footer className="relative flex shrink-0 items-center gap-3 border-t border-foreground/10 bg-ink-950/70 px-4 py-3 backdrop-blur sm:px-8">
          <Button type="button" size="small" variant="outline" color="gray" className="gap-1.5 text-ui" onClick={() => goTo(position - 1)}>
            <ArrowLeft aria-hidden size={14} />
            {t('entry.nav.back')}
          </Button>
          <p aria-live="polite" className="min-w-0 flex-1 truncate text-center font-mono text-meta uppercase tracking-[0.2em] text-ink-400">
            {nextBlocked
              ? t('entry.nav.choosePath')
              : t('entry.progress.stepOf', {
                  n: position + 1,
                  total: steps.length,
                })}
          </p>
          {last ? (
            <span aria-hidden className="w-[5.5rem]" />
          ) : (
            <Button type="button" size="small" className="gap-1.5 text-ui" disabled={nextBlocked} onClick={() => goTo(position + 1)}>
              {nextLabel}
              <ArrowRight aria-hidden size={14} />
            </Button>
          )}
        </footer>
      )}
    </div>
  );
}
