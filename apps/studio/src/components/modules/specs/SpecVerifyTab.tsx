'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { z } from 'zod';
import type { SpecSummary, VerifyLevel, VerifyResultSummary } from '@sdd-studio/protocol';
import { Button, EmptyState } from '@e-burgos/tucu-ui';
import { bridgeErrorText } from '@/lib/bridge/error-text';
import { BridgeError } from '@/lib/bridge/client';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import { agoText, formatDuration, KIT_EXECUTION, shortCommit, tailLines, verifyExitKind } from '@/lib/kit-execution';
import { useNav } from '@/lib/nav/use-nav';
import { currentCycleOf } from '@/lib/sdd-status';
import { useBridgeFeatures } from '@/lib/use-bridge-features';
import { useCollapsedState, type CollapsedState } from '@/lib/use-collapsed-state';
import { useBridge, useStudio } from '../../BridgeProvider';
import { CapabilityNotice } from '../../mission-control/CapabilityNotice';
import { focusRing } from '../../shell/shell-context';
import { CycleSelector, Muted, Section, StatusBadge } from './SpecParts';
import { effectiveCycle } from './specs-model';

const RunResult = z.object({ runId: z.string().min(1) });

const resultKey = (r: VerifyResultSummary) => `${r.app}:${r.level}:${r.unit}:${r.startedAt}`;

function VerifyResultRow({ result, nodeId, collapse }: { result: VerifyResultSummary; nodeId: string; collapse: CollapsedState }) {
  const { t } = useT();
  const collapsed = collapse.isCollapsed(nodeId, true);
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  const unit = `${result.app} · ${result.level} · ${result.unit}`;
  return (
    <li data-verify-result={resultKey(result)} className="flex flex-col">
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-label={t('kitexec.verify.detailToggle', { unit })}
        onClick={() => collapse.toggle(nodeId, true)}
        className={`${focusRing} flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-0.5 text-left hover:bg-ink-800`}
      >
        <Chevron aria-hidden size={14} className="shrink-0 text-ink-400" />
        <StatusBadge status={result.ok ? 'done' : 'blocked'} label={result.ok ? t('kitexec.verify.ok') : t('kitexec.verify.failed')} />
        <span className="min-w-0 flex-1 truncate font-mono text-copy text-ink-100">{unit}</span>
        <span className="shrink-0 font-mono text-meta text-ink-400">{shortCommit(result.commit)}</span>
        <span className="shrink-0 text-meta text-ink-400">{agoText(result.startedAt, Date.now(), t)}</span>
        <span className="shrink-0 text-meta text-ink-400">{formatDuration(result.durationMs)}</span>
        {result.reused && <span className="shrink-0 rounded-full bg-foreground/10 px-1.5 text-micro text-ink-300">{t('kitexec.verify.reused')}</span>}
      </button>
      {!collapsed && (
        <ul className="ml-6 flex flex-col gap-px border-l border-foreground/10 pl-2">
          {result.commands.map((command, index) => (
            <li key={`${command.command}:${index}`} className="flex min-h-6 items-center gap-2 font-mono text-meta text-ink-300">
              <span className="min-w-0 flex-1 truncate" title={command.command}>{command.command}</span>
              <span className="shrink-0">{command.skipped ? t('kitexec.verify.skipped') : t('kitexec.verify.exit', { code: command.exitCode ?? '—' })}</span>
              <span className="shrink-0">{formatDuration(command.durationMs)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function exitMessage(code: number, t: TFunction): string {
  const kind = verifyExitKind(code);
  return t(`kitexec.verify.exit.${kind}` as Parameters<TFunction>[0], { code });
}

function runErrorText(error: unknown, t: TFunction): string {
  if (error instanceof BridgeError && error.code === 'conflict') return t('kitexec.verify.busy');
  return bridgeErrorText(error, t);
}

function VerifyOutput({ runId, app, level }: { runId: string; app: string; level: VerifyLevel }) {
  const { t } = useT();
  const run = useStudio((s) => s.runs[runId]);
  const ref = useRef<HTMLPreElement>(null);
  const output = run?.output ?? '';
  useEffect(() => {
    const node = ref.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [output]);
  if (!run) return null;
  const exit = run.exitCode;
  return (
    <div data-testid="verify-run" className="mt-2 rounded-lg border border-ink-800 bg-ink-950">
      <div aria-live="polite" className={`px-3 py-1.5 font-mono text-meta ${exit === null ? 'text-amberish' : exit === 0 ? 'text-accent-300' : 'text-roseish'}`}>
        {exit === null ? t('kitexec.verify.running') : exitMessage(exit, t)}
      </div>
      <pre ref={ref} tabIndex={0} aria-label={t('kitexec.verify.output', { app, level })} className={`${focusRing} max-h-48 overflow-auto whitespace-pre-wrap px-3 pb-2 font-mono text-meta`}>
        {tailLines(output)}
      </pre>
    </div>
  );
}

export function SpecVerifyTab({ spec }: { spec: SpecSummary }) {
  const { t } = useT();
  const { client, store } = useBridge();
  const { supports } = useBridgeFeatures();
  const snapshot = useStudio((s) => s.snapshot);
  const specCycle = useNav((s) => s.specCycle);
  const setSpecCycle = useNav((s) => s.setSpecCycle);
  const collapse = useCollapsedState(snapshot?.project ?? '');
  const [active, setActive] = useState<{ runId: string; app: string; level: VerifyLevel } | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRun = useStudio((s) => (active ? s.runs[active.runId] : undefined));
  if (!snapshot) return null;

  const shown = effectiveCycle(snapshot.cycles, spec.id, specCycle);
  if (!shown) return <EmptyState size="sm" title={t('specs.tasks.noCycle')} />;
  const current = currentCycleOf(snapshot.cycles, spec.id);
  const results = shown.verifyResults ?? [];
  const config = snapshot.verifyConfig ?? [];
  const canRun = supports(KIT_EXECUTION);
  const running = starting || (active !== null && activeRun !== undefined && activeRun.exitCode === null);

  const run = async (app: string, level: VerifyLevel) => {
    setError(null);
    setStarting(true);
    try {
      const { runId } = RunResult.parse(await client.request({ cmd: 'kit.verify.run', app, level, spec: spec.id, cycle: shown.cycle }));
      store.getState().startRun({ runId, name: 'verify', args: [app, level] });
      setActive({ runId, app, level });
    } catch (e) {
      setError(runErrorText(e, t));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col">
      <CycleSelector cycles={snapshot.cycles} specId={spec.id} value={shown.cycle} current={current?.cycle ?? null} onChange={setSpecCycle} />
      {!canRun && <CapabilityNotice capabilities={[KIT_EXECUTION]} />}
      {canRun && (
        <Section title={t('kitexec.verify.run')}>
          {config.length === 0 ? (
            <Muted>{t('kitexec.verify.noConfig')}</Muted>
          ) : (
            <ul className="flex flex-col gap-1">
              {config.map((entry) => (
                <li key={entry.app} data-verify-app={entry.app} className="flex min-h-7 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-copy text-ink-100">{entry.app}</span>
                  {entry.levels.map((level) => (
                    <Button
                      key={level}
                      type="button"
                      size="tiny"
                      variant="transparent"
                      color="gray"
                      disabled={running}
                      aria-label={t('kitexec.verify.runLabel', { level, app: entry.app })}
                      onClick={() => void run(entry.app, level)}
                    >
                      {t(`kitexec.verify.${level}`)}
                    </Button>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {error && (
            <p role="alert" className="text-copy text-roseish">
              {error}
            </p>
          )}
          {active && <VerifyOutput runId={active.runId} app={active.app} level={active.level} />}
        </Section>
      )}
      <Section title={t('kitexec.verify.results')} count={results.length}>
        {results.length === 0 ? (
          <Muted>{t('kitexec.verify.noResults')}</Muted>
        ) : (
          <ul className="flex flex-col gap-px">
            {results.map((result) => (
              <VerifyResultRow key={resultKey(result)} result={result} nodeId={`specs:verify:${spec.id}:${shown.cycle}:${resultKey(result)}`} collapse={collapse} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
