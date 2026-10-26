import type { DevProfile, FlowChoice, WorkspaceSnapshot } from '@sdd-studio/protocol';

export type EffectiveFlow = 'lite' | 'full';
export type FullException = 'depends-on' | 'depended-on';

const PREFIX: Record<EffectiveFlow, string> = { lite: '[LITE]', full: '[FULL]' };
const LEADING_PREFIX = /^\s*\[(?:LITE|FULL)\]/i;

export const profileOf = (snapshot: WorkspaceSnapshot | null): DevProfile => (snapshot?.profile === 'solo' ? 'solo' : 'team');

export const effectiveFlow = (profile: DevProfile, choice: FlowChoice): EffectiveFlow =>
  choice === 'auto' ? (profile === 'solo' ? 'lite' : 'full') : choice;

export function applyFlowChoice(text: string, choice: FlowChoice): string {
  if (choice === 'auto' || LEADING_PREFIX.test(text)) return text;
  return `${PREFIX[choice]} ${text}`.trim();
}

export function fullExceptionOf(specId: string | null, snapshot: WorkspaceSnapshot | null): FullException | null {
  if (!specId || !snapshot) return null;
  const spec = snapshot.specs.find((s) => s.id === specId);
  if (spec && spec.dependsOn.length > 0) return 'depends-on';
  return snapshot.specs.some((s) => s.dependsOn.includes(specId)) ? 'depended-on' : null;
}
