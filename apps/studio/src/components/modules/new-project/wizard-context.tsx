'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ConfigCatalog, WizardCatalogResult } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { planDiscards, initialWizardState, isInitialState, stepApplies, visibleSteps, wizardReducer, WIZARD_STEPS } from '@/lib/wizard/state';
import type { DiscardPlan, WizardAction, WizardChange, WizardState, WizardStepId } from '@/lib/wizard/state';
import { clearWizardState, loadOrInitialState, saveWizardState } from '@/lib/wizard/persist';
import { mapIssues, type MappedIssue } from '@/lib/wizard/issues';
import { recommendationsFor, type Recommendation } from '@/lib/wizard/recommendations';
import { fieldDomId, stepBlockers, type StepBlocker } from '@/lib/wizard/step-gate';
import { toHarnessConfig, type HarnessConfigDraft } from '@/lib/wizard/to-config';
import { useCatalog, type CatalogControls } from '@/lib/wizard/use-catalog';
import { useGeneration, type GenerationControls } from '@/lib/wizard/use-generation';
import { defaultTargetPath } from '@/lib/wizard/target-path';
import { useWizardValidation, type WizardValidation } from '@/lib/wizard/use-wizard-validation';
import { useBridge } from '../../BridgeProvider';
import { blockerText, issueTranslator } from './wizard-text';

export type StepState = 'current' | 'done' | 'pending' | 'na';
export type ChangeOutcome = 'applied' | 'pending' | 'blocked' | 'unchanged';

export interface PendingChange {
  change: WizardChange;
  plan: DiscardPlan;
}

export interface WizardIssue {
  key: string;
  severity: 'error' | 'warning';
  step: WizardStepId;
  field: string | null;
  text: string;
}

export interface WizardContextValue {
  catalogControls: CatalogControls;
  catalog: ConfigCatalog | null;
  info: WizardCatalogResult | null;
  state: WizardState;
  dispatch(action: WizardAction): void;
  requestChange(change: WizardChange): ChangeOutcome;
  pendingChange: PendingChange | null;
  confirmChange(): void;
  cancelChange(): void;
  restart(): void;
  step: WizardStepId;
  steps: WizardStepId[];
  stepState(step: WizardStepId): StepState;
  goToStep(step: WizardStepId): void;
  editStep(step: WizardStepId): void;
  next(): void;
  back(): void;
  blockers(step: WizardStepId): StepBlocker[];
  nextBlockReason: string | null;
  fieldError(field: string): string | null;
  touch(field: string): void;
  focusField(step: WizardStepId, field: string | null): void;
  config: HarnessConfigDraft | null;
  validation: WizardValidation;
  issues: WizardIssue[];
  canGenerate: boolean;
  recommendations: Recommendation[];
  targetPath: string;
  setTargetPath(value: string): void;
  generation: GenerationControls;
}

const WizardContext = createContext<WizardContextValue | null>(null);

function firstOpenStep(state: WizardState, catalog: ConfigCatalog, issues: MappedIssue[]): WizardStepId {
  if (isInitialState(state)) return 'scope';
  const open = visibleSteps(state.scope).find((step) => step !== 'summary' && stepBlockers(state, catalog, step, issues).length > 0);
  return open ?? 'summary';
}

const stepIndex = (step: WizardStepId): number => WIZARD_STEPS.indexOf(step);

export function WizardScope({ children }: { children: ReactNode }) {
  const { t } = useT();
  const { client } = useBridge();
  const catalogControls = useCatalog(client);
  const catalog = catalogControls.data?.catalog ?? null;
  const [state, setState] = useState<WizardState>(loadOrInitialState);
  const [step, setStep] = useState<WizardStepId>('scope');
  const [furthest, setFurthest] = useState(0);
  const [returnToSummary, setReturnToSummary] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [focusTarget, setFocusTarget] = useState<{ step: WizardStepId; field: string } | null>(null);
  const positioned = useRef(false);

  const dispatch = useCallback(
    (action: WizardAction) => {
      if (catalog === null) return;
      setState((previous) => wizardReducer(previous, action, catalog));
    },
    [catalog],
  );

  useEffect(() => {
    if (isInitialState(state)) clearWizardState();
    else saveWizardState(state);
  }, [state]);

  const config = useMemo(
    () => (catalog !== null && state.mode !== null && state.apps.length > 0 ? toHarnessConfig(state, catalog) : null),
    [state, catalog],
  );
  const validation = useWizardValidation(client, config);
  const generation = useGeneration(client);
  const [targetText, setTargetPath] = useState<string | null>(null);
  const info = catalogControls.data;
  const targetPath = targetText ?? (info === null ? '' : defaultTargetPath(info, state.project.name));
  const translate = useMemo(() => issueTranslator(t), [t]);
  const serverIssues = useMemo(
    () => (validation.validation ? mapIssues(validation.validation.issues, state, translate) : []),
    [validation.validation, state, translate],
  );

  useEffect(() => {
    if (positioned.current || catalog === null) return;
    positioned.current = true;
    const target = firstOpenStep(state, catalog, []);
    setStep(target);
    setFurthest(stepIndex(target));
  }, [catalog, state]);

  const steps = useMemo(() => visibleSteps(state.scope), [state.scope]);

  const blockersByStep = useMemo(() => {
    const result = {} as Record<WizardStepId, StepBlocker[]>;
    for (const id of WIZARD_STEPS) result[id] = catalog === null ? [] : stepBlockers(state, catalog, id, serverIssues);
    return result;
  }, [state, catalog, serverIssues]);

  const blockers = useCallback((id: WizardStepId) => blockersByStep[id], [blockersByStep]);

  const issues = useMemo<WizardIssue[]>(() => {
    const blocking: WizardIssue[] = WIZARD_STEPS.flatMap((id) =>
      blockersByStep[id].map((blocker, index) => ({
        key: `${id}:${index}:${blocker.field ?? ''}`,
        severity: 'error' as const,
        step: id,
        field: blocker.field,
        text: blockerText(t, blocker),
      })),
    );
    const warnings: WizardIssue[] = serverIssues
      .filter((issue) => !issue.blocking && stepApplies(state.scope, issue.step))
      .map((issue, index) => ({ key: `warning:${index}:${issue.code}`, severity: 'warning', step: issue.step, field: issue.field, text: issue.text }));
    return [...blocking, ...warnings];
  }, [blockersByStep, serverIssues, state.scope, t]);

  const fieldError = useCallback(
    (field: string): string | null => {
      for (const id of WIZARD_STEPS) {
        for (const blocker of blockersByStep[id]) {
          if (blocker.field !== field) continue;
          if (blocker.source === 'field' && blocker.error.code === 'required' && !touched.has(field)) continue;
          if (blocker.source === 'field' && (blocker.error.code === 'choice-required' || blocker.error.code === 'app-required')) continue;
          return blockerText(t, blocker);
        }
      }
      return null;
    },
    [blockersByStep, touched, t],
  );

  const touch = useCallback((field: string) => setTouched((previous) => (previous.has(field) ? previous : new Set(previous).add(field))), []);

  const stepState = useCallback(
    (id: WizardStepId): StepState => {
      if (!stepApplies(state.scope, id)) return 'na';
      if (id === step) return 'current';
      return stepIndex(id) < furthest && blockersByStep[id].length === 0 ? 'done' : 'pending';
    },
    [state.scope, step, furthest, blockersByStep],
  );

  const goToStep = useCallback(
    (target: WizardStepId) => {
      if (!stepApplies(state.scope, target)) return;
      setStep(target);
      setFurthest((previous) => Math.max(previous, stepIndex(target)));
    },
    [state.scope],
  );

  const editStep = useCallback(
    (target: WizardStepId) => {
      setReturnToSummary(true);
      goToStep(target);
    },
    [goToStep],
  );

  const nextBlockReason = blockersByStep[step][0] ? blockerText(t, blockersByStep[step][0]) : null;

  const next = useCallback(() => {
    if (blockersByStep[step].length > 0) return;
    if (returnToSummary) {
      setReturnToSummary(false);
      goToStep('summary');
      return;
    }
    const following = steps[steps.indexOf(step) + 1];
    if (following) goToStep(following);
  }, [blockersByStep, step, returnToSummary, steps, goToStep]);

  const back = useCallback(() => {
    setReturnToSummary(false);
    const previous = steps[steps.indexOf(step) - 1];
    if (previous) setStep(previous);
  }, [steps, step]);

  const requestChange = useCallback(
    (change: WizardChange): ChangeOutcome => {
      if (catalog === null) return 'blocked';
      if ((change.type === 'scope' && change.scope === state.scope) || (change.type === 'mode' && change.mode === state.mode)) return 'unchanged';
      const plan = planDiscards(state, change, catalog);
      if (plan.blocked) return 'blocked';
      if (plan.items.length === 0) {
        dispatch({ type: 'change', change });
        return 'applied';
      }
      setPendingChange({ change, plan });
      return 'pending';
    },
    [catalog, state, dispatch],
  );

  const confirmChange = useCallback(() => {
    if (pendingChange === null) return;
    dispatch({ type: 'change', change: pendingChange.change });
    setPendingChange(null);
  }, [pendingChange, dispatch]);

  const cancelChange = useCallback(() => setPendingChange(null), []);

  const restart = useCallback(() => {
    setState(initialWizardState());
    setStep('scope');
    setFurthest(0);
    setReturnToSummary(false);
    setPendingChange(null);
    setTouched(new Set());
    setTargetPath(null);
  }, []);

  const focusField = useCallback(
    (target: WizardStepId, field: string | null) => {
      goToStep(target);
      if (field !== null) setFocusTarget({ step: target, field });
    },
    [goToStep],
  );

  useEffect(() => {
    if (focusTarget === null || focusTarget.step !== step) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(fieldDomId(focusTarget.field))?.focus();
      setFocusTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTarget, step]);

  const recommendations = useMemo(() => (catalog === null ? [] : recommendationsFor(state, catalog)), [state, catalog]);
  const canGenerate = validation.canGenerate && WIZARD_STEPS.every((id) => blockersByStep[id].length === 0);

  const value = useMemo<WizardContextValue>(
    () => ({
      catalogControls,
      catalog,
      info: catalogControls.data,
      state,
      dispatch,
      requestChange,
      pendingChange,
      confirmChange,
      cancelChange,
      restart,
      step,
      steps,
      stepState,
      goToStep,
      editStep,
      next,
      back,
      blockers,
      nextBlockReason,
      fieldError,
      touch,
      focusField,
      config,
      validation,
      issues,
      canGenerate,
      recommendations,
      targetPath,
      setTargetPath,
      generation,
    }),
    [
      catalogControls,
      catalog,
      state,
      dispatch,
      requestChange,
      pendingChange,
      confirmChange,
      cancelChange,
      restart,
      step,
      steps,
      stepState,
      goToStep,
      editStep,
      next,
      back,
      blockers,
      nextBlockReason,
      fieldError,
      touch,
      focusField,
      config,
      validation,
      issues,
      canGenerate,
      recommendations,
      targetPath,
      generation,
    ],
  );
  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardContextValue {
  const value = useContext(WizardContext);
  if (!value) throw new Error('useWizard must be used inside <WizardScope>');
  return value;
}
