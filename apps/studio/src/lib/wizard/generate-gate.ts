import type { Preflight } from '@sdd-studio/protocol';
import type { TargetCheckState } from './use-target-check';
import { isGeneratableTarget } from './target-status';
import type { PreflightState } from './use-preflight';

export type GenerateBlock = 'fields' | 'no-target' | 'checking' | 'target-error' | 'target' | 'preflight-pending' | 'preflight' | 'starting';

export interface GenerateGateInput {
  fieldsReady: boolean;
  targetPath: string;
  target: TargetCheckState;
  preflight: PreflightState;
  starting: boolean;
}

export function generateBlock(input: GenerateGateInput): GenerateBlock | null {
  if (input.starting) return 'starting';
  if (!input.fieldsReady) return 'fields';
  if (input.targetPath.trim() === '') return 'no-target';
  if (input.target.status === 'idle' || input.target.status === 'checking') return 'checking';
  if (input.target.status === 'error' || input.target.check === null) return 'target-error';
  if (!isGeneratableTarget(input.target.check)) return 'target';
  if (input.preflight.status === 'loading') return 'preflight-pending';
  if (input.preflight.status === 'error' || input.preflight.data === null || !input.preflight.data.ready) return 'preflight';
  return null;
}

export type PreflightCause = 'pnpm' | 'registry' | 'other';

export function preflightCauses(preflight: Preflight): PreflightCause[] {
  if (preflight.ready) return [];
  const causes: PreflightCause[] = [];
  if (!preflight.pnpm.found) causes.push('pnpm');
  if (preflight.registry.reachable === 'no') causes.push('registry');
  return causes.length > 0 ? causes : ['other'];
}
