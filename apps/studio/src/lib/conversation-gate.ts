import type { WorkspaceSnapshot } from '@sdd-studio/protocol';
import type { ConversationView } from './conversation';
import type { TFunction } from './i18n/i18n';

export type ConversationGate = { kind: 'spec'; specId: string; cycle: string | null } | { kind: 'fix'; fixId: string } | { kind: 'idle' };

const OPEN_FIX_STATUSES = new Set(['pending', 'in-progress']);

const lastGateHint = (view: ConversationView) => [...view.dialogues].reverse().find((dialogue) => dialogue.gateId)?.gateId;

function inProgressCycleOf(specId: string, snapshot: WorkspaceSnapshot | null): string | null {
  return snapshot?.cycles.find((cycle) => cycle.specId === specId && cycle.status === 'in-progress')?.cycle ?? null;
}

interface SeqGate {
  gate: ConversationGate;
  seq: number;
}

function lastWrittenGate(view: ConversationView, snapshot: WorkspaceSnapshot | null): SeqGate | null {
  const last = view.documents.at(-1);
  if (!last) return null;
  const seq = view.gateActivity.documentSeqs[last.path] ?? -1;
  if (last.fixId) return { gate: { kind: 'fix', fixId: last.fixId }, seq };
  return {
    gate: {
      kind: 'spec',
      specId: last.specId,
      cycle: last.cycle ?? inProgressCycleOf(last.specId, snapshot),
    },
    seq,
  };
}

function latestMentionedFixGate(view: ConversationView, snapshot: WorkspaceSnapshot | null): SeqGate | null {
  const statusOf = new Map((snapshot?.fixes ?? []).map((fix) => [fix.id, fix.status]));
  const acceptsAnyStatus = lastGateHint(view) === 'fix-gate';
  const valid = view.mentions.fixIds.filter((fixId) => acceptsAnyStatus || OPEN_FIX_STATUSES.has(statusOf.get(fixId) ?? ''));
  const seqOf = (fixId: string) => view.gateActivity.fixMentionSeqs[fixId] ?? -1;
  const fixId = valid.reduce<string | undefined>((best, candidate) => (best === undefined || seqOf(candidate) >= seqOf(best) ? candidate : best), undefined);
  return fixId ? { gate: { kind: 'fix', fixId }, seq: seqOf(fixId) } : null;
}

function mostRecentGate(view: ConversationView, snapshot: WorkspaceSnapshot | null): ConversationGate | null {
  const written = lastWrittenGate(view, snapshot);
  const mentioned = latestMentionedFixGate(view, snapshot);
  if (written && mentioned) return mentioned.seq > written.seq ? mentioned.gate : written.gate;
  return (written ?? mentioned)?.gate ?? null;
}

function activeCycleGate(view: ConversationView, snapshot: WorkspaceSnapshot | null): ConversationGate | null {
  const related = new Set([...view.specs.map((spec) => spec.specId), ...view.mentions.specIds]);
  const cycle = snapshot?.cycles.find((candidate) => related.has(candidate.specId) && candidate.status === 'in-progress');
  return cycle ? { kind: 'spec', specId: cycle.specId, cycle: cycle.cycle } : null;
}

export function deriveConversationGate(view: ConversationView, snapshot: WorkspaceSnapshot | null): ConversationGate {
  return mostRecentGate(view, snapshot) ?? activeCycleGate(view, snapshot) ?? { kind: 'idle' };
}

export function gateLabel(gate: ConversationGate, t: TFunction): string {
  if (gate.kind === 'fix') return t('gate.chip.fix', { fix: gate.fixId });
  if (gate.kind === 'idle') return t('gate.chip.idle');
  return gate.cycle ? t('gate.chip.spec', { spec: gate.specId, cycle: gate.cycle }) : t('gate.chip.specNoCycle', { spec: gate.specId });
}
