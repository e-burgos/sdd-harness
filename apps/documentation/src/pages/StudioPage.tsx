import { motion } from 'framer-motion';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { CopyCommand } from '../components/CopyCommand';
import { cascade, rise } from '../components/Section';
import { useContent } from '../i18n';

export function StudioPage() {
  const { UI } = useContent();
  const s = UI.studio;

  return (
    <>
      <div className="py-16 md:py-20">
        <motion.div variants={cascade} initial="hidden" animate="show">
          <motion.a
            variants={rise}
            href="#top"
            className="mb-10 inline-flex items-center gap-2 font-mono text-[12px] text-zinc-500 transition-colors hover:text-accent-300"
          >
            <ArrowLeftIcon size={13} />
            {s.back}
          </motion.a>
          <motion.p
            variants={rise}
            className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-accent-400"
          >
            {s.kicker}
          </motion.p>
          <motion.h1
            variants={rise}
            className="max-w-[20ch] text-4xl font-medium leading-[1.03] tracking-tighter text-zinc-50 md:text-[3rem]"
          >
            {s.h1a}
            <span className="text-zinc-500">{s.h1b}</span>
          </motion.h1>
          <motion.p
            variants={rise}
            className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-zinc-400"
          >
            {s.body}
          </motion.p>
        </motion.div>
      </div>

      <div className="space-y-12 border-t hairline pb-20 pt-10">
        {s.sections.map((sec) => (
          <section key={sec.title} className="max-w-[62ch]">
            <h2 className="text-2xl font-medium tracking-tighter text-zinc-100">
              {sec.title}
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
              {sec.body}
            </p>
            {sec.command && (
              <div className="mt-5">
                <CopyCommand command={sec.command} />
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
