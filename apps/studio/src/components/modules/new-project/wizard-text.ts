import type { Dict } from '@/lib/i18n/es';
import type { TFunction } from '@/lib/i18n/i18n';
import type { BlockReason, CatalogAppType } from '@/lib/wizard/catalog';
import type { FieldError } from '@/lib/wizard/field-checks';
import type { IssueTranslator } from '@/lib/wizard/issues';
import type { Recommendation } from '@/lib/wizard/recommendations';
import type { AddAppBlock, WizardStepId } from '@/lib/wizard/state';
import { fieldKind, type StepBlocker } from '@/lib/wizard/step-gate';

export function lookupText(t: TFunction, key: string, vars?: Record<string, string | number>): string | null {
  const text = t(key as keyof Dict, vars);
  return text === key ? null : text;
}

export const issueTranslator =
  (t: TFunction): IssueTranslator =>
  (key, params) =>
    lookupText(t, key, params);

export function fieldErrorText(t: TFunction, error: FieldError): string {
  const kind = fieldKind(error.field);
  const suffix = kind === 'apps' ? (error.step === 'front' ? 'front' : 'back') : kind;
  return lookupText(t, `wizard.err.${error.code}.${suffix}`, error.params) ?? error.code;
}

export function blockerText(t: TFunction, blocker: StepBlocker): string {
  switch (blocker.source) {
    case 'field':
      return fieldErrorText(t, blocker.error);
    case 'issue':
      return blocker.issue.text;
    case 'pairing':
      return t(`wizard.err.${blocker.code}` as keyof Dict);
  }
}

export const blockReasonText = (t: TFunction, reason: BlockReason | AddAppBlock): string => t(`wizard.block.${reason}` as keyof Dict);

export const stepLabel = (t: TFunction, step: WizardStepId): string => t(`wizard.step.${step}` as keyof Dict);

export const typeLabel = (t: TFunction, entry: Pick<CatalogAppType, 'type' | 'label'>): string =>
  lookupText(t, `wizard.type.${entry.type}.label`) ?? entry.label;

export const typeHint = (t: TFunction, entry: Pick<CatalogAppType, 'type' | 'hint'>): string =>
  lookupText(t, `wizard.type.${entry.type}.hint`) ?? entry.hint;

export const recommendationText = (t: TFunction, recommendation: Recommendation): string =>
  t(`wizard.recommendation.${recommendation.reason}` as keyof Dict);
