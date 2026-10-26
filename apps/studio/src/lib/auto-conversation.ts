import { channelForSpec, type BotEvent, type CycleSummary, type ThreadInfo, type ThreadLinkTarget, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import { linkEntriesOf } from './link-targets';

export type PreparedTarget =
  | { kind: 'spec'; specId: string }
  | { kind: 'cycle'; specId: string; cycle: string }
  | { kind: 'fix'; fixId: string; specId: string | null };

export interface PreparedConversation {
  id: string;
  channelId: string;
  target: PreparedTarget;
  link: ThreadLinkTarget;
}

const SPEC_FILE = (specId: string) => `sdd/specs/${specId}/${specId}.spec.md`;
const GLOBAL_CONTEXT = 'sdd/context/context_prompt.md';
const LESSONS = 'sdd/memory/lessons.md';

export const preparedIdOf = (target: PreparedTarget): string =>
  target.kind === 'spec' ? `spec:${target.specId}` : target.kind === 'cycle' ? `cycle:${target.specId}:${target.cycle}` : `fix:${target.fixId}`;

export const preparedLabelOf = (target: PreparedTarget): string =>
  target.kind === 'spec' ? target.specId : target.kind === 'cycle' ? `${target.specId} · ${target.cycle}` : target.fixId;

const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

function targetOf(event: BotEvent): PreparedTarget | null {
  const specId = text(event.payload.specId);
  if (event.botKind === 'spec.created' && specId) return { kind: 'spec', specId };
  const cycle = text(event.payload.cycle);
  if (event.botKind === 'cycle.opened' && specId && cycle) return { kind: 'cycle', specId, cycle };
  const fixId = text(event.payload.fixId);
  if (event.botKind === 'fix.created' && fixId) return { kind: 'fix', fixId, specId };
  return null;
}

const alreadyHasThread = (target: PreparedTarget, threads: ThreadInfo[]): boolean =>
  threads.some((thread) =>
    linkEntriesOf(thread).some((entry) =>
      target.kind === 'cycle'
        ? entry.kind === 'cycle' && entry.specId === target.specId && entry.cycle === target.cycle
        : target.kind === 'fix'
          ? entry.kind === 'fix' && entry.fixId === target.fixId
          : entry.kind === 'spec' && entry.specId === target.specId,
    ),
  );

export function prepareFromBotEvent(event: BotEvent, threads: ThreadInfo[], current: PreparedConversation[]): PreparedConversation[] {
  const target = targetOf(event);
  if (!target) return current;
  const id = preparedIdOf(target);
  if (current.some((p) => p.id === id) || alreadyHasThread(target, threads)) return current;
  const channelId = target.kind === 'fix' ? 'fixes' : channelForSpec(target.specId);
  const link: ThreadLinkTarget =
    target.kind === 'cycle' ? { kind: 'cycle', specId: target.specId, cycle: target.cycle } : target.kind === 'fix' ? { kind: 'fix', fixId: target.fixId } : { kind: 'none' };
  const kept = target.kind === 'cycle' ? current.filter((p) => !(p.target.kind === 'spec' && p.target.specId === target.specId)) : current;
  return [...kept, { id, channelId, target, link }];
}

const contextPathsOf = (apps: string[]): string[] =>
  apps.length === 0
    ? [GLOBAL_CONTEXT]
    : [GLOBAL_CONTEXT, ...apps.flatMap((app) => [`sdd/context/${app}/context_prompt.md`, `sdd/context/${app}/constitution.md`, `sdd/context/${app}/updates/*.md`])];

const cycleDocuments = (cycle: CycleSummary | undefined, base: string): string[] =>
  cycle?.flow === 'lite'
    ? [`${base}/plan.md`, `${base}/tasks.json`, `${base}/cycle.json`]
    : [`${base}/brief.yaml`, `${base}/functional.md`, `${base}/planner.md`, `${base}/architect.md`, `${base}/tasks.json`, `${base}/cycle.json`];

export function briefingFor(prepared: PreparedConversation, snapshot: WorkspaceSnapshot | null): string {
  const { target } = prepared;
  const lines: string[] = [];
  if (target.kind === 'fix') {
    const fix = snapshot?.fixes.find((f) => f.id === target.fixId);
    lines.push(`Conversación nueva para el fix ${target.fixId}${fix?.title ? ` — ${fix.title}` : ''}.`);
    lines.push('Leé solo esto, no explores el resto del repo:');
    lines.push(`- Registro del fix: sdd/fixes.json (entrada ${target.fixId})`);
    lines.push(`- Documento del fix: ${target.specId ? `sdd/specs/${target.specId}/fixes/` : 'sdd/fixes/'} (el que corresponde a ${target.fixId})`);
    if (target.specId) lines.push(`- Spec: ${SPEC_FILE(target.specId)}`);
    lines.push(`- Contexto: ${GLOBAL_CONTEXT} y el contexto del subproyecto que toca el fix`);
    lines.push(`- Memoria: ${LESSONS}`);
    lines.push('Seguí el FIX GATE: sdd/prompts/hotfix-bypass-gate.prompt.md.');
    return lines.join('\n');
  }
  const cycle = target.kind === 'cycle' ? snapshot?.cycles.find((c) => c.specId === target.specId && c.cycle === target.cycle) : undefined;
  lines.push(target.kind === 'cycle' ? `Conversación nueva para ${target.specId}, ${target.cycle}.` : `Conversación nueva para la spec ${target.specId}.`);
  lines.push('Leé solo esto, no explores el resto del repo:');
  lines.push(`- Spec: ${SPEC_FILE(target.specId)}`);
  if (target.kind === 'cycle') {
    lines.push(`- Ciclo (${cycle?.flow ?? 'flow del ciclo'}): ${cycleDocuments(cycle, `sdd/specs/${target.specId}/cycles/${target.cycle}`).join(', ')}`);
  }
  lines.push(`- Contexto: ${contextPathsOf(cycle?.apps ?? []).join(', ')}`);
  lines.push(`- Memoria: ${LESSONS}`);
  lines.push(target.kind === 'cycle' ? `Antes de escribir código corré: pnpm sdd:gate ${target.specId} ${target.cycle}.` : `Antes de abrir un ciclo corré: pnpm sdd:gate ${target.specId}.`);
  return lines.join('\n');
}
