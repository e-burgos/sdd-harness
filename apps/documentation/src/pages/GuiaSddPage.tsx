import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftIcon, BookOpenTextIcon, ListChecksIcon } from '@phosphor-icons/react';
import { Markdown, extractH2 } from '../components/Markdown';
import { cascade, rise } from '../components/Section';
import readmeSource from '../content/sdd-readme.md?raw';
import howToSource from '../content/sdd-how-to.md?raw';

const DOCS = [
  {
    id: 'readme',
    tab: 'README — el sistema',
    file: 'sdd/README.md',
    source: readmeSource,
    icon: BookOpenTextIcon,
  },
  {
    id: 'how-to',
    tab: 'HOW-TO — paso a paso',
    file: 'sdd/HOW-TO-USE-SDD.md',
    source: howToSource,
    icon: ListChecksIcon,
  },
];

export function GuiaSddPage() {
  const [doc, setDoc] = useState(DOCS[0]);
  const toc = useMemo(() => extractH2(doc.source), [doc]);

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
            volver a la documentación
          </motion.a>
          <motion.p
            variants={rise}
            className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-accent-400"
          >
            guía sdd — la documentación que viaja con el kit
          </motion.p>
          <motion.h1
            variants={rise}
            className="max-w-[20ch] text-4xl font-medium leading-[1.03] tracking-tighter text-zinc-50 md:text-[3rem]"
          >
            El manual completo del sistema,
            <span className="text-zinc-500"> antes de instalarlo.</span>
          </motion.h1>
          <motion.p
            variants={rise}
            className="mt-6 max-w-[58ch] text-[15px] leading-relaxed text-zinc-400"
          >
            Estos dos documentos viven dentro de <code className="text-zinc-200">sdd/</code>{' '}
            en cada repo generado — acá los podés leer completos: la referencia
            del sistema (gates, agentes, registros, reglas) y la guía paso a
            paso para el día a día de un dev.
          </motion.p>
        </motion.div>
      </div>

      <div className="border-t hairline pt-10">
        <div className="mb-10 flex flex-wrap gap-2">
          {DOCS.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setDoc(d);
                window.scrollTo({ top: 0 });
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[12.5px] transition-all active:scale-[0.97] ${
                doc.id === d.id
                  ? 'border-accent-500/50 bg-accent-dim text-accent-300'
                  : 'hairline text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <d.icon size={14} />
              {d.tab}
            </button>
          ))}
        </div>

        <div className="grid gap-12 pb-20 lg:grid-cols-[minmax(0,1fr)_240px]">
          <AnimatePresence mode="wait">
            <motion.article
              key={doc.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              className="min-w-0"
            >
              <p className="mb-8 font-mono text-[11.5px] text-zinc-600">
                {doc.file} — se instala tal cual en cada repo
              </p>
              <Markdown source={doc.source} />
            </motion.article>
          </AnimatePresence>

          <aside className="hidden lg:block">
            <nav className="sticky top-24">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600">
                En este documento
              </p>
              <ul className="space-y-0.5 border-l hairline">
                {toc.map((h) => (
                  <li key={h.id}>
                    <button
                      onClick={() =>
                        document
                          .getElementById(h.id)
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                      className="block w-full py-1.5 pl-4 text-left text-[12.5px] leading-snug text-zinc-500 transition-colors hover:text-accent-300"
                    >
                      {h.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </div>
    </>
  );
}
