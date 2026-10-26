import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { BRIDGE_FEATURES, type ClientCommand } from '@sdd-studio/protocol';
import type { AuthState } from '../auth-mode';
import type { ClaudeLogin } from '../auth/claude-login';
import type { CommandRunner } from '../commands/runner';
import type { AttachmentStore } from '../sessions/attachment-store';
import { SessionError, type SessionManager } from '../sessions/session-manager';
import type { ThreadStore } from '../sessions/store';
import type { FileIndex } from '../workspace/file-index';
import { resolveSddPath } from '../workspace/paths';
import { ProfileError, writeProfile } from '../workspace/profile';
import type { WorkspaceWatcher } from '../workspace/watcher';
import type { BridgeHandlers } from './ws-server';

const MAX_READ_BYTES = 2 * 1024 * 1024;

export function createHandlers(d: {
  root: string;
  auth: Pick<AuthState, 'mode' | 'set'>;
  login: Pick<ClaudeLogin, 'status' | 'login' | 'logout'>;
  bridgeVersion: string;
  sessions: SessionManager;
  watcher: Pick<WorkspaceWatcher, 'current' | 'refresh'>;
  runner: Pick<CommandRunner, 'run'>;
  store: Pick<ThreadStore, 'botHistory'>;
  attachments: Pick<AttachmentStore, 'read'>;
  fileIndex: Pick<FileIndex, 'search'>;
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
            if (info.size > MAX_READ_BYTES) throw new SessionError('bad-request', 'file too large');
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
          return d.store.botHistory(command.channelId, command.limit);
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
