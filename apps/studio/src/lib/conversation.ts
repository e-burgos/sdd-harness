import { isKnownProvider, type KnownProvider, type ThreadInfo, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import { bashWritePaths } from './conversation-bash-paths';
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
  cycles: string[];
}

export interface RelatedFix {
  fixId: string;
  specId: string;
}

export interface ConversationDocument {
  path: string;
  name: string;
  specId: string;
  fixId: string | null;
  cycle: string | null;
  agents: string[];
}

export interface ConversationMentions {
  specIds: string[];
  fixIds: string[];
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
  mentions: ConversationMentions;
  engineSessionId: string | null | undefined;
  provider: string | undefined;
  isEmpty: boolean;
}

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

const DOCUMENT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
const SPEC_DOCUMENT_PATH = /(?:^|\/)(sdd\/specs\/(spec-[A-Za-z0-9._-]{1,123})\/[^\s]+)$/;
const FIX_DOCUMENT_PATH = /\/fixes\/fix-([A-Za-z0-9][A-Za-z0-9._-]{0,94}?)\.md$/;
const CYCLE_IN_PATH = /\/cycles\/(cycle-\d{2})\//;

const specIdsOf = (snapshot: WorkspaceSnapshot | null): Map<string, string> =>
  new Map((snapshot?.specs ?? []).map((spec) => [spec.id.toLowerCase(), spec.id]));

const fixesOf = (snapshot: WorkspaceSnapshot | null) => new Map((snapshot?.fixes ?? []).map((fix) => [fix.id.toLowerCase(), fix]));

function documentAt(rawPath: string, agent: string, snapshot: WorkspaceSnapshot | null): ConversationDocument | null {
  const match = SPEC_DOCUMENT_PATH.exec(rawPath.trim());
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
    cycle: CYCLE_IN_PATH.exec(path)?.[1] ?? null,
    agents: [agent],
  };
}

function writtenPathsOf(item: TimelineItem): string[] {
  if (item.kind !== 'tool') return [];
  if (DOCUMENT_TOOLS.has(item.tool)) return [item.summary];
  return item.tool === 'Bash' ? bashWritePaths(item.summary) : [];
}

function relatedDocuments(thread: ThreadState, snapshot: WorkspaceSnapshot | null): ConversationDocument[] {
  const byPath = new Map<string, ConversationDocument>();
  for (const item of thread.items) {
    if (item.kind !== 'tool') continue;
    for (const rawPath of writtenPathsOf(item)) {
      const document = documentAt(rawPath, item.author.agent, snapshot);
      if (!document) continue;
      const previous = byPath.get(document.path);
      byPath.set(document.path, previous ? { ...previous, agents: [...new Set([...previous.agents, ...document.agents])] } : document);
    }
  }
  return [...byPath.values()];
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function mentionedTexts(item: TimelineItem): string[] {
  switch (item.kind) {
    case 'user':
    case 'message':
      return [item.text];
    case 'tool':
    case 'approval':
      return [item.summary];
    default:
      return [];
  }
}

function mentionsOf(items: TimelineItem[], snapshot: WorkspaceSnapshot | null): ConversationMentions {
  const specs = [...specIdsOf(snapshot).values()];
  const fixes = (snapshot?.fixes ?? []).map((fix) => fix.id);
  const known = [...specs, ...fixes].sort((a, b) => b.length - a.length);
  if (known.length === 0) return { specIds: [], fixIds: [] };
  const matcher = new RegExp(`(?<![A-Za-z0-9_-])(${known.map(escapeRegExp).join('|')})(?![A-Za-z0-9_-])`, 'gi');
  const canonical = new Map(known.map((id) => [id.toLowerCase(), id]));
  const lastSeen = new Map<string, number>();
  items.forEach((item, position) => {
    for (const text of mentionedTexts(item)) {
      for (const match of text.matchAll(matcher)) {
        const id = canonical.get((match[1] ?? '').toLowerCase());
        if (id) lastSeen.set(id, position);
      }
    }
  });
  const byRecency = [...lastSeen].sort((a, b) => a[1] - b[1]).map(([id]) => id);
  return {
    specIds: byRecency.filter((id) => specs.includes(id)),
    fixIds: byRecency.filter((id) => fixes.includes(id)),
  };
}

export function relatedFromDocuments(documents: ConversationDocument[]): { specs: RelatedSpec[]; fixes: RelatedFix[] } {
  const specs = new Map<string, RelatedSpec>();
  const fixes = new Map<string, RelatedFix>();
  for (const document of documents) {
    const current = specs.get(document.specId);
    if (current) {
      if (document.cycle) {
        current.cycle = document.cycle;
        if (!current.cycles.includes(document.cycle)) current.cycles = [...current.cycles, document.cycle].sort();
      }
    } else {
      specs.set(document.specId, { specId: document.specId, cycle: document.cycle, cycles: document.cycle ? [document.cycle] : [] });
    }
    if (document.fixId && !fixes.has(document.fixId)) fixes.set(document.fixId, { fixId: document.fixId, specId: document.specId });
  }
  return { specs: [...specs.values()], fixes: [...fixes.values()] };
}

export const documentsOfAgent = (documents: ConversationDocument[], agentId: string): ConversationDocument[] =>
  documents.filter((document) => document.agents.includes(agentId));

export function deriveConversation(thread: ThreadState, snapshot: WorkspaceSnapshot | null): ConversationView {
  const threadAgent = thread.info?.agent ?? null;
  const dialogues = thread.items
    .flatMap((item) => dialogueOf(item, threadAgent) ?? [])
    .sort((a, b) => a.seq - b.seq);
  const documents = relatedDocuments(thread, snapshot);
  const { specs, fixes } = relatedFromDocuments(documents);
  return {
    threadId: thread.info?.id ?? '',
    participants: participantsOf(thread.items, threadAgent, dialogues.length > 0),
    dialogues,
    specs,
    fixes,
    documents,
    mentions: mentionsOf(thread.items, snapshot),
    engineSessionId: thread.info?.engineSessionId,
    provider: thread.info?.provider,
    isEmpty: dialogues.length === 0,
  };
}

const PROVIDER_LABELS: Record<KnownProvider, string> = { claude: 'Claude Code' };

export const providerLabel = (provider: string): string => (isKnownProvider(provider) ? PROVIDER_LABELS[provider] : provider);
