import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  CheckIcon,
  CopyIcon,
  DownloadSimpleIcon,
  InfoIcon,
  ListChecksIcon,
  RobotIcon,
  ShieldCheckIcon,
  UserIcon,
  WarningIcon,
  WrenchIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { CopyCommand } from '../components/CopyCommand';
import { cascade, rise } from '../components/Section';
import { useContent } from '../i18n';
import type { TerminalLine } from '../data/content';
import type { UsageBlock } from '../data/usage';

// El contenido vive en src/data/usage.ts (+ .en.ts); acá solo se decide cómo se
// dibuja cada tipo de bloque. Los íconos quedan del lado del componente porque
// los archivos de datos son data pura, sin imports de React.
const TAB_ICONS: Record<string, Icon> = {
  instalacion: DownloadSimpleIcon,
  actualizacion: ArrowsClockwiseIcon,
  'spec-gate': ShieldCheckIcon,
  'fix-gate': WrenchIcon,
  trabajando: ListChecksIcon,
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ComoUsarloPage() {
  const { UI, USAGE_TABS } = useContent();
  const u = UI.usage;
  const [tabId, setTabId] = useState(USAGE_TABS[0].id);
  const tab = USAGE_TABS.find((t) => t.id === tabId) ?? USAGE_TABS[0];

  const toc = useMemo(
    () =>
      tab.blocks
        .filter((b): b is Extract<UsageBlock, { kind: 'heading' }> => b.kind === 'heading')
        .map((b) => ({ id: `${tab.id}-${slugify(b.text)}`, label: b.text })),
    [tab],
  );

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
            {u.back}
          </motion.a>
          <motion.p
            variants={rise}
            className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-accent-400"
          >
            {u.kicker}
          </motion.p>
          <motion.h1
            variants={rise}
            className="max-w-[20ch] text-4xl font-medium leading-[1.03] tracking-tighter text-zinc-50 md:text-[3rem]"
          >
            {u.h1a}
            <span className="text-zinc-500">{u.h1b}</span>
          </motion.h1>
          <motion.p
            variants={rise}
            className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-zinc-400"
          >
            {u.body}
          </motion.p>
        </motion.div>
      </div>

      <div className="border-t hairline pt-10">
        <div className="mb-10 flex flex-wrap gap-2">
          {USAGE_TABS.map((t, i) => {
            const TabIcon = TAB_ICONS[t.id] ?? ListChecksIcon;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTabId(t.id);
                  window.scrollTo({ top: 0 });
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[12.5px] transition-all active:scale-[0.97] ${
                  tab.id === t.id
                    ? 'border-accent-500/50 bg-accent-dim text-accent-300'
                    : 'hairline text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <TabIcon size={14} />
                <span className="text-zinc-600">{i + 1}</span>
                {t.tab}
              </button>
            );
          })}
        </div>

        <div className="grid gap-12 pb-20 lg:grid-cols-[minmax(0,1fr)_240px]">
          <AnimatePresence mode="wait">
            <motion.article
              key={tab.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              className="min-w-0"
            >
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-accent-400">
                {tab.kicker}
              </p>
              <h2 className="max-w-[24ch] text-3xl font-medium tracking-tighter text-zinc-100 md:text-[2.3rem] md:leading-[1.08]">
                {tab.title}
              </h2>
              <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-zinc-400">
                {tab.lead}
              </p>

              <div className="mt-12 space-y-8">
                {tab.blocks.map((block, i) => (
                  <Block key={i} block={block} tabId={tab.id} />
                ))}
              </div>
            </motion.article>
          </AnimatePresence>

          <aside className="hidden lg:block">
            <nav className="sticky top-24">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600">
                {u.tocHeading}
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

function Block({ block, tabId }: { block: UsageBlock; tabId: string }) {
  switch (block.kind) {
    case 'heading':
      return (
        <header
          id={`${tabId}-${slugify(block.text)}`}
          className="scroll-mt-24 border-t hairline pt-8"
        >
          <h3 className="text-[1.35rem] font-medium tracking-tight text-zinc-100">
            {block.text}
          </h3>
          {block.hint && (
            <div className="mt-2">
              <CopyChip command={block.hint} />
            </div>
          )}
        </header>
      );

    case 'prose':
      return (
        <p className="max-w-[68ch] text-[14.5px] leading-relaxed text-zinc-400">
          {block.text}
        </p>
      );

    case 'note': {
      const warn = block.tone === 'warn';
      const NoteIcon = warn ? WarningIcon : InfoIcon;
      return (
        <p
          className={`flex max-w-[68ch] items-start gap-2.5 rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed text-zinc-300 ${
            warn
              ? 'border-amber-500/30 bg-amber-500/[0.06]'
              : 'border-accent-500/30 bg-accent-dim'
          }`}
        >
          <NoteIcon
            size={16}
            className={`mt-0.5 shrink-0 ${warn ? 'text-amber-400' : 'text-accent-400'}`}
          />
          <span>{block.text}</span>
        </p>
      );
    }

    case 'steps':
      return (
        <div>
          {block.title && <BlockTitle>{block.title}</BlockTitle>}
          <ol className="space-y-4">
            {block.items.map((item, i) => (
              <li
                key={i}
                className="rounded-xl border hairline bg-ink-900/40 px-5 py-4"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] text-accent-400">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-medium text-zinc-100">
                      {item.title}
                    </p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-400">
                      {item.body}
                    </p>
                    {item.command && (
                      <div className="mt-3">
                        <CopyCommand command={item.command} />
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      );

    case 'terminal':
      return (
        <div>
          <BlockTitle>{block.title}</BlockTitle>
          <div className="overflow-hidden rounded-2xl border hairline bg-ink-900/90">
            <div className="flex items-center gap-2 border-b hairline px-4 py-3">
              <span className="size-2.5 rounded-full bg-zinc-700" />
              <span className="size-2.5 rounded-full bg-zinc-700" />
              <span className="size-2.5 rounded-full bg-accent-500/60" />
            </div>
            <div className="overflow-x-auto px-5 py-4">
              <div className="w-max min-w-full font-mono text-[12.5px] leading-[1.85]">
                {block.lines.map((line, i) => (
                  <Row key={i} line={line} />
                ))}
              </div>
            </div>
          </div>
        </div>
      );

    case 'code':
      return (
        <div>
          {block.title && <BlockTitle>{block.title}</BlockTitle>}
          <div className="overflow-x-auto rounded-xl border hairline bg-ink-900/70 px-5 py-4">
            <pre className="w-max min-w-full font-mono text-[12.5px] leading-[1.85]">
              {block.lines.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.startsWith('#')
                      ? 'text-zinc-600'
                      : line.trim()
                        ? 'text-zinc-200'
                        : ''
                  }
                >
                  {line || ' '}
                </div>
              ))}
            </pre>
          </div>
        </div>
      );

    case 'table':
      return (
        <div>
          {block.title && <BlockTitle>{block.title}</BlockTitle>}
          <div className="overflow-x-auto rounded-xl border hairline">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b hairline bg-ink-900/60">
                  {block.head.map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="border-b hairline last:border-0">
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className={`px-4 py-3 align-top text-[13px] leading-relaxed ${
                          j === 0 ? 'font-mono text-zinc-200' : 'text-zinc-400'
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'cards':
      return (
        <div>
          {block.title && <BlockTitle>{block.title}</BlockTitle>}
          <div className="grid gap-3 sm:grid-cols-2">
            {block.items.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border hairline bg-ink-900/40 px-5 py-4"
              >
                <p className="text-[14.5px] font-medium text-zinc-100">{item.title}</p>
                {item.tag && (
                  <div className="mt-2">
                    <CopyChip command={item.tag} />
                  </div>
                )}
                <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'chat':
      return (
        <div>
          <BlockTitle>{block.title}</BlockTitle>
          <div className="space-y-2.5">
            {block.turns.map((turn, i) => {
              const isDev = turn.who === 'dev';
              const TurnIcon = isDev ? UserIcon : RobotIcon;
              return (
                <div
                  key={i}
                  className={`rounded-xl border px-4 py-3.5 ${
                    isDev
                      ? 'border-accent-500/25 bg-accent-dim'
                      : 'hairline bg-ink-900/50'
                  }`}
                >
                  <p
                    className={`mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] ${
                      isDev ? 'text-accent-400' : 'text-zinc-500'
                    }`}
                  >
                    <TurnIcon size={13} />
                    {turn.name ?? (isDev ? 'dev' : 'agent')}
                  </p>
                  <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-zinc-300">
                    {turn.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      );
  }
}

// Los comandos de esta página van en su forma npx completa a propósito: se copian
// y se pegan sin haber instalado nada. El chip es la variante compacta de
// CopyCommand, para tags de tarjeta y hints de sección.
function CopyChip({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      onClick={copy}
      title={command}
      className="group inline-flex max-w-full items-start gap-2 rounded-lg border hairline bg-ink-900/70 px-2.5 py-1.5 text-left font-mono text-[11.5px] leading-snug text-accent-400 transition-colors hover:border-accent-500/40 active:scale-[0.985]"
    >
      <span className="min-w-0 break-all">{command}</span>
      {copied ? (
        <CheckIcon size={13} weight="bold" className="mt-px shrink-0 text-accent-400" />
      ) : (
        <CopyIcon
          size={13}
          className="mt-px shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300"
        />
      )}
    </button>
  );
}

function BlockTitle({ children }: { children: string }) {
  return (
    <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
      {children}
    </p>
  );
}

function Row({ line }: { line: TerminalLine }) {
  if (line.kind === 'cmd') {
    return (
      <div className="text-zinc-100">
        <span className="mr-2 text-accent-400">$</span>
        {line.text}
      </div>
    );
  }
  if (line.kind === 'prompt') {
    return (
      <div className="text-zinc-400">
        <span className="mr-2 text-accent-400">◆</span>
        {line.text}
      </div>
    );
  }
  if (line.kind === 'answer') {
    return <div className="pl-5 text-zinc-100">{line.text}</div>;
  }
  if (line.kind === 'ok') {
    return <div className="text-accent-400">{line.text}</div>;
  }
  return <div className="text-zinc-500">{line.text || ' '}</div>;
}
