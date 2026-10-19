import type { BotEvent, Presence, ServerEvent, ThreadEvent, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { applyThreadEvent, emptyThread, type ThreadState } from './timeline';

export interface CommandRun {
  runId: string;
  name: string;
  args: string[];
  output: string;
  exitCode: number | null;
}

export interface StudioState {
  snapshot: WorkspaceSnapshot | null;
  threads: Record<string, ThreadState>;
  presence: Presence[];
  bot: Record<string, BotEvent[]>;
  runs: Record<string, CommandRun>;
}

const MAX_BOT_EVENTS = 200;
const MAX_THREAD_BUFFER = 1000;
const MAX_RUN_OUTPUT = 200_000;

export const initialState = (): StudioState => ({ snapshot: null, threads: {}, presence: [], bot: {}, runs: {} });

const threadOf = (s: StudioState, id: string): ThreadState => s.threads[id] ?? emptyThread();

function withThread(s: StudioState, id: string, thread: ThreadState): StudioState {
  return thread === s.threads[id] ? s : { ...s, threads: { ...s.threads, [id]: thread } };
}

function sameInfo(a: ThreadInfo | null, b: ThreadInfo): boolean {
  return (
    !!a &&
    a.status === b.status &&
    a.lastActivity === b.lastActivity &&
    a.title === b.title &&
    a.channelId === b.channelId &&
    a.agent === b.agent &&
    JSON.stringify(a.options) === JSON.stringify(b.options)
  );
}

function withInfo(s: StudioState, info: ThreadInfo): StudioState {
  const current = threadOf(s, info.id);
  return sameInfo(current.info, info) ? s : withThread(s, info.id, { ...current, info });
}

export function setThreads(s: StudioState, list: ThreadInfo[]): StudioState {
  return list.reduce(withInfo, s);
}

export function beginSync(s: StudioState, threadId: string): StudioState {
  const thread = threadOf(s, threadId);
  return thread.synced === false && s.threads[threadId] ? s : withThread(s, threadId, { ...thread, synced: false });
}

export function loadHistory(s: StudioState, threadId: string, entries: { seq: number; event: ThreadEvent }[]): StudioState {
  let thread = threadOf(s, threadId);
  const bySeq = (a: { seq: number }, b: { seq: number }) => a.seq - b.seq;
  for (const entry of [...entries].sort(bySeq)) thread = applyThreadEvent(thread, entry.seq, entry.event);
  for (const entry of [...thread.buffer].sort(bySeq)) thread = applyThreadEvent(thread, entry.seq, entry.event);
  return withThread(s, threadId, { ...thread, synced: true, buffer: [] });
}

export function setBotHistory(s: StudioState, channelId: string, events: BotEvent[]): StudioState {
  return { ...s, bot: { ...s.bot, [channelId]: events.slice(-MAX_BOT_EVENTS) } };
}

export function startRun(s: StudioState, run: { runId: string; name: string; args: string[] }): StudioState {
  return { ...s, runs: { ...s.runs, [run.runId]: { ...run, output: s.runs[run.runId]?.output ?? '', exitCode: s.runs[run.runId]?.exitCode ?? null } } };
}

export function applyServerEvent(s: StudioState, e: ServerEvent): StudioState {
  switch (e.kind) {
    case 'thread.event': {
      const thread = threadOf(s, e.threadId);
      if (thread.synced) return withThread(s, e.threadId, applyThreadEvent(thread, e.seq, e.event));
      if (thread.buffer.some((b) => b.seq === e.seq)) return s;
      const buffer = [...thread.buffer, { seq: e.seq, event: e.event }].slice(-MAX_THREAD_BUFFER);
      return withThread(s, e.threadId, { ...thread, buffer });
    }
    case 'thread.updated':
      return withInfo(s, e.thread);
    case 'presence.changed':
      return { ...s, presence: e.presence };
    case 'workspace.changed':
      return { ...s, snapshot: e.snapshot };
    case 'bot.event': {
      const { kind: _kind, ...event } = e;
      const list = [...(s.bot[e.channelId] ?? []), event].slice(-MAX_BOT_EVENTS);
      return { ...s, bot: { ...s.bot, [e.channelId]: list } };
    }
    case 'command.output': {
      const run = s.runs[e.runId] ?? { runId: e.runId, name: '?', args: [], output: '', exitCode: null };
      return { ...s, runs: { ...s.runs, [e.runId]: { ...run, output: (run.output + e.chunk).slice(-MAX_RUN_OUTPUT) } } };
    }
    case 'command.exit': {
      const run = s.runs[e.runId] ?? { runId: e.runId, name: '?', args: [], output: '', exitCode: null };
      return { ...s, runs: { ...s.runs, [e.runId]: { ...run, exitCode: e.exitCode } } };
    }
  }
}
