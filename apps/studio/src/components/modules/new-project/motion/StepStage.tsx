'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { bezier, distance, duration } from '@/lib/motion/motion-tokens';

export type StepDirection = 1 | -1;

export function StepStage({ stepKey, direction, animate, children }: { stepKey: string; direction: StepDirection; animate: boolean; children: ReactNode }) {
  if (!animate) return <div className="flex flex-1 flex-col gap-4">{children}</div>;
  const offset = distance.step * direction;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        data-step-stage={stepKey}
        className="flex flex-1 flex-col gap-4"
        initial={{ opacity: 0, x: offset }}
        animate={{ opacity: 1, x: 0, transition: { duration: duration.step, ease: bezier.out } }}
        exit={{ opacity: 0, x: -offset, transition: { duration: duration.exit, ease: bezier.exit } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
