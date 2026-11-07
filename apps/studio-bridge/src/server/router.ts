import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { BRIDGE_FEATURES, MAX_READ_FILE_BYTES, type BotEvent, type ClientCommand, type RtkGain, type ServerMessage } from '@sdd-studio/protocol';
import type { AuthState } from '../auth-mode';
import type { ClaudeLogin } from '../auth/claude-login';
import type { CommandRunner } from '../commands/runner';
import type { ProjectRuntime } from '../project/runtime';
import type { AttachmentStore } from '../sessions/attachment-store';
import { SessionError, type SessionManager } from '../sessions/session-manager';
import type { ThreadStore } from '../sessions/store';
import type { FileIndex } from '../workspace/file-index';
import type { KitIndexer } from '../workspace/kit-index';
import { setKitTool } from '../workspace/kit-tools';
import { readRtkGain } from '../workspace/rtk-gain';
import { resolveSddPath } from '../workspace/paths';
import { ProfileError, writeProfile } from '../workspace/profile';
import type { WorkspaceWatcher } from '../workspace/watcher';
import type { BridgeHandlers } from './ws-server';

export function createHandlers(d: {
  root: string;
  auth: Pick<AuthState, 'mode' | 'set'>;
  login: Pick<ClaudeLogin, 'status' | 'login' | 'logout'>;
  bridgeVersion: string;
  sessions: SessionManager;
  watcher: Pick<WorkspaceWatcher, 'current' | 'refresh'>;
  runner: Pick<CommandRunner, 'run'>;
  store: Pick<ThreadStore, 'botHistory' | 'appendBot'>;
  attachments: Pick<AttachmentStore, 'read'>;
  fileIndex: Pick<FileIndex, 'search'>;
  kitIndexer: Pick<KitIndexer, 'index'>;
  broadcast: (message: ServerMessage) => void;
  rtkGain?: (root: string) => Promise<RtkGain>;
  now?: () => Date;
}): BridgeHandlers {
  return {
    welcome: () => {
      const snapshot = d.watcher.current();
      return {
        bridgeVersion: d.bridgeVersion,
        workspace: { root: d.root, project: snapshot.project },
        kitVersion: snapshot.kitVersion,
        authMode: d.auth.mode(),
        features: [...BRIDGE_FEATURES],
      };
    },
    handle: async (command: ClientCommand) => {
      switch (command.cmd) {
        case 'workspace.snapshot':
          await d.watcher.refresh().catch(() => null);
          return d.watcher.current();
        case 'presence.get':
          return d.sessions.presence();
        case 'workspace.readFile': {
          const file = await resolveSddPath(d.root, command.path);
          // A single handle: fstat + read on the same fd (no TOCTOU between stat and read).
          // O_NONBLOCK: a FIFO cannot hang open(); isFile() is still enforced below.
          const handle = await open(file, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
          try {
            const info = await handle.stat();
            if (!info.isFile()) throw new SessionError('bad-request', 'not a regular file');
            if (info.size > MAX_READ_FILE_BYTES) throw new SessionError('bad-request', 'file too large');
            return { path: command.path, content: await handle.readFile('utf8') };
          } finally {
            await handle.close();
          }
        }
        case 'thread.create':
          return d.sessions.createThread(command);
        case 'thread.send':
          return d.sessions.send(command.threadId, command);
        case 'thread.pending.edit':
          d.sessions.editPending(command.threadId, command.pendingId, command.text);
          return null;
        case 'thread.pending.remove':
          d.sessions.removePending(command.threadId, command.pendingId);
          return null;
        case 'thread.pending.flush':
          return d.sessions.flushPending(command.threadId);
        case 'workspace.searchFiles':
          return d.fileIndex.search(command.query, command.limit);
        case 'attachment.get': {
          const bytes = await d.attachments.read(command.sha256, command.mime);
          return { sha256: command.sha256, mime: command.mime, data: Buffer.from(bytes).toString('base64') };
        }
        case 'thread.setLink':
          return d.sessions.setLink(command.threadId, command.link);
        case 'thread.updateLinks':
          return d.sessions.updateLinks(command.threadId, { add: command.add, remove: command.remove });
        case 'thread.interrupt':
          await d.sessions.interrupt(command.threadId);
          return null;
        case 'thread.setOptions':
          return d.sessions.setOptions(command.threadId, command.options);
        case 'thread.list':
          return d.sessions.list(command.channelId);
        case 'thread.history':
          return d.sessions.history(command.threadId, command.sinceSeq, command.includeDocumentTouched, command.includeQuestions);
        case 'channel.botHistory':
          return d.store.botHistory(command.channelId, command.limit, command.includeKitEvents);
        case 'kit.index':
          return d.kitIndexer.index();
        case 'kit.rtkGain':
          return (d.rtkGain ?? readRtkGain)(d.root);
        case 'kit.tools.set': {
          const result = await setKitTool(d.root, command.change, command.expectedRevision);
          if (result.changed) {
            await d.watcher.refresh().catch(() => null);
            const event: BotEvent = {
              channelId: 'general',
              botKind: 'tools.changed',
              payload: { tool: result.tool, from: result.from, to: result.to, file: 'sdd/tools.json' },
              at: (d.now?.() ?? new Date()).toISOString(),
            };
            d.store.appendBot(event);
            d.broadcast({ kind: 'bot.event', ...event });
          }
          return result;
        }
        case 'approval.respond':
          d.sessions.respondApproval(command.approvalId, command.decision, command.reason, command.scope);
          return null;
        case 'profile.set': {
          try {
            await writeProfile(d.root, command.profile);
          } catch (error) {
            if (error instanceof ProfileError) throw new SessionError(error.code, error.message);
            throw error;
          }
          await d.watcher.refresh().catch(() => null);
          return { profile: command.profile };
        }
        case 'question.answer':
          d.sessions.answerQuestion(command.questionId, command.answers, command.decline);
          return null;
        case 'auth.set':
          return { authMode: d.auth.set(command.apiKey, command.mode) };
        case 'auth.status':
          return d.login.status();
        case 'auth.login':
          return d.login.login();
        case 'auth.logout':
          return d.login.logout();
        case 'command.run':
          return { runId: d.runner.run(command.name, command.args) };
        default:
          throw new SessionError('bad-request', `unsupported: ${(command as { cmd: string }).cmd}`);
      }
    },
  };
}

export type HostCommand = Extract<ClientCommand, { cmd: `wizard.${string}` | `github.${string}` | 'workspace.open' }>;

const isHostCommand = (command: ClientCommand): command is HostCommand =>
  command.cmd.startsWith('wizard.') || command.cmd.startsWith('github.') || command.cmd === 'workspace.open';

export function createHostHandlers(d: {
  bridgeVersion: string;
  auth: Pick<AuthState, 'mode' | 'set'>;
  login: Pick<ClaudeLogin, 'status' | 'login' | 'logout'>;
  runtime: () => ProjectRuntime | null;
  hostCommands?: (command: HostCommand) => Promise<unknown>;
}): BridgeHandlers {
  return {
    welcome: () => ({
      bridgeVersion: d.bridgeVersion,
      ...(d.runtime()?.welcomePart() ?? { workspace: null, kitVersion: null }),
      authMode: d.auth.mode(),
      features: [...BRIDGE_FEATURES],
    }),
    handle: async (command: ClientCommand) => {
      switch (command.cmd) {
        case 'auth.set':
          return { authMode: d.auth.set(command.apiKey, command.mode) };
        case 'auth.status':
          return d.login.status();
        case 'auth.login':
          return d.login.login();
        case 'auth.logout':
          return d.login.logout();
        case 'presence.get':
          return d.runtime()?.presence() ?? [];
        default:
          break;
      }
      if (isHostCommand(command)) {
        if (!d.hostCommands) throw new SessionError('bad-request', `unsupported: ${command.cmd}`);
        return d.hostCommands(command);
      }
      const runtime = d.runtime();
      if (!runtime) throw new SessionError('not-found', 'no project open');
      return runtime.handle(command);
    },
  };
}
