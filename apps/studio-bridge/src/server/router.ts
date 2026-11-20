import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { BRIDGE_FEATURES, type ClaudeToolsConfig, type ClaudeToolsGetResult, MAX_READ_FILE_BYTES, type BotEvent, type ClientCommand, type RtkGain, type ServerMessage } from '@sdd-studio/protocol';
import type { AuthState } from '../auth-mode';
import type { ClaudeLogin } from '../auth/claude-login';
import { CHROME_DEVTOOLS_MCP_VERSION } from '../engine/chrome-devtools';
import type { CommandRunner } from '../commands/runner';
import type { ProjectRuntime } from '../project/runtime';
import type { AttachmentStore } from '../sessions/attachment-store';
import { SessionError, type SessionManager } from '../sessions/session-manager';
import type { ThreadStore } from '../sessions/store';
import { createClaudeMcp, type ClaudeMcpService } from '../workspace/claude-mcp';
import { createChromeStatus, defaultChromeCheckDeps, defaultOpenStudioChromeDeps, openStudioChrome, type ChromeStatusService, type OpenStudioChromeDeps } from '../workspace/chrome-status';
import { createClaudeInventory, type ClaudeInventoryService } from '../workspace/claude-inventory';
import { cachedClaudeTools, type ClaudeToolsState, readClaudeTools, setClaudeTools, useGlobalClaudeTools } from '../workspace/claude-tools';
import type { FileIndex } from '../workspace/file-index';
import type { KitIndexer } from '../workspace/kit-index';
import { createKitIntegrations, type KitIntegrations } from '../workspace/kit-integrations';
import { setKitTool } from '../workspace/kit-tools';
import { readRtkGain } from '../workspace/rtk-gain';
import { resolveSddPath } from '../workspace/paths';
import { ProfileError, writeProfile } from '../workspace/profile';
import type { WorkspaceWatcher } from '../workspace/watcher';
import type { BridgeHandlers } from './ws-server';

function changedClaudeAreas(before: ClaudeToolsConfig, after: ClaudeToolsConfig): string[] {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const areas: string[] = [];
  if (!same(before.sources, after.sources)) areas.push('sources');
  if (!same(before.disabledPlugins, after.disabledPlugins)) areas.push('plugins');
  if (!same(before.disabledMcpServers, after.disabledMcpServers)) areas.push('mcp');
  if (!same(before.browser, after.browser)) areas.push('browser');
  return areas;
}

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
  integrations?: KitIntegrations;
  claudeInventory?: ClaudeInventoryService;
  chromeStatus?: ChromeStatusService;
  claudeMcp?: ClaudeMcpService;
  openSettings?: OpenStudioChromeDeps;
  now?: () => Date;
}): BridgeHandlers {
  const integrations = d.integrations ?? createKitIntegrations();
  const claudeInventory = d.claudeInventory ?? createClaudeInventory({ root: d.root });
  const chromeStatus = d.chromeStatus ?? createChromeStatus(defaultChromeCheckDeps(() => cachedClaudeTools(d.root).browser.enabled, () => cachedClaudeTools(d.root).browser.browserUrl));
  const claudeMcp = d.claudeMcp ?? createClaudeMcp({ root: d.root, inventory: claudeInventory });
  const openSettings = d.openSettings ?? defaultOpenStudioChromeDeps();
  chromeStatus.subscribe((browser) => {
    const event: BotEvent = {
      channelId: 'general',
      botKind: 'claude-browser.changed',
      payload: { state: browser.state, checkedAt: browser.checkedAt, detail: browser.detail },
      at: (d.now?.() ?? new Date()).toISOString(),
    };
    d.store.appendBot(event);
    d.broadcast({ kind: 'bot.event', ...event });
  });
  const requestChromeOnEnable = (before: ClaudeToolsConfig, after: ClaudeToolsConfig) => {
    if (!before.browser.enabled && after.browser.enabled) void chromeStatus.check().catch(() => undefined);
  };
  const claudeToolsResult = (state: ClaudeToolsState): ClaudeToolsGetResult => ({
    config: state.config,
    revision: state.revision,
    inventory: claudeInventory.current(),
    browserMcpVersion: CHROME_DEVTOOLS_MCP_VERSION,
    scope: state.scope,
    hasProjectOverride: state.hasProjectOverride,
  });
  const announceClaudeTools = (before: ClaudeToolsConfig, after: ClaudeToolsState) => {
    const event: BotEvent = {
      channelId: 'general',
      botKind: 'claude-tools.changed',
      payload: { changed: changedClaudeAreas(before, after.config), revision: after.revision, scope: after.scope },
      at: (d.now?.() ?? new Date()).toISOString(),
    };
    d.store.appendBot(event);
    d.broadcast({ kind: 'bot.event', ...event });
  };
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
        case 'claude.tools.get':
          return claudeToolsResult(await readClaudeTools(d.root));
        case 'claude.tools.set': {
          const before = (await readClaudeTools(d.root)).config;
          const result = await setClaudeTools(d.root, command.config, command.expectedRevision, command.scope);
          if (result.changed) {
            announceClaudeTools(before, result);
            requestChromeOnEnable(before, result.config);
          }
          return { config: result.config, revision: result.revision, changed: result.changed, scope: result.scope, hasProjectOverride: result.hasProjectOverride };
        }
        case 'claude.tools.useGlobal': {
          const before = (await readClaudeTools(d.root)).config;
          const result = await useGlobalClaudeTools(d.root, command.expectedRevision);
          if (result.changed) {
            announceClaudeTools(before, result);
            requestChromeOnEnable(before, result.config);
          }
          return claudeToolsResult(result);
        }
        case 'claude.browser.check':
          return chromeStatus.check();
        case 'claude.browser.openSettings':
          return openStudioChrome(openSettings);
        case 'claude.mcp.login':
          return claudeMcp.login(command.name);
        case 'claude.mcp.reconnect':
          return claudeMcp.reconnect(command.name);
        case 'claude.inventory.refresh':
          return { inventory: await claudeInventory.refresh() };
        case 'kit.integration.status':
          return integrations.status(d.root, command.integration);
        case 'kit.integration.set': {
          const result = await integrations.set(d.root, command.integration, command.enabled);
          if (result.ok) {
            await d.watcher.refresh().catch(() => null);
            const event: BotEvent = {
              channelId: 'general',
              botKind: 'integration.changed',
              payload: { integration: command.integration, enabled: command.enabled, state: result.status.state },
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
