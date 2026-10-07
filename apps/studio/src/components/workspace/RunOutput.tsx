'use client';

import { useT } from '@/lib/i18n/i18n';
import { useStudio } from '../BridgeProvider';

export function RunOutput() {
  const { t } = useT();
  const runs = useStudio((s) => s.runs);
  const list = Object.values(runs).slice(-3).reverse();
  if (list.length === 0) return null;
  return (
    <div className="space-y-2 border-t border-ink-800 px-5 py-3">
      {list.map((run) => (
        <div key={run.runId} className="rounded-lg border border-ink-800 bg-ink-950">
          <div className="flex items-center justify-between px-3 py-1.5 font-mono text-[11px] text-ink-300">
            <span>{t('run.title', { name: run.name, args: run.args.join(' ') })}</span>
            <span className={run.exitCode === null ? 'text-amberish' : run.exitCode === 0 ? 'text-accent-300' : 'text-roseish'}>
              {run.exitCode === null ? t('run.running') : t('run.exit', { code: run.exitCode })}
            </span>
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 pb-2 font-mono text-[11px]">{run.output}</pre>
        </div>
      ))}
    </div>
  );
}
