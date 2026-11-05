'use client';

import { Button } from '@e-burgos/tucu-ui';
import { Plus } from 'lucide-react';
import { useId } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { TypeOption } from '@/lib/wizard/catalog';
import { isRecommended } from '@/lib/wizard/recommendations';
import { canAddApp } from '@/lib/wizard/state';
import { RecommendedBadge } from './OptionCard';
import { useWizard } from './wizard-context';
import { blockReasonText, recommendationText, typeHint, typeLabel } from './wizard-text';

export function AppTypePicker({ option }: { option: TypeOption }) {
  const { t } = useT();
  const { catalog, state, dispatch, recommendations } = useWizard();
  const reasonId = useId();
  if (catalog === null) return null;
  const add = canAddApp(state, catalog);
  const blockedReason = option.blocked !== null ? blockReasonText(t, option.blocked) : !add.ok ? blockReasonText(t, add.reason) : null;
  const recommendation = recommendations.find((item) => item.kind === 'backend');
  const recommended = recommendation && isRecommended(recommendations, 'backend', option.type) ? recommendationText(t, recommendation) : null;
  const label = typeLabel(t, option.entry);
  return (
    <li data-type-option={option.type} className="flex items-start gap-3 rounded-lg border border-foreground/10 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 text-copy font-medium text-ink-50">{label}</span>
          {recommended !== null && <RecommendedBadge reason={recommended} />}
        </span>
        <span className="text-small text-ink-300">{typeHint(t, option.entry)}</span>
        <span className="text-meta text-ink-400">{t('wizard.type.stack', { stack: option.entry.stack })}</span>
        {blockedReason !== null && (
          <span id={reasonId} className="text-small text-amberish">
            {blockedReason}
          </span>
        )}
      </div>
      <Button
        type="button"
        size="tiny"
        variant="outline"
        color="gray"
        className="text-ui"
        disabled={blockedReason !== null}
        aria-describedby={blockedReason !== null ? reasonId : undefined}
        aria-label={t('wizard.apps.add', { type: label })}
        onClick={() => dispatch({ type: 'app-add', appType: option.type })}
      >
        <Plus aria-hidden size={14} />
      </Button>
    </li>
  );
}
