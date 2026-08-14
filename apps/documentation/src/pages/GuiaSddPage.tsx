import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  BookOpenTextIcon,
  DownloadSimpleIcon,
  InfoIcon,
  ListChecksIcon,
} from '@phosphor-icons/react';
import { Markdown, extractH2 } from '../components/Markdown';
import { cascade, rise } from '../components/Section';
import { useContent, useLang } from '../i18n';
import readmeEs from '../content/sdd-readme.es.md?raw';
import howToEs from '../content/sdd-how-to.es.md?raw';
import installEs from '../content/sdd-install.es.md?raw';
import readmeEn from '../content/sdd-readme.en.md?raw';
import howToEn from '../content/sdd-how-to.en.md?raw';
import installEn from '../content/sdd-install.en.md?raw';

// The kit ships its documentation in both languages under sdd/documentation/;
// the page follows the site's language switch.
const DOC_FILES = [
  {
    id: 'install',
    file: 'sdd/documentation/<lang>/INSTALL.md',
    source: { es: installEs, en: installEn },
    icon: DownloadSimpleIcon,
  },
  {
    id: 'how-to',
    file: 'sdd/documentation/<lang>/HOW-TO-USE-SDD.md',
    source: { es: howToEs, en: howToEn },
    icon: ListChecksIcon,
  },
  {
    id: 'readme',
    file: 'sdd/documentation/<lang>/README.md',
    source: { es: readmeEs, en: readmeEn },
    icon: BookOpenTextIcon,
  },
];

export function GuiaSddPage() {
  const { UI } = useContent();
  const { lang } = useLang();
  const g = UI.guia;
  const docs = useMemo(
    () =>
      DOC_FILES.map((d) => ({
        ...d,
        source: d.source[lang],
        file: d.file.replace('<lang>', lang),
        tab: g.tabs.find((t) => t.id === d.id)?.tab ?? d.id,
      })),
    [g, lang],
  );
  const [docId, setDocId] = useState(DOC_FILES[0].id);
  const doc = docs.find((d) => d.id === docId) ?? docs[0];
  const toc = useMemo(() => extractH2(doc.source), [doc.source]);

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
            {g.back}
          </motion.a>
          <motion.p
            variants={rise}
            className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-accent-400"
          >
            {g.kicker}
          </motion.p>
          <motion.h1
            variants={rise}
            className="max-w-[20ch] text-4xl font-medium leading-[1.03] tracking-tighter text-zinc-50 md:text-[3rem]"
          >
            {g.h1a}
            <span className="text-zinc-500">{g.h1b}</span>
          </motion.h1>
          <motion.p
            variants={rise}
            className="mt-6 max-w-[58ch] text-[15px] leading-relaxed text-zinc-400"
          >
            {g.body}
          </motion.p>
          {g.langNote && (
            <motion.p
              variants={rise}
              className="mt-6 flex max-w-[62ch] items-start gap-2.5 rounded-xl border border-accent-500/30 bg-accent-dim px-4 py-3 text-[13px] leading-relaxed text-zinc-300"
            >
              <InfoIcon size={16} className="mt-0.5 shrink-0 text-accent-400" />
              <span>{g.langNote}</span>
            </motion.p>
          )}
        </motion.div>
      </div>

      <div className="border-t hairline pt-10">
        <div className="mb-10 flex flex-wrap gap-2">
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setDocId(d.id);
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
                {doc.file}
                {g.installedNote}
              </p>
              <Markdown source={doc.source} />
            </motion.article>
          </AnimatePresence>

          <aside className="hidden lg:block">
            <nav className="sticky top-24">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600">
                {g.tocHeading}
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
