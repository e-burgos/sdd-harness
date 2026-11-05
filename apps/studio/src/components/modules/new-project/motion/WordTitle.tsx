'use client';

import { motion, type Variants } from 'framer-motion';
import { forwardRef } from 'react';
import { bezier, distance, duration, stagger } from '@/lib/motion/motion-tokens';

const LINE: Variants = { hidden: {}, shown: { transition: { staggerChildren: stagger.word } } };

const WORD: Variants = {
  hidden: { opacity: 0, y: `${distance.word}%`, rotateX: -40, filter: 'blur(14px)' },
  shown: { opacity: 1, y: '0%', rotateX: 0, filter: 'blur(0px)', transition: { duration: duration.word, ease: bezier.out } },
};

export const WordTitle = forwardRef<HTMLHeadingElement, { text: string; animate: boolean; className?: string }>(function WordTitle(
  { text, animate, className },
  ref,
) {
  if (!animate) {
    return (
      <h1 ref={ref} tabIndex={-1} className={className}>
        {text}
      </h1>
    );
  }
  const words = text.split(' ');
  return (
    <motion.h1 ref={ref} tabIndex={-1} aria-label={text} className={`${className ?? ''} [perspective:600px]`} variants={LINE} initial="hidden" animate="shown">
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          aria-hidden
          variants={WORD}
          className={`inline-block origin-bottom will-change-transform ${index < words.length - 1 ? 'mr-[0.28em]' : ''}`}
        >
          {word}
        </motion.span>
      ))}
    </motion.h1>
  );
});
