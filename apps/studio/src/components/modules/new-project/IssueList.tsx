'use client';

import { CircleAlert, TriangleAlert } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import { ROW_ICON } from '@/lib/typography-tokens';
import { focusRing } from '../../shell/shell-context';
import { useWizard } from './wizard-context';

export function IssueList() {
  const { t } = useT();
  const { issues, focusField, validation } = useWizard();
  return (
    <div className="flex flex-col gap-2">
      {validation.status === 'validating' && (
        <p role="status" className="text-small text-ink-400">
          {t('wizard.right.validating')}
        </p>
      )}
      {validation.status === 'error' && (
        <p role="alert" className="text-small text-roseish">
          {t('wizard.right.validationError', { error: validation.error ?? '' })}
        </p>
      )}
      {issues.length === 0 ? (
        <p className="text-small text-ink-400">{t('wizard.right.noIssues')}</p>
      ) : (
        <ul aria-label={t('wizard.right.issues')} className="flex flex-col gap-px">
          {issues.map((issue) => {
            const Icon = issue.severity === 'error' ? CircleAlert : TriangleAlert;
            return (
              <li key={issue.key} data-severity={issue.severity}>
                <button
                  type="button"
                  aria-label={t('wizard.right.goTo', { text: issue.text })}
                  onClick={() => focusField(issue.step, issue.field)}
                  className={`${focusRing} flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-small hover:bg-ink-800`}
                >
                  <Icon aria-hidden size={ROW_ICON} className={`mt-px shrink-0 ${issue.severity === 'error' ? 'text-roseish' : 'text-amberish'}`} />
                  <span className="min-w-0 text-ink-100">{issue.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
