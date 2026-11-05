'use client';

import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import { ROW_ICON } from '@/lib/typography-tokens';
import { targetStatusView, type TargetTone } from '@/lib/wizard/target-status';
import type { TargetCheckState } from '@/lib/wizard/use-target-check';
import { lookupText } from './wizard-text';
import { useWizard } from './wizard-context';

const TONE_ICON = { ok: CircleCheck, warn: TriangleAlert, blocked: CircleAlert } as const;
const TONE_CLASS: Record<TargetTone, string> = { ok: 'text-emerald-400', warn: 'text-amberish', blocked: 'text-roseish' };

export function TargetStatus({ state }: { state: TargetCheckState }) {
  const { t } = useT();
  const { catalog } = useWizard();
  if (state.status === 'idle') {
    return <p className="text-small text-ink-400">{t('wizard.target.status.idle')}</p>;
  }
  if (state.status === 'checking') {
    return (
      <p role="status" className="text-small text-ink-400">
        {t('wizard.target.status.checking')}
      </p>
    );
  }
  if (state.status === 'error' || state.check === null) {
    return (
      <p role="alert" className="text-small text-roseish">
        {t('wizard.target.status.error', { error: state.error ?? '' })}
      </p>
    );
  }
  const check = state.check;
  const view = targetStatusView(check);
  const Icon = TONE_ICON[view.tone];
  const vars = { count: check.entries?.count ?? 0, names: (check.entries?.conflicting ?? []).join(', ') };
  const tolerated = catalog?.targetDir.tolerated.join(', ') ?? '';
  return (
    <div data-testid="target-status" data-state={check.state} data-tone={view.tone} role="status" className="flex flex-col gap-1">
      <p className={`flex items-start gap-2 text-small ${TONE_CLASS[view.tone]}`}>
        <Icon aria-hidden size={ROW_ICON} className="mt-px shrink-0" />
        <span>{lookupText(t, view.textKey, vars) ?? check.state}</span>
      </p>
      {check.state === 'conflicting' && <p className="text-small text-ink-300">{t('wizard.target.status.conflictingHint', { tolerated })}</p>}
      {check.insideProject && (
        <p className="flex items-start gap-2 text-small text-amberish">
          <TriangleAlert aria-hidden size={ROW_ICON} className="mt-px shrink-0" />
          <span>{t('wizard.target.insideProject')}</span>
        </p>
      )}
    </div>
  );
}
