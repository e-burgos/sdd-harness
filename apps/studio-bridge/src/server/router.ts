import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { ClientCommand } from '@sdd-studio/protocol';
import type { AuthState } from '../auth-mode';
import type { CommandRunner } from '../commands/runner';
import type { AttachmentStore } from '../sessions/attachment-store';
import { SessionError, type SessionManager } from '../sessions/session-manager';
import type { ThreadStore } from '../sessions/store';
import { resolveSddPath } from '../workspace/paths';
import type { WorkspaceWatcher } from '../workspace/watcher';
import type { BridgeHandlers } from './ws-server';

const MAX_READ_BYTES = 2 * 1024 * 1024;
const SUPPORTED_FEATURES = ['pending-messages', 'thread-link', 'always-rules'];

function rejectUnsupportedBody(body: { attachments: unknown[]; refs: { agents: unknown[]; skills: unknown[] } }): void {
  if (body.attachments.length > 0) throw new SessionError('bad-request', 'unsupported: attachments');
  if (body.refs.agents.length > 0 || body.refs.skills.length > 0) throw new SessionError('bad-request', 'unsupported: catalog');
}

export function createHandlers(d: {
  root: string;
  auth: Pick<AuthState, 'mode' | 'set'>;
  bridgeVersion: string;
  sessions: SessionManager;
  watcher: Pick<WorkspaceWatcher, 'current'>;
  runner: Pick<CommandRunner, 'run'>;
  store: Pick<ThreadStore, 'botHistory'>;
  attachments: Pick<AttachmentStore, 'read'>;
}): BridgeHandlers {
  return {
    welcome: () => {
      const snapshot = d.watcher.current();
      return {
        bridgeVersion: d.bridgeVersion,
        workspace: { root: d.root, project: snapshot.project },
        kitVersion: snapshot.kitVersion,
        authMode: d.auth.mode(),
        features: SUPPORTED_FEATURES,
      };
    },
    handle: async (command: ClientCommand) => {
      switch (command.cmd) {
        case 'workspace.snapshot':
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
          rejectUnsupportedBody(command);
          return d.sessions.createThread(command);
        case 'thread.send':
          rejectUnsupportedBody(command);
          return d.sessions.send(command.threadId, command.text);
        case 'thread.pending.edit':
          d.sessions.editPending(command.threadId, command.pendingId, command.text);
          return null;
        case 'thread.pending.remove':
          d.sessions.removePending(command.threadId, command.pendingId);
          return null;
        case 'thread.pending.flush':
          return d.sessions.flushPending(command.threadId);
        case 'workspace.searchFiles':
          throw new SessionError('bad-request', 'unsupported: file-search');
        case 'attachment.get': {
          const bytes = await d.attachments.read(command.sha256, command.mime);
          return { sha256: command.sha256, mime: command.mime, data: Buffer.from(bytes).toString('base64') };
        }
        case 'thread.setLink':
          return d.sessions.setLink(command.threadId, command.link);
        case 'thread.interrupt':
          await d.sessions.interrupt(command.threadId);
          return null;
        case 'thread.setOptions':
          return d.sessions.setOptions(command.threadId, command.options);
        case 'thread.list':
          return d.sessions.list(command.channelId);
        case 'thread.history':
          return d.sessions.history(command.threadId, command.sinceSeq);
        case 'channel.botHistory':
          return d.store.botHistory(command.channelId, command.limit);
        case 'approval.respond':
          d.sessions.respondApproval(command.approvalId, command.decision, command.reason, command.scope);
          return null;
        case 'auth.set':
          return { authMode: d.auth.set(command.apiKey) };
        case 'command.run':
          return { runId: d.runner.run(command.name, command.args) };
        default:
          throw new SessionError('bad-request', `unsupported: ${(command as { cmd: string }).cmd}`);
      }
    },
  };
}
