import type { ConfigIssue } from '@sdd-studio/protocol';
import type { WizardState, WizardStepId } from './state';

export const ISSUE_TEXT_CODES = [
  'ml-not-python',
  'tucu-ui-not-frontend',
  'workspace-only-type',
  'shell-not-mfe',
  'shell-missing',
  'shell-not-found',
  'shell-not-mfe-shell',
  'shell-ambiguous',
  'standalone-app-count',
  'duplicate-app-name',
  'duplicate-lib-name',
  'port-conflict',
  'standalone-libs-ignored',
] as const;

export const BLOCKING_WARNING_CODES: readonly string[] = ['port-conflict'];

export const issueTextKey = (code: string): string => `wizard.issue.${code}`;

export type IssueTranslator = (key: string, params: Record<string, string | number>) => string | null | undefined;

export interface MappedIssue {
  severity: ConfigIssue['severity'];
  code: string;
  step: WizardStepId;
  field: string | null;
  text: string;
  translated: boolean;
  blocking: boolean;
}

export const isBlockingIssue = (issue: Pick<ConfigIssue, 'severity' | 'code'>): boolean =>
  issue.severity === 'error' || BLOCKING_WARNING_CODES.includes(issue.code);

export const issuesBlockGeneration = (issues: readonly ConfigIssue[]): boolean => issues.some(isBlockingIssue);

function locate(issue: ConfigIssue, state: WizardState): { step: WizardStepId; field: string | null; app: string | null } {
  const [head, index] = issue.path;
  const field = issue.path.length > 0 ? issue.path.join('.') : null;
  switch (head) {
    case 'project':
    case 'mode':
      return { step: 'shape', field, app: null };
    case 'apps': {
      const app = typeof index === 'number' ? state.apps[index] : undefined;
      if (!app) return { step: 'front', field, app: null };
      return { step: app.role === 'frontend' ? 'front' : 'back', field, app: app.name };
    }
    case 'libs':
    case 'services':
    case 'sdd':
      return { step: 'extras', field, app: null };
    default:
      return { step: 'summary', field, app: null };
  }
}

export function mapIssue(issue: ConfigIssue, state: WizardState, translate?: IssueTranslator): MappedIssue {
  const where = locate(issue, state);
  const params: Record<string, string | number> = { message: issue.message };
  if (where.app !== null) params.app = where.app;
  const translated = (translate && ISSUE_TEXT_CODES.includes(issue.code as (typeof ISSUE_TEXT_CODES)[number])
    ? translate(issueTextKey(issue.code), params)
    : null) ?? null;
  return {
    severity: issue.severity,
    code: issue.code,
    step: where.step,
    field: where.field,
    text: translated ?? issue.message,
    translated: translated !== null,
    blocking: isBlockingIssue(issue),
  };
}

export const mapIssues = (issues: readonly ConfigIssue[], state: WizardState, translate?: IssueTranslator): MappedIssue[] =>
  issues.map((issue) => mapIssue(issue, state, translate));

export const issuesForStep = (mapped: readonly MappedIssue[], step: WizardStepId): MappedIssue[] =>
  mapped.filter((issue) => issue.step === step);

export const issuesForField = (mapped: readonly MappedIssue[], field: string): MappedIssue[] =>
  mapped.filter((issue) => issue.field === field);
