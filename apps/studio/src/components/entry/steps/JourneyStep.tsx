'use client';

import { GitBranch, KeyRound, Lightbulb, WandSparkles, type LucideIcon } from 'lucide-react';
import { forwardRef, useRef } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { useSectionMotion } from '@/lib/motion/use-section-motion';
import type { EntryPath } from '../entry-model';
import { buildJourneyMotion } from './journey-motion';
import { StepHeader } from './StepHeader';

interface Stop {
  id: string;
  icon: LucideIcon;
  title: keyof Dict;
  description: keyof Dict;
}

function stopsFor(path: EntryPath | null): readonly Stop[] {
  return [
    { id: 'claude', icon: KeyRound, title: 'onboarding.step.claude', description: 'entry.journey.claude.desc' },
    { id: 'project', icon: WandSparkles, title: 'onboarding.step.project', description: path === 'existing' ? 'entry.journey.project.existing' : 'entry.journey.project.new' },
    { id: 'github', icon: GitBranch, title: 'onboarding.step.github', description: 'entry.journey.github.desc' },
    { id: 'first', icon: Lightbulb, title: 'onboarding.step.first-work', description: 'entry.journey.first.desc' },
  ];
}

interface JourneyStepProps {
  path: EntryPath | null;
  gentle: boolean;
  rich: boolean;
}

export const JourneyStep = forwardRef<HTMLHeadingElement, JourneyStepProps>(function JourneyStep({ path, gentle, rich }, titleRef) {
  const { t } = useT();
  const rootRef = useRef<HTMLElement>(null);
  const motion = useSectionMotion(rootRef, buildJourneyMotion, rich);
  const stops = stopsFor(path);
  return (
    <section ref={rootRef} data-entry-step="journey" data-intro={motion === 'loading' ? 'pending' : undefined} className="flex flex-col gap-8">
      <StepHeader ref={titleRef} title={t('entry.journey.title')} description={t('entry.journey.desc')} gentle={gentle} />
      <ol data-journey aria-label={t('entry.journey.list')} className="relative grid grid-cols-1 gap-6 md:grid-cols-4 md:gap-4">
        <span aria-hidden className="absolute bottom-5 left-5 top-5 w-px bg-foreground/10 md:bottom-auto md:left-[12.5%] md:right-[12.5%] md:h-px md:w-auto">
          <span data-journey-fill className="absolute inset-0 origin-top bg-gradient-to-b from-accent-400 via-sky-400 to-emerald-400 md:origin-left md:bg-gradient-to-r" />
        </span>
        <span aria-hidden data-journey-token className="absolute left-0 top-5 hidden h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-300 opacity-0 shadow-[0_0_18px_4px_var(--color-accent-400)] lg:block" />
        {stops.map((stop, index) => {
          const Icon = stop.icon;
          return (
            <li key={stop.id} data-stop={stop.id} className="relative flex gap-4 md:flex-col md:items-center md:text-center">
              <div data-stop-node className="relative z-10 shrink-0">
                <span
                  data-spot={index}
                  data-lit="false"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/15 bg-ink-900 text-accent-300 transition-[border-color,box-shadow,color] duration-500 data-[lit=true]:border-accent-400 data-[lit=true]:text-ink-50 data-[lit=true]:shadow-[0_0_0_6px_var(--color-accent-dim),0_0_36px_-4px_var(--color-accent-400)]"
                >
                  <Icon aria-hidden size={18} />
                </span>
              </div>
              <div data-stop-copy className="flex min-w-0 flex-col gap-1 pt-1 md:items-center md:pt-0">
                <span className="font-mono text-micro uppercase tracking-[0.2em] text-ink-500">{t('entry.journey.stop', { n: index + 1 })}</span>
                <h2 className="text-title font-semibold text-ink-50">{t(stop.title)}</h2>
                <p className="max-w-[18rem] text-small text-ink-300">{t(stop.description)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
});
