import type { ConfigCatalog } from '@sdd-studio/protocol';
import { libsAllowed, MFE_SHELL_TYPE } from './catalog';
import { roleInScope, stepApplies, type WizardApp, type WizardState, type WizardStepId } from './state';

export type FieldCheckCode =
  | 'required'
  | 'pattern'
  | 'not-integer'
  | 'out-of-range'
  | 'duplicate'
  | 'port-conflict'
  | 'choice-required'
  | 'app-required';

export interface FieldCheck {
  code: FieldCheckCode;
  params: Record<string, string | number>;
}

export interface FieldError extends FieldCheck {
  step: WizardStepId;
  field: string;
}

const compiled = new Map<string, RegExp | null>();

function patternOf(source: string): RegExp | null {
  const cached = compiled.get(source);
  if (cached !== undefined) return cached;
  let regex: RegExp | null = null;
  try {
    regex = new RegExp(source);
  } catch {
    regex = null;
  }
  compiled.set(source, regex);
  return regex;
}

const fail = (code: FieldCheckCode, params: Record<string, string | number> = {}): FieldCheck => ({ code, params });

function checkAgainst(value: string, source: string): FieldCheck | null {
  if (value === '') return fail('required');
  const regex = patternOf(source);
  return regex && !regex.test(value) ? fail('pattern') : null;
}

export const checkProjectName = (value: string, catalog: ConfigCatalog): FieldCheck | null => checkAgainst(value, catalog.patterns.name);
export const checkAppName = checkProjectName;
export const checkLibName = checkProjectName;
export const checkPackageScope = (value: string, catalog: ConfigCatalog): FieldCheck | null =>
  checkAgainst(value, catalog.patterns.packageScope);

export const checkDescription = (value: string): FieldCheck | null => (value.trim() === '' ? fail('required') : null);

export function checkAuthor(value: string, catalog: ConfigCatalog): FieldCheck | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const regex = patternOf(catalog.patterns.author);
  return regex && !regex.test(trimmed) ? fail('pattern') : null;
}

export function checkPort(text: string, catalog: ConfigCatalog): FieldCheck | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const { min, max } = catalog.portRange;
  if (!/^\d+$/.test(trimmed)) return fail('not-integer', { min, max });
  const value = Number(trimmed);
  return value < min || value > max ? fail('out-of-range', { min, max }) : null;
}

export const explicitPortOf = (app: WizardApp, catalog: ConfigCatalog): number | null =>
  checkPort(app.portText, catalog) === null && app.portText.trim() !== '' ? Number(app.portText.trim()) : null;

const stepOfApp = (app: WizardApp): WizardStepId => (app.role === 'frontend' ? 'front' : 'back');

function push(errors: FieldError[], step: WizardStepId, field: string, check: FieldCheck | null): void {
  if (check) errors.push({ step, field, ...check });
}

function appErrors(state: WizardState, catalog: ConfigCatalog, errors: FieldError[]): void {
  state.apps.forEach((app, index) => {
    const step = stepOfApp(app);
    push(errors, step, `apps.${index}.name`, checkAppName(app.name, catalog));
    push(errors, step, `apps.${index}.port`, checkPort(app.portText, catalog));
    const sameName = state.apps.find((other, otherIndex) => otherIndex !== index && other.name === app.name);
    if (sameName && app.name !== '') push(errors, step, `apps.${index}.name`, fail('duplicate', { name: app.name }));
    const port = explicitPortOf(app, catalog);
    if (port !== null) {
      const clash = state.apps.find((other, otherIndex) => otherIndex !== index && explicitPortOf(other, catalog) === port);
      if (clash) push(errors, step, `apps.${index}.port`, fail('port-conflict', { other: clash.name, port }));
    }
  });
}

function libErrors(state: WizardState, catalog: ConfigCatalog, errors: FieldError[]): void {
  if (!libsAllowed(catalog, state.mode)) return;
  state.libs.forEach((lib, index) => {
    push(errors, 'extras', `libs.${index}.name`, checkLibName(lib.name, catalog));
    const clash = state.libs.some((other, otherIndex) => otherIndex !== index && other.name === lib.name);
    if (clash && lib.name !== '') push(errors, 'extras', `libs.${index}.name`, fail('duplicate', { name: lib.name }));
  });
}

export function checkWizardFields(state: WizardState, catalog: ConfigCatalog): FieldError[] {
  const errors: FieldError[] = [];
  if (state.scope === null) errors.push({ step: 'scope', field: 'scope', ...fail('choice-required') });
  if (state.mode === null) errors.push({ step: 'shape', field: 'mode', ...fail('choice-required') });
  push(errors, 'shape', 'project.name', checkProjectName(state.project.name, catalog));
  push(errors, 'shape', 'project.description', checkDescription(state.project.description));
  push(errors, 'shape', 'project.packageScope', checkPackageScope(state.project.packageScope, catalog));
  if (state.scope !== null) {
    if (roleInScope(state.scope, 'frontend') && !state.apps.some((app) => app.role === 'frontend')) {
      errors.push({ step: 'front', field: 'apps', ...fail('app-required') });
    }
    if (roleInScope(state.scope, 'backend') && !state.apps.some((app) => app.role === 'backend')) {
      errors.push({ step: 'back', field: 'apps', ...fail('app-required') });
    }
  }
  appErrors(state, catalog, errors);
  libErrors(state, catalog, errors);
  push(errors, 'extras', 'sdd.author', checkAuthor(state.author, catalog));
  return errors;
}

export function stepErrors(state: WizardState, catalog: ConfigCatalog, step: WizardStepId): FieldError[] {
  if (!stepApplies(state.scope, step)) return [];
  return checkWizardFields(state, catalog).filter((error) => error.step === step);
}

export const hasShellApps = (state: WizardState): boolean => state.apps.some((app) => app.type === MFE_SHELL_TYPE);

export function canAdvance(state: WizardState, catalog: ConfigCatalog, step: WizardStepId): { ok: true } | { ok: false; errors: FieldError[] } {
  const errors = stepErrors(state, catalog, step);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
