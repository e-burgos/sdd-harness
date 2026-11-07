export type OnboardingStepId = 'claude' | 'project' | 'github' | 'first-work';
export type OnboardingStatus = 'done' | 'current' | 'pending' | 'unavailable';

export interface OnboardingStep {
  id: OnboardingStepId;
  status: OnboardingStatus;
}

export interface OnboardingInput {
  claudeConnected: boolean;
  projectOpen: boolean;
  githubSupported: boolean;
  githubConnected: boolean;
  firstWorkDone: boolean;
}

export function onboardingSteps(input: OnboardingInput): OnboardingStep[] {
  const raw: Array<{ id: OnboardingStepId; done: boolean; available: boolean }> = [
    { id: 'claude', done: input.claudeConnected, available: true },
    { id: 'project', done: input.projectOpen, available: true },
    { id: 'github', done: input.githubConnected, available: input.githubSupported },
    { id: 'first-work', done: input.firstWorkDone, available: true },
  ];
  let currentTaken = false;
  return raw.map(({ id, done, available }) => {
    if (done) return { id, status: 'done' };
    if (!available) return { id, status: 'unavailable' };
    if (currentTaken) return { id, status: 'pending' };
    currentTaken = true;
    return { id, status: 'current' };
  });
}

export const hiddenGuideKey = (root: string): string => `sdd-studio:onboarding:hidden:${root}`;

export function readGuideHidden(root: string): boolean {
  try {
    return window.localStorage.getItem(hiddenGuideKey(root)) === '1';
  } catch {
    return false;
  }
}

export function writeGuideHidden(root: string): void {
  try {
    window.localStorage.setItem(hiddenGuideKey(root), '1');
  } catch {
    return;
  }
}
