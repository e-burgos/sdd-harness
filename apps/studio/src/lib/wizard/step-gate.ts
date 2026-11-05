import type { ConfigCatalog } from '@sdd-studio/protocol';
import { MFE_SHELL_TYPE } from './catalog';
import { stepErrors, type FieldError } from './field-checks';
import type { MappedIssue } from './issues';
import { stepApplies, type WizardState, type WizardStepId } from './state';

export const MFE_TYPE = 'mfe';

export type FieldKind = 'scope' | 'mode' | 'name' | 'description' | 'package-scope' | 'author' | 'port' | 'apps' | 'other';

export type PairingCode = 'mfe-needs-shell' | 'shell-needs-mfe';

export type StepBlocker =
  | { source: 'field'; field: string; error: FieldError }
  | { source: 'issue'; field: string | null; issue: MappedIssue }
  | { source: 'pairing'; field: string; code: PairingCode };

export function fieldKind(field: string): FieldKind {
  if (field === 'scope') return 'scope';
  if (field === 'mode') return 'mode';
  if (field === 'apps') return 'apps';
  if (field === 'project.description') return 'description';
  if (field === 'project.packageScope') return 'package-scope';
  if (field === 'sdd.author') return 'author';
  if (field.endsWith('.port')) return 'port';
  if (field === 'project.name' || field.endsWith('.name')) return 'name';
  return 'other';
}

export const fieldDomId = (field: string): string => `wizard-field-${field.replace(/[^a-zA-Z0-9]+/g, '-')}`;

export function pairingBlockers(state: WizardState): StepBlocker[] {
  const shells = state.apps.filter((app) => app.type === MFE_SHELL_TYPE).length;
  const mfes = state.apps.filter((app) => app.type === MFE_TYPE).length;
  const blockers: StepBlocker[] = [];
  if (mfes > 0 && shells === 0) blockers.push({ source: 'pairing', field: 'apps', code: 'mfe-needs-shell' });
  if (shells > 0 && mfes === 0) blockers.push({ source: 'pairing', field: 'apps', code: 'shell-needs-mfe' });
  return blockers;
}

export function stepBlockers(
  state: WizardState,
  catalog: ConfigCatalog,
  step: WizardStepId,
  issues: readonly MappedIssue[] = [],
): StepBlocker[] {
  if (!stepApplies(state.scope, step)) return [];
  const fields = stepErrors(state, catalog, step);
  const blockers: StepBlocker[] = fields.map((error) => ({ source: 'field', field: error.field, error }));
  const pairing = step === 'front' ? pairingBlockers(state) : [];
  blockers.push(...pairing);
  const covered = new Set(fields.map((error) => error.field));
  const pairedNeedsShell = pairing.some((blocker) => blocker.source === 'pairing' && blocker.code === 'mfe-needs-shell');
  for (const issue of issues) {
    if (!issue.blocking || issue.step !== step) continue;
    if (issue.field !== null && covered.has(issue.field)) continue;
    if (pairedNeedsShell && issue.code === 'shell-missing') continue;
    blockers.push({ source: 'issue', field: issue.field, issue });
  }
  return blockers;
}
