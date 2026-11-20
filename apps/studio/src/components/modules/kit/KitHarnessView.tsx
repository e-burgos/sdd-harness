'use client';

import { EmptyState } from '@e-burgos/tucu-ui';
import { useState, type ReactNode } from 'react';
import type { KitEntry } from '@sdd-studio/protocol';
import { formatBytes } from '@/lib/format';
import { useT } from '@/lib/i18n/i18n';
import { matchesQuery } from '@/lib/nav/search';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { PANEL_TYPE } from '@/lib/typography-tokens';
import { PanelRow } from '../../shell/PanelRow';
import { CenterFrame, FileViewer, IndexGate, Notice, SplitPane, fileLabel } from './KitParts';
import { CopyText } from './CopyText';
import { HARNESS_CORE_LIMIT_BYTES, SPLIT_PROJECT_RECIPE, harnessBytes, harnessModel, type HarnessModel } from './kit-model';

function SizeMeter({ bytes, limit }: { bytes: number; limit: number }) {
  const over = bytes > limit;
  const percent = Math.min(100, Math.round((bytes / limit) * 100));
  return (
    <span data-testid="harness-size" data-over={over ? 'true' : 'false'} className="inline-flex items-center gap-1.5">
      <span aria-hidden className="h-1 w-10 overflow-hidden rounded-full bg-ink-800">
        <span className={`block h-full ${over ? 'bg-amberish' : 'bg-accent-400'}`} style={{ width: `${percent}%` }} />
      </span>
      <span className={over ? 'text-amberish' : undefined}>{formatBytes(bytes)}</span>
    </span>
  );
}

function ListGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <p className={`${PANEL_TYPE.group} px-2 pb-1 pt-2`}>{title}</p>
      {children}
    </>
  );
}

function SplitAdvice({ model }: { model: HarnessModel }) {
  const { t } = useT();
  return (
    <Notice tone="warning" role="status" testId="harness-split-advice">
      <span className="block">{t('module.kit.harness.advice')}</span>
      <span className="block text-ink-300">{model.oversized ? t('module.kit.harness.oversized', { limit: formatBytes(HARNESS_CORE_LIMIT_BYTES) }) : t('module.kit.harness.noProject')}</span>
      <span className="mt-1 flex items-center gap-2">
        <code className="min-w-0 truncate rounded bg-ink-950 px-1.5 py-0.5 font-mono text-meta text-ink-100">{SPLIT_PROJECT_RECIPE}</code>
        <CopyText text={SPLIT_PROJECT_RECIPE} label={t('module.kit.harness.copyRecipe')} doneLabel={t('module.kit.cap.copied')} />
      </span>
    </Notice>
  );
}

function HarnessBrowser({ model }: { model: HarnessModel }) {
  const { t } = useT();
  const [chosen, setChosen] = useState<string | null>(null);
  const [query] = useModuleQuery('kit');
  const match = (entry: KitEntry) => matchesQuery(query, fileLabel(entry), entry.trigger, entry.description);
  const core = model.core.filter(match);
  const project = model.project && match(model.project) ? model.project : null;
  const rules = model.rules.filter(match);
  const selectable = [...core, ...(project ? [project] : []), ...rules];
  const current = selectable.find((entry) => entry.path === chosen) ?? selectable[0] ?? null;
  const row = (entry: KitEntry, meta: ReactNode, label = fileLabel(entry)) => (
    <PanelRow key={entry.path} label={label} meta={meta} title={entry.description ?? entry.path} selected={current?.path === entry.path} onClick={() => setChosen(entry.path)} />
  );
  return (
    <SplitPane
      listClassName="md:w-72"
      resetKey={current?.path ?? ''}
      list={
        <nav aria-label={t('module.kit.index.files', { title: t('module.kit.harness.title') })} className="flex flex-col gap-px">
          {core.length > 0 && <ListGroup title={t('module.kit.harness.core')}>{core.map((entry) => row(entry, <SizeMeter bytes={harnessBytes(entry)} limit={HARNESS_CORE_LIMIT_BYTES} />))}</ListGroup>}
          <ListGroup title={t('module.kit.harness.project')}>
            {project ? row(project, formatBytes(harnessBytes(project))) : model.project === null ? <PanelRow label="project.md" meta={t('module.kit.harness.missing')} /> : null}
          </ListGroup>
          {rules.length > 0 && (
            <ListGroup title={t('module.kit.harness.rules')}>
              {rules.map((entry) => (
                <div key={entry.path} data-harness-rule={fileLabel(entry)} className="flex flex-col">
                  {row(entry, <span className="inline-flex items-center gap-1.5">{entry.trigger && <span className="rounded-full bg-foreground/10 px-1.5 text-micro text-ink-300">{entry.trigger}</span>}{formatBytes(harnessBytes(entry))}</span>)}
                  {entry.description && <p className="truncate px-2 pb-1 text-meta text-ink-400">{entry.description}</p>}
                </div>
              ))}
            </ListGroup>
          )}
        </nav>
      }
    >
      {current ? <FileViewer key={current.path} path={current.path} mode="markdown" /> : <EmptyState size="sm" title={t('module.kit.harness.empty')} />}
    </SplitPane>
  );
}

export function KitHarnessView() {
  const { t } = useT();
  return (
    <CenterFrame title={t('module.kit.harness.title')} scroll={false}>
      <IndexGate>
        {(entries) => {
          const model = harnessModel(entries);
          if (model.core.length === 0 && model.project === null && model.rules.length === 0) return <EmptyState size="sm" title={t('module.kit.index.empty')} />;
          return (
            <>
              {model.needsSplit && <SplitAdvice model={model} />}
              <HarnessBrowser model={model} />
            </>
          );
        }}
      </IndexGate>
    </CenterFrame>
  );
}
