import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function Section({
  id,
  kicker,
  title,
  lead,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-[4.3rem] border-t hairline py-20 md:py-28">
      <motion.header
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="mb-12 max-w-[62ch] md:mb-16"
      >
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-accent-400">
          {kicker}
        </p>
        <h2 className="text-3xl font-medium tracking-tighter text-zinc-100 md:text-[2.6rem] md:leading-[1.05]">
          {title}
        </h2>
        {lead && (
          <p className="mt-5 text-[15px] leading-relaxed text-zinc-400">
            {lead}
          </p>
        )}
      </motion.header>
      {children}
    </section>
  );
}

export const rise = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 20 },
  },
};

export const cascade = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
