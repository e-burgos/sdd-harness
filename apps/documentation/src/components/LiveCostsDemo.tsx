import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowCounterClockwiseIcon,
  PauseIcon,
  PlayIcon,
} from '@phosphor-icons/react';
import { useContent, useLang } from '../i18n';

const TRADITIONAL_COLOR = '#8b5cf6';
const AGENTIC_COLOR = '#34d399';

// Numeric telemetry of the simulated cycle — language-independent.
// The actor/feed texts for each step come from UI.live.demo.steps (same order).
const STEP_DATA = [
  { tokens: 0, agentic: 0, tasksDone: 0 },
  { tokens: 352_000, agentic: 1.68, tasksDone: 1 },
  { tokens: 960_000, agentic: 4.44, tasksDone: 2 },
  { tokens: 1_131_000, agentic: 5.21, tasksDone: 3 },
  { tokens: 1_131_000, agentic: 5.21, tasksDone: 3 },
];

const TRADITIONAL_COST = 1000;
const TOTAL_TASKS = 3;

function Kpi({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border hairline bg-ink-950/70 px-4 py-3">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={value}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className={`font-mono text-[17px] font-semibold ${
            accent ? 'text-accent-400' : 'text-zinc-100'
          }`}
        >
          {value}
        </motion.div>
      </AnimatePresence>
      <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.2em] text-zinc-600">
        {label}
      </div>
    </div>
  );
}

function CostBar({
  label,
  value,
  max,
  color,
  display,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  display: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[86px] shrink-0 font-mono text-[11px] text-zinc-400">
        {label}
      </span>
      <div className="h-3.5 flex-1 overflow-hidden rounded-r">
        <motion.div
          className="h-full rounded-r"
          style={{ background: color }}
          animate={{ width: `${Math.max((value / max) * 100, 0.5)}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 16 }}
        />
      </div>
      <span className="w-[92px] shrink-0 text-right font-mono text-[11px] text-zinc-200">
        {display}
      </span>
    </div>
  );
}

export function LiveCostsDemo() {
  const { UI } = useContent();
  const { lang } = useLang();
  const demo = UI.live.demo;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const steps = useMemo(
    () =>
      STEP_DATA.map((data, i) => ({
        ...data,
        actor: demo.steps[i].actor,
        feed: demo.steps[i].feed,
      })),
    [demo],
  );
  const done = index >= steps.length - 1;

  const { tokensFormat, moneyFormat } = useMemo(() => {
    const locale = lang === 'es' ? 'es-AR' : 'en-US';
    return {
      tokensFormat: new Intl.NumberFormat(locale, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
      moneyFormat: new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }),
    };
  }, [lang]);

  useEffect(() => {
    if (!playing || done) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), 2100);
    return () => clearTimeout(timer);
  }, [playing, index, done]);

  const step = steps[index];
  const feed = useMemo(() => steps.slice(0, index + 1), [steps, index]);
  const saving = TRADITIONAL_COST - step.agentic;
  const savingPct = Math.round((saving / TRADITIONAL_COST) * 100);

  return (
    <div className="overflow-hidden rounded-2xl border hairline bg-ink-900/70 shadow-[0_32px_64px_-32px_rgba(0,0,0,0.7)]">
      <div className="flex items-center justify-between border-b hairline px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-accent-400" />
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-accent-300">
            {demo.live}
          </span>
          <span className="hidden font-mono text-[10.5px] text-zinc-600 sm:inline">
            {demo.tagline}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!done && (
            <button
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? demo.pause : demo.resume}
              className="rounded-lg border hairline p-1.5 text-zinc-400 transition-colors hover:text-accent-300"
            >
              {playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
            </button>
          )}
          <button
            onClick={() => {
              setIndex(0);
              setPlaying(true);
            }}
            aria-label={demo.replay}
            className="inline-flex items-center gap-1.5 rounded-lg border hairline px-2.5 py-1.5 font-mono text-[11px] text-zinc-400 transition-colors hover:text-accent-300"
          >
            <ArrowCounterClockwiseIcon size={12} />
            {demo.replay}
          </button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[7fr_6fr]">
        <div className="border-b hairline p-5 lg:border-b-0 lg:border-r">
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi
              value={`${step.tasksDone}/${TOTAL_TASKS}`}
              label={demo.kpiTasks}
            />
            <Kpi value={tokensFormat.format(step.tokens)} label={demo.kpiTokens} />
            <Kpi
              value={moneyFormat.format(step.agentic)}
              label={demo.kpiCost}
            />
            <Kpi
              value={done ? `${savingPct}%` : '…'}
              label={demo.kpiSaving}
              accent={done}
            />
          </div>

          <div className="space-y-2.5 rounded-xl border hairline bg-ink-950/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                spec-eburgos-001-auth
              </span>
              <span className="flex gap-3 font-mono text-[10px] text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-sm"
                    style={{ background: TRADITIONAL_COLOR }}
                  />
                  {demo.legendTraditional}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-sm"
                    style={{ background: AGENTIC_COLOR }}
                  />
                  {demo.legendAgentic}
                </span>
              </span>
            </div>
            <CostBar
              label={demo.legendTraditional}
              value={TRADITIONAL_COST}
              max={TRADITIONAL_COST}
              color={TRADITIONAL_COLOR}
              display={moneyFormat.format(TRADITIONAL_COST)}
            />
            <CostBar
              label={demo.legendAgentic}
              value={Math.max(step.agentic, TRADITIONAL_COST * 0.004)}
              max={TRADITIONAL_COST}
              color={AGENTIC_COLOR}
              display={moneyFormat.format(step.agentic)}
            />
            <p className="pt-2 font-mono text-[10.5px] leading-relaxed text-zinc-600">
              {demo.footnote}
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between p-5">
          <div>
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              {demo.activity}
            </p>
            <div className="space-y-2">
              {feed.map((entry, i) => (
                <motion.div
                  key={entry.feed}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  className={`font-mono text-[11.5px] leading-relaxed ${
                    i === feed.length - 1 ? 'text-zinc-200' : 'text-zinc-500'
                  }`}
                >
                  <span className="text-accent-400">
                    {entry.actor}
                  </span>{' '}
                  <span className="text-zinc-600">·</span> {entry.feed}
                </motion.div>
              ))}
            </div>
          </div>
          <AnimatePresence>
            {done && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 rounded-xl border border-accent-500/30 bg-accent-dim px-4 py-3 text-[12.5px] leading-relaxed text-zinc-200"
              >
                {demo.donePre}
                <em>{demo.doneEm}</em>
                {demo.doneMid}
                <span className="font-mono text-accent-300">
                  {moneyFormat.format(saving)} ({savingPct}%)
                </span>
                {demo.donePost}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
