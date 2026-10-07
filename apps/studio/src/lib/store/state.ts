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
const MAX_RUN_OUTPUT = 200_000;

export const initialState = (): StudioState => ({ snapshot: null, threads: {}, presence: [], bot: {}, runs: {} });

const threadOf = (s: StudioState, id: string): ThreadState => s.threads[id] ?? emptyThread();

function withThread(s: StudioState, id: string, thread: ThreadState): StudioState {
  return thread === s.threads[id] ? s : { ...s, threads: { ...s.threads, [id]: thread } };
}

export function setThreads(s: StudioState, list: ThreadInfo[]): StudioState {
  const threads = { ...s.threads };
  for (const info of list) threads[info.id] = { ...threadOf(s, info.id), info };
  return { ...s, threads };
}

export function loadHistory(s: StudioState, threadId: string, entries: { seq: number; event: ThreadEvent }[]): StudioState {
  let thread = threadOf(s, threadId);
  for (const entry of [...entries].sort((a, b) => a.seq - b.seq)) thread = applyThreadEvent(thread, entry.seq, entry.event);
  return withThread(s, threadId, thread);
}

export function setBotHistory(s: StudioState, channelId: string, events: BotEvent[]): StudioState {
  return { ...s, bot: { ...s.bot, [channelId]: events.slice(-MAX_BOT_EVENTS) } };
}

export function startRun(s: StudioState, run: { runId: string; name: string; args: string[] }): StudioState {
  return { ...s, runs: { ...s.runs, [run.runId]: { ...run, output: s.runs[run.runId]?.output ?? '', exitCode: s.runs[run.runId]?.exitCode ?? null } } };
}

export function applyServerEvent(s: StudioState, e: ServerEvent): StudioState {
  switch (e.kind) {
    case 'thread.event':
      return withThread(s, e.threadId, applyThreadEvent(threadOf(s, e.threadId), e.seq, e.event));
    case 'thread.updated':
      return withThread(s, e.thread.id, { ...threadOf(s, e.thread.id), info: e.thread });
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
