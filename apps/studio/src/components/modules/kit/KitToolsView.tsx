'use client';

import { ConfirmDialog, SegmentedControl, Switch } from '@e-burgos/tucu-ui';
import { type ReactNode } from 'react';
import type { KitToolsState } from '@sdd-studio/protocol';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { CenterFrame, Notice } from './KitParts';
import { toolValueOf, useKitTools, type PendingToolChange, type ToolId, type ToolValue, type ToolsNotice } from './use-kit-tools';

const valueLabel = (tool: ToolId, value: ToolValue | null, t: TFunction): string => {
  if (value === null) return '—';
  if (tool === 'gate') return t(value === 'warn' ? 'module.kit.tools.warn' : 'module.kit.tools.block');
  return t(value ? 'module.kit.tools.on' : 'module.kit.tools.off');
};

const toolLabel = (tool: ToolId, t: TFunction): string =>
  t(tool === 'rtk' ? 'module.kit.tools.rtk.label' : tool === 'mod' ? 'module.kit.tools.mod.label' : 'module.kit.tools.gate.label');

const isRisky = (change: PendingToolChange): boolean => (change.tool === 'gate' && change.to === 'warn') || (change.tool === 'mod' && change.to === false);

function ToolRow({ label, description, children }: { label: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-foreground/10 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-copy font-medium text-ink-100">{label}</p>
        <p className="text-small text-ink-400">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Unknown() {
  const { t } = useT();
  return (
    <span data-testid="kit-tool-unknown" className="text-meta text-ink-400">
      {t('module.kit.tools.unknown')}
    </span>
  );
}

function noticeText(notice: ToolsNotice, t: TFunction): { tone: 'info' | 'warning' | 'error'; text: string } {
  if (notice.kind === 'applied') {
    const vars = { tool: toolLabel(notice.tool, t), to: valueLabel(notice.tool, notice.to, t) };
    return { tone: 'info', text: t(notice.changed ? 'module.kit.tools.notice.applied' : 'module.kit.tools.notice.unchanged', vars) };
  }
  const text = t(`module.kit.tools.notice.${notice.kind}`, { message: notice.message }).trim();
  return { tone: notice.kind === 'conflict' ? 'warning' : 'error', text };
}

function ConfirmChange({ pending, busy, onConfirm, onCancel }: { pending: PendingToolChange | null; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useT();
  const tool = pending ? toolLabel(pending.tool, t) : '';
  const risky = pending ? isRisky(pending) : false;
  return (
    <ConfirmDialog
      isOpen={pending !== null}
      title={t('module.kit.tools.confirm.title', { tool })}
      description={pending ? t('module.kit.tools.confirm.change', { tool, from: valueLabel(pending.tool, pending.from, t), to: valueLabel(pending.tool, pending.to, t) }) : undefined}
      tone={risky ? 'warning' : 'info'}
      loading={busy}
      confirmLabel={t('module.kit.tools.confirm.confirm')}
      cancelLabel={t('module.kit.tools.confirm.cancel')}
      onConfirm={onConfirm}
      onCancel={onCancel}
      data-testid="kit-tools-confirm"
    >
      <div className="flex flex-col gap-2 text-small text-ink-300">
        <p>{t('module.kit.tools.confirm.file')}</p>
        {pending && risky && <p className="text-ink-100">{t(pending.tool === 'gate' ? 'module.kit.tools.confirm.warnGate' : 'module.kit.tools.confirm.warnMod')}</p>}
      </div>
    </ConfirmDialog>
  );
}

export function KitToolsView() {
  const { t } = useT();
  const openHome = useNav((s) => s.openHome);
  const { tools, reason, pending, busy, notice, ask, confirm, cancel, dismissNotice } = useKitTools();
  const disabled = reason !== null || busy;
  const state: KitToolsState | undefined = tools;
  const gate = state?.gate ?? null;
  const shown = notice ? noticeText(notice, t) : null;
  return (
    <CenterFrame title={t('module.kit.tools.title')}>
      <div className="flex max-w-3xl flex-col gap-3">
        <p className="text-small text-ink-300">{t('module.kit.tools.intro')}</p>
        {reason !== null && (
          <Notice testId="kit-tools-readonly" tone={reason === 'offline' ? 'warning' : 'info'}>
            {t(`module.kit.tools.readOnly.${reason}`)}
          </Notice>
        )}
        {state?.modEnabled && !state.modLinked && (
          <Notice testId="kit-tools-mod-warning" tone="warning" role="alert">
            {t('module.kit.tools.modNotLinked')}
          </Notice>
        )}
        {shown && (
          <Notice testId="kit-tools-notice" tone={shown.tone} role={shown.tone === 'error' ? 'alert' : 'status'} onDismiss={dismissNotice} dismissLabel={t('module.kit.tools.notice.dismiss')}>
            {shown.text}
          </Notice>
        )}
        <div className="rounded-xl border border-foreground/10 bg-ink-900 px-4">
          <ToolRow label={t('module.kit.tools.rtk.label')} description={t('module.kit.tools.rtk.desc')}>
            {state?.rtkEnabled == null ? <Unknown /> : <Switch checked={state.rtkEnabled} disabled={disabled} aria-label={t('module.kit.tools.rtk.label')} onChange={(checked) => ask('rtk', checked)} />}
          </ToolRow>
          <ToolRow label={t('module.kit.tools.mod.label')} description={t('module.kit.tools.mod.desc')}>
            {state?.modEnabled == null ? <Unknown /> : <Switch checked={state.modEnabled} disabled={disabled} aria-label={t('module.kit.tools.mod.label')} onChange={(checked) => ask('mod', checked)} />}
          </ToolRow>
          <ToolRow label={t('module.kit.tools.gate.label')} description={t('module.kit.tools.gate.desc')}>
            {gate === null ? (
              <Unknown />
            ) : (
              <SegmentedControl
                size="sm"
                aria-label={t('module.kit.tools.gate.group')}
                disabled={disabled}
                value={gate}
                options={[
                  { value: 'block', label: t('module.kit.tools.block') },
                  { value: 'warn', label: t('module.kit.tools.warn') },
                ]}
                onChange={(next) => next !== toolValueOf(state ?? EMPTY, 'gate') && ask('gate', next)}
              />
            )}
          </ToolRow>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-small text-ink-400">
          <span>{t('module.kit.tools.log')}</span>
          <button
            type="button"
            onClick={() => openHome({ kind: 'channel', channelId: 'general' })}
            className="rounded-md px-1 text-accent-300 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-400"
          >
            {t('module.kit.tools.logOpen')}
          </button>
        </p>
      </div>
      <ConfirmChange pending={pending} busy={busy} onConfirm={() => void confirm()} onCancel={cancel} />
    </CenterFrame>
  );
}

const EMPTY: KitToolsState = { status: 'missing', rtkEnabled: null, modEnabled: null, gate: null, modLinked: false, revision: null };
