'use client';

import { forwardRef } from 'react';
import { WordTitle } from '../../modules/new-project/motion/WordTitle';

export const StepHeader = forwardRef<HTMLHeadingElement, { title: string; description: string; gentle: boolean }>(function StepHeader({ title, description, gentle }, ref) {
  return (
    <header className="flex max-w-2xl flex-col gap-2">
      <WordTitle ref={ref} text={title} animate={gentle} className="text-display font-semibold tracking-tight text-ink-50 outline-none" />
      <p className="text-copy text-ink-300">{description}</p>
    </header>
  );
});
