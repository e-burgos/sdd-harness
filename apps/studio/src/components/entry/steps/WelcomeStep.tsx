'use client';

import { Button } from '@e-burgos/tucu-ui';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { forwardRef, useRef } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { useSectionMotion } from '@/lib/motion/use-section-motion';
import { WordTitle } from '../../modules/new-project/motion/WordTitle';
import { AgentOrbit } from './AgentOrbit';
import { buildWelcomeMotion } from './welcome-motion';

interface WelcomeStepProps {
  gentle: boolean;
  rich: boolean;
  onStart(): void;
  onHaveBridge(): void;
}

export const WelcomeStep = forwardRef<HTMLHeadingElement, WelcomeStepProps>(function WelcomeStep({ gentle, rich, onStart, onHaveBridge }, titleRef) {
  const { t } = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const motion = useSectionMotion(rootRef, buildWelcomeMotion, rich);
  return (
    <section
      ref={rootRef}
      data-entry-step="welcome"
      data-intro={motion === 'loading' ? 'pending' : undefined}
      className="grid flex-1 items-center gap-10 py-4 lg:grid-cols-[1.05fr_1fr] lg:gap-12"
    >
      <div className="flex flex-col gap-5">
        <p data-hero-eyebrow className="w-fit rounded-full border border-accent-400/30 bg-accent-dim px-3 py-1 font-mono text-meta uppercase tracking-[0.25em] text-accent-300">
          {t('entry.welcome.eyebrow')}
        </p>
        <WordTitle ref={titleRef} text={t('entry.welcome.title')} animate={gentle} className="max-w-[18ch] text-display font-semibold tracking-tight text-ink-50 outline-none sm:text-hero" />
        <div data-hero-copy className="flex flex-col gap-5">
          <p className="max-w-xl text-copy text-ink-300 sm:text-title sm:font-normal">{t('entry.welcome.subtitle')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <div data-magnet>
              <Button type="button" size="medium" className="group gap-2 text-copy shadow-[0_12px_40px_-12px_var(--color-accent-400)]" onClick={onStart}>
                {t('entry.welcome.start')}
                <ArrowRight aria-hidden size={16} className="transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Button>
            </div>
            <Button type="button" size="medium" variant="transparent" color="gray" className="text-copy text-ink-300" onClick={onHaveBridge}>
              {t('entry.welcome.haveBridge')}
            </Button>
          </div>
          <p className="flex items-center gap-2 text-small text-ink-400">
            <ShieldCheck aria-hidden size={14} className="shrink-0 text-emerald-400" />
            {t('entry.welcome.local')}
          </p>
        </div>
      </div>
      <AgentOrbit />
    </section>
  );
});
