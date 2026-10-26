import { FixIdValue, SpecIdValue, isKnownProvider, type KnownProvider, type ThreadInfo, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import type { GateId } from './gates';
import type { ThreadState, TimelineItem } from './store/timeline';

export interface ConversationDialogue {
  id: string;
  seq: number;
  kind: 'user' | 'message' | 'tool' | 'approval' | 'subagent';
  from: string;
  to: string | null;
  text: string;
  tool?: string;
  gateId?: GateId;
  isLive: boolean;
}

export interface RelatedSpec {
  specId: string;
  cycle: string | null;
  source: 'event' | 'link';
  known: boolean;
}

export interface RelatedFix {
  fixId: string;
  specId: string | null;
  source: 'event' | 'link';
  known: boolean;
}

export interface ConversationDocument {
  path: string;
  name: string;
  specId: string;
  fixId: string | null;
  modified: boolean;
}

export interface ConversationParticipant {
  agentId: string;
  events: number;
}

export interface ConversationView {
  threadId: string;
  participants: ConversationParticipant[];
  dialogues: ConversationDialogue[];
  specs: RelatedSpec[];
  fixes: RelatedFix[];
  documents: ConversationDocument[];
  engineSessionId: string | null | undefined;
  provider: string | undefined;
  isEmpty: boolean;
}

export interface TextReferences {
  specs: { specId: string; cycle: string | null }[];
  fixes: string[];
}

const SPEC_PATH = /sdd\/specs\/(spec-[A-Za-z0-9._-]{1,123})(?:\/cycles\/(cycle-\d{2}))?/g;
const FIX_ID = /\bFIX-[A-Za-z0-9][A-Za-z0-9._-]{0,95}/g;
const FIX_PATH = /\/fixes\/fix-([A-Za-z0-9][A-Za-z0-9._-]{0,94}?)\.md\b/g;
const TRAILING_SIGNS = /[._-]+$/;

const recency = (a: ThreadInfo, b: ThreadInfo): number => {
  const byActivity = (Date.parse(b.lastActivity) || 0) - (Date.parse(a.lastActivity) || 0);
  if (byActivity !== 0) return byActivity;
  const byCreation = (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
  if (byCreation !== 0) return byCreation;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

export function listConversations(threads: Record<string, ThreadState>): ThreadInfo[] {
  return Object.values(threads)
    .flatMap((thread) => (thread.info ? [thread.info] : []))
    .sort(recency);
}

export function resolveSelectedThreadId(picked: string | null, threads: Record<string, ThreadState>): string | null {
  if (picked && threads[picked]?.info) return picked;
  return listConversations(threads)[0]?.id ?? null;
}

export function inferGateFromText(text?: string): GateId | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes('regla cero') || lower.includes('regla-cero') || lower.includes('regla ⓪')) return 'regla-cero';
  if (lower.includes('gate a') || lower.includes('gate-a') || lower.includes('spec gate a')) return 'gate-a';
  if (lower.includes('gate b') || lower.includes('gate-b') || lower.includes('spec gate b')) return 'gate-b';
  if (lower.includes('contexto') || lower.includes('constitution') || lower.includes('updates/')) return 'contexto-gate';
  if (lower.includes('fix gate') || lower.includes('fix-gate') || lower.includes('hotfix') || lower.includes('bugfix') || lower.includes('bypass')) return 'fix-gate';
  if (lower.includes('memoria') || lower.includes('lessons') || lower.includes('journal')) return 'memoria-gate';
  return undefined;
}

export function referencesInText(text: string): TextReferences {
  const specs: TextReferences['specs'] = [];
  for (const match of text.matchAll(SPEC_PATH)) {
    const specId = (match[1] ?? '').replace(TRAILING_SIGNS, '');
    if (SpecIdValue.safeParse(specId).success) specs.push({ specId, cycle: match[2] ?? null });
  }
  const fixes: string[] = [];
  for (const match of text.matchAll(FIX_ID)) {
    const fixId = match[0].replace(TRAILING_SIGNS, '');
    if (FixIdValue.safeParse(fixId).success) fixes.push(fixId);
  }
  for (const match of text.matchAll(FIX_PATH)) {
    const fixId = `FIX-${(match[1] ?? '').replace(TRAILING_SIGNS, '')}`;
    if (FixIdValue.safeParse(fixId).success) fixes.push(fixId);
  }
  return { specs, fixes };
}

function scannedTexts(item: TimelineItem): string[] {
  switch (item.kind) {
    case 'user':
    case 'message':
      return [item.text];
    case 'tool':
      return [item.summary];
    case 'approval':
      return item.input === undefined ? [item.summary] : [item.summary, item.input];
    default:
      return [];
  }
}

function dialogueOf(item: TimelineItem, threadAgent: string | null): ConversationDialogue | null {
  switch (item.kind) {
    case 'user':
      return { id: item.id, seq: item.seq, kind: 'user', from: 'user', to: threadAgent, text: item.text, gateId: inferGateFromText(item.text), isLive: false };
    case 'message':
      return { id: item.id, seq: item.seq, kind: 'message', from: item.author.agent, to: 'user', text: item.text, gateId: inferGateFromText(item.text), isLive: !item.done };
    case 'tool':
      return {
        id: item.id,
        seq: item.seq,
        kind: 'tool',
        from: item.author.agent,
        to: null,
        text: item.summary ? `${item.tool}: ${item.summary}` : item.tool,
        tool: item.tool,
        gateId: inferGateFromText(item.summary),
        isLive: item.status === 'running',
      };
    case 'approval':
      return {
        id: item.id,
        seq: item.seq,
        kind: 'approval',
        from: item.author.agent,
        to: 'user',
        text: item.summary,
        tool: item.tool,
        gateId: inferGateFromText(item.gateWarning ?? item.summary),
        isLive: item.decision === 'pending',
      };
    case 'subagent':
      return { id: item.id, seq: item.seq, kind: 'subagent', from: threadAgent ?? item.agentType, to: item.agentType, text: `${item.agentType}: ${item.phase}`, isLive: false };
    default:
      return null;
  }
}

function participantOf(item: TimelineItem, threadAgent: string | null): string | null {
  switch (item.kind) {
    case 'user':
      return threadAgent;
    case 'message':
    case 'tool':
    case 'approval':
      return item.author.agent;
    case 'subagent':
      return item.agentType;
    default:
      return null;
  }
}

function participantsOf(items: TimelineItem[], threadAgent: string | null, hasEvents: boolean): ConversationParticipant[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const agentId = participantOf(item, threadAgent);
    if (agentId) counts.set(agentId, (counts.get(agentId) ?? 0) + 1);
  }
  if (hasEvents && threadAgent && !counts.has(threadAgent)) counts.set(threadAgent, 0);
  return [...counts].map(([agentId, events]) => ({ agentId, events }));
}

const DOCUMENT_TOOLS = new Set(['Read', 'Write', 'Edit', 'MultiEdit']);
const SPEC_DOCUMENT_PATH = /(?:^|\/)(sdd\/specs\/(spec-[A-Za-z0-9._-]{1,123})\/[^\s]+)$/;
const FIX_DOCUMENT_PATH = /\/fixes\/fix-([A-Za-z0-9][A-Za-z0-9._-]{0,94}?)\.md$/;

const specIdsOf = (snapshot: WorkspaceSnapshot | null): Map<string, string> =>
  new Map((snapshot?.specs ?? []).map((spec) => [spec.id.toLowerCase(), spec.id]));

const fixesOf = (snapshot: WorkspaceSnapshot | null) => new Map((snapshot?.fixes ?? []).map((fix) => [fix.id.toLowerCase(), fix]));

function documentOf(item: TimelineItem, snapshot: WorkspaceSnapshot | null): ConversationDocument | null {
  if (item.kind !== 'tool' || !DOCUMENT_TOOLS.has(item.tool)) return null;
  const match = SPEC_DOCUMENT_PATH.exec(item.summary.trim());
  if (!match) return null;
  const specId = specIdsOf(snapshot).get((match[2] ?? '').toLowerCase());
  if (!specId) return null;
  const path = (match[1] ?? '').replace(/^sdd\/specs\/[^/]+/, `sdd/specs/${specId}`);
  const fixMatch = FIX_DOCUMENT_PATH.exec(path);
  const knownFix = fixMatch ? fixesOf(snapshot).get(`fix-${fixMatch[1]}`.toLowerCase()) : undefined;
  return {
    path,
    name: path.split('/').at(-1) ?? path,
    specId,
    fixId: knownFix?.id ?? null,
    modified: item.tool !== 'Read',
  };
}

function relatedDocuments(thread: ThreadState, snapshot: WorkspaceSnapshot | null): ConversationDocument[] {
  const byPath = new Map<string, ConversationDocument>();
  for (const item of thread.items) {
    const document = documentOf(item, snapshot);
    if (!document) continue;
    const previous = byPath.get(document.path);
    byPath.set(document.path, previous ? { ...previous, modified: previous.modified || document.modified } : document);
  }
  return [...byPath.values()];
}

function relatedSpecs(thread: ThreadState, snapshot: WorkspaceSnapshot | null): RelatedSpec[] {
  const known = specIdsOf(snapshot);
  const found = new Map<string, RelatedSpec>();
  const add = (specId: string, cycle: string | null, source: RelatedSpec['source']): void => {
    const key = specId.toLowerCase();
    const current = found.get(key);
    if (current) {
      if (cycle) current.cycle = cycle;
      return;
    }
    const canonical = known.get(key);
    if (source === 'event' && canonical === undefined) return;
    found.set(key, { specId: canonical ?? specId, cycle, source, known: canonical !== undefined });
  };
  for (const item of thread.items) {
    if (item.kind !== 'tool' || !DOCUMENT_TOOLS.has(item.tool)) continue;
    for (const ref of referencesInText(item.summary).specs) add(ref.specId, ref.cycle, 'event');
  }
  const target = thread.info?.link.target;
  if (target?.kind === 'cycle') add(target.specId, target.cycle, 'link');
  return [...found.values()];
}

function relatedFixes(thread: ThreadState, snapshot: WorkspaceSnapshot | null): RelatedFix[] {
  const known = fixesOf(snapshot);
  const found = new Map<string, RelatedFix>();
  const add = (fixId: string, source: RelatedFix['source']): void => {
    const key = fixId.toLowerCase();
    if (found.has(key)) return;
    const summary = known.get(key);
    if (source === 'event' && !summary) return;
    found.set(key, { fixId: summary?.id ?? fixId, specId: summary?.specId ?? null, source, known: summary !== undefined });
  };
  for (const item of thread.items) {
    for (const text of scannedTexts(item)) for (const fixId of referencesInText(text).fixes) add(fixId, 'event');
  }
  const target = thread.info?.link.target;
  if (target?.kind === 'fix') add(target.fixId, 'link');
  return [...found.values()];
}

export function deriveConversation(thread: ThreadState, snapshot: WorkspaceSnapshot | null): ConversationView {
  const threadAgent = thread.info?.agent ?? null;
  const dialogues = thread.items
    .flatMap((item) => dialogueOf(item, threadAgent) ?? [])
    .sort((a, b) => a.seq - b.seq);
  return {
    threadId: thread.info?.id ?? '',
    participants: participantsOf(thread.items, threadAgent, dialogues.length > 0),
    dialogues,
    specs: relatedSpecs(thread, snapshot),
    fixes: relatedFixes(thread, snapshot),
    documents: relatedDocuments(thread, snapshot),
    engineSessionId: thread.info?.engineSessionId,
    provider: thread.info?.provider,
    isEmpty: dialogues.length === 0,
  };
}

const PROVIDER_LABELS: Record<KnownProvider, string> = { claude: 'Claude Code' };

export const providerLabel = (provider: string): string => (isKnownProvider(provider) ? PROVIDER_LABELS[provider] : provider);
