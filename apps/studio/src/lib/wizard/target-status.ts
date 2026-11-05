import type { TargetCheck } from '@sdd-studio/protocol';

export type TargetTone = 'ok' | 'warn' | 'blocked';

export interface TargetStatusView {
  textKey: string;
  tone: TargetTone;
  blocking: boolean;
}

const INVALID_REASONS = new Set(['relative', 'dot-segment', 'bad-char', 'reserved-name', 'unc', 'too-long']);

export function targetStatusView(check: TargetCheck): TargetStatusView {
  switch (check.state) {
    case 'missing':
      return { textKey: 'wizard.target.status.missing', tone: 'ok', blocking: false };
    case 'empty':
      return { textKey: 'wizard.target.status.empty', tone: 'ok', blocking: false };
    case 'tolerated':
      return { textKey: 'wizard.target.status.tolerated', tone: 'warn', blocking: false };
    case 'conflicting':
      return { textKey: 'wizard.target.status.conflicting', tone: 'blocked', blocking: true };
    case 'not-directory':
      return { textKey: 'wizard.target.status.not-directory', tone: 'blocked', blocking: true };
    case 'not-writable':
      return { textKey: 'wizard.target.status.not-writable', tone: 'blocked', blocking: true };
    case 'outside-allowed':
      return {
        textKey: check.reason === 'base-itself' ? 'wizard.target.status.base-itself' : 'wizard.target.status.outside',
        tone: 'blocked',
        blocking: true,
      };
    case 'invalid':
      return {
        textKey: check.reason !== null && INVALID_REASONS.has(check.reason) ? `wizard.target.invalid.${check.reason}` : 'wizard.target.invalid.other',
        tone: 'blocked',
        blocking: true,
      };
  }
}

export const isGeneratableTarget = (check: TargetCheck): boolean => !targetStatusView(check).blocking;
