'use client';

import { Clock, PaperPlaneRight, Paperclip } from '@phosphor-icons/react';
import {
  DEFAULT_AGENT,
  defaultThreadOptions,
  dmAgentOfChannel,
  specIdOfChannel,
  FileSearchResult as FileSearchResultSchema,
  SendResult,
  type SkillSummary,
  TEXT_ATTACHMENT_EXTENSIONS,
  ThreadInfo,
  type AgentSummary,
  type AttachmentUpload,
  type Effort,
  type FileSearchResult,
  type PromptRefs,
  type ModelChoice,
  type PermissionModeChoice,
  type ThreadOptions,
} from '@sdd-studio/protocol';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from 'react';
import { z } from 'zod';
import { agentMeta } from '@/lib/agents';
import { blobOfUpload } from '@/lib/attachments/build-draft';
import { FrameBudgetError } from '@/lib/attachments/frame-budget';
import { bridgeErrorText } from '@/lib/bridge/error-text';
import { extractRefs, resolveSlash } from '@/lib/composer-refs';
import { useT } from '@/lib/i18n/i18n';
import { applyMention, detectMention, type ActiveMention, type MentionItem } from '@/lib/mention';
import { parseSlash, SAFE_ARG } from '@/lib/slash';
import { draftKey } from '@/lib/store/state';
import { primeAttachmentContent } from '@/lib/use-attachment-content';
import { useAttachmentDraft } from '@/lib/use-attachment-draft';
import { useMentionMenu } from '@/lib/use-mention-menu';
import { useBridge, useStudio } from '../BridgeProvider';
import { AttachmentTray } from './AttachmentTray';
import { MentionMenu } from './MentionMenu';
import { PendingMessages } from './PendingMessages';

const RunResult = z.object({ runId: z.string().min(1) });
const FileResult = z.object({ path: z.string(), content: z.string() });

const MAX_MESSAGE = 100_000;
const ATTACH_ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', ...TEXT_ATTACHMENT_EXTENSIONS.map((e) => `.${e}`)].join(',');
const BUSY_STATUSES = new Set(['running', 'waiting-approval', 'queued']);

const MODELS: ModelChoice[] = ['kit', 'haiku', 'sonnet', 'opus', 'fable'];
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const PERMS: PermissionModeChoice[] = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];

export interface ComposerViewProps {
  options: ThreadOptions;
  onOptionsChange(patch: Partial<ThreadOptions>): void;
  /** Resolves true if the message was sent (the text is cleared); false or a rejection keeps the text. */
  onSubmit(text: string): Promise<boolean>;
  agents: string[];
  agentLocked: boolean;
  error: string | null;
  initialText?: string;
  onTextChange?(text: string): void;
  queueing?: boolean;
  tray?: ReactNode;
  hasAttachments?: boolean;
  onFiles?(files: File[]): void;
  attachmentTray?(dragging: boolean): ReactNode;
  mentions?: MentionConfig;
}

export interface MentionConfig {
  agents: readonly AgentSummary[];
  skills: readonly SkillSummary[];
  catalogEnabled: boolean;
  searchFiles: ((query: string, limit: number) => Promise<FileSearchResult>) | null;
}

const NO_AGENTS: readonly AgentSummary[] = [];
const NO_SKILLS: readonly SkillSummary[] = [];
const mentionKey = (m: ActiveMention): string => `${m.trigger}:${m.start}`;

export function ComposerView(p: ComposerViewProps) {
  const { t } = useT();
  const [text, setText] = useState(p.initialText ?? '');
  const updateText = (next: string) => {
    setText(next);
    p.onTextChange?.(next);
  };
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(text.length);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const nextCursor = useRef<number | null>(null);
  const mentionsOn = !!p.mentions && (p.mentions.catalogEnabled || p.mentions.searchFiles !== null);
  const detected = mentionsOn ? detectMention(text, cursor) : null;
  const mention = detected && mentionKey(detected) !== dismissed ? detected : null;
  useEffect(() => {
    if (!detected && dismissed !== null) setDismissed(null);
  }, [detected, dismissed]);
  const insertMention = (item: MentionItem) => {
    if (!mention) return;
    const next = applyMention(text, mention, cursor, item);
    nextCursor.current = next.cursor;
    setCursor(next.cursor);
    updateText(next.text);
  };
  const menu = useMentionMenu({
    mention,
    agents: p.mentions?.agents ?? NO_AGENTS,
    skills: p.mentions?.skills ?? NO_SKILLS,
    catalogEnabled: p.mentions?.catalogEnabled ?? false,
    searchFiles: p.mentions?.searchFiles ?? null,
    onSelect: insertMention,
    onClose: () => setDismissed(detected ? mentionKey(detected) : null),
  });
  useLayoutEffect(() => {
    if (nextCursor.current === null || !box.current) return;
    box.current.setSelectionRange(nextCursor.current, nextCursor.current);
    nextCursor.current = null;
  }, [text]);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) box.current?.focus();
    wasPending.current = pending;
  }, [pending]);
  const submit = async () => {
    const value = text.trim();
    if ((!value && !p.hasAttachments) || busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      if (await p.onSubmit(value)) updateText('');
    } catch {
      // el error lo informa el contenedor; el texto se conserva
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');
  const dropHandlers = p.onFiles
    ? {
        onDragEnter: (e: DragEvent) => {
          if (!hasFiles(e)) return;
          dragDepth.current += 1;
          setDragging(true);
        },
        onDragOver: (e: DragEvent) => {
          if (hasFiles(e)) e.preventDefault();
        },
        onDragLeave: (e: DragEvent) => {
          if (!hasFiles(e)) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        },
        onDrop: (e: DragEvent) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          p.onFiles?.(Array.from(e.dataTransfer.files));
        },
      }
    : {};
  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (!p.onFiles || files.length === 0) return;
    e.preventDefault();
    p.onFiles(files);
  };
  const select = 'rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-ink-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';
  return (
    <div className="border-t border-ink-800" {...dropHandlers}>
      {p.tray}
      {p.attachmentTray?.(dragging)}
      <div className="p-3">
        {p.error && <p role="alert" className="mb-2 text-xs text-roseish">{p.error}</p>}
        <div className="relative rounded-xl border border-ink-700 bg-ink-900 focus-within:border-accent-500/60">
          {mentionsOn && <MentionMenu menu={menu} />}
          <textarea
            {...(mentionsOn ? menu.comboboxProps : {})}
            className="block max-h-48 min-h-[44px] w-full resize-y bg-transparent px-3 py-2 text-sm outline-none"
            aria-label={t('composer.placeholder')}
            placeholder={t('composer.placeholder')}
            ref={box}
            value={text}
            disabled={pending}
            onChange={(e) => {
              setCursor(e.target.selectionStart);
              updateText(e.target.value);
            }}
            onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (mentionsOn && menu.onKeyDown(e)) return;
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-ink-800 px-2 py-1.5">
            <label className="sr-only" htmlFor="composer-agent">{t('composer.agent')}</label>
            <select id="composer-agent" className={select} disabled={p.agentLocked} value={p.options.agent} onChange={(e) => p.onOptionsChange({ agent: e.target.value })}>
              {p.agents.map((a) => <option key={a} value={a}>{agentMeta(a).name}</option>)}
            </select>
            <label className="sr-only" htmlFor="composer-model">{t('composer.model')}</label>
            <select
              id="composer-model"
              className={select}
              value={p.options.model}
              onChange={(e) => {
                const model = e.target.value as ModelChoice;
                p.onOptionsChange(model === 'kit' ? { model, effort: null } : { model, effort: p.options.effort ?? 'medium' });
              }}
            >
              {MODELS.map((m) => <option key={m} value={m}>{m === 'kit' ? t('model.kit') : m}</option>)}
            </select>
            <label className="sr-only" htmlFor="composer-effort">{t('composer.effort')}</label>
            <select
              id="composer-effort"
              className={select}
              disabled={p.options.model === 'kit'}
              value={p.options.effort ?? ''}
              onChange={(e) => p.onOptionsChange({ effort: e.target.value as Effort })}
            >
              {p.options.model === 'kit' && <option value="">—</option>}
              {EFFORTS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <label className="sr-only" htmlFor="composer-perm">{t('composer.permission')}</label>
            <select id="composer-perm" className={select} value={p.options.permissionMode} onChange={(e) => p.onOptionsChange({ permissionMode: e.target.value as PermissionModeChoice })}>
              {PERMS.map((x) => <option key={x} value={x}>{t(`perm.${x}`)}</option>)}
            </select>
            {p.onFiles && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  accept={ATTACH_ACCEPT}
                  data-testid="attachment-input"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (files.length > 0) p.onFiles?.(files);
                  }}
                />
                <button
                  type="button"
                  aria-label={t('attach.add')}
                  title={t('attach.add')}
                  className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-40"
                  disabled={pending}
                  onClick={() => fileInput.current?.click()}
                >
                  <Paperclip size={16} />
                </button>
              </>
            )}
            <button
              aria-label={p.queueing ? t('composer.queue') : t('composer.send')}
              title={p.queueing ? t('composer.queueHint') : undefined}
              className="ml-auto inline-flex items-center gap-1 rounded-md bg-accent-500 p-1.5 text-ink-950 hover:bg-accent-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-50"
              disabled={pending}
              onClick={() => void submit()}
            >
              {p.queueing ? <Clock size={16} weight="fill" /> : <PaperPlaneRight size={16} weight="fill" />}
              {p.queueing && <span className="pr-1 text-xs font-medium">{t('composer.queue')}</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Composer({ channelId, threadId, onThreadCreated }: { channelId: string; threadId: string | null; onThreadCreated(id: string): void }) {
  const { t } = useT();
  const { client, store } = useBridge();
  const snapshot = useStudio((s) => s.snapshot);
  const threadInfo = useStudio((s) => (threadId ? s.threads[threadId]?.info ?? null : null));
  const dmAgent = dmAgentOfChannel(channelId);
  const [draft, setDraft] = useState<ThreadOptions>(() => defaultThreadOptions(dmAgent ?? DEFAULT_AGENT));
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const key = draftKey(channelId, threadId);
  const [initialText] = useState(() => store.getState().drafts[key]?.text ?? '');
  const attachmentsEnabled = client.supports('attachments');
  const catalogEnabled = client.supports('catalog');
  const fileSearchEnabled = client.supports('file-search');
  const searchFiles = useMemo(
    () =>
      fileSearchEnabled
        ? async (query: string, limit: number) => FileSearchResultSchema.parse(await client.request({ cmd: 'workspace.searchFiles', query, limit }))
        : null,
    [client, fileSearchEnabled],
  );
  const attachmentDraft = useAttachmentDraft(key);
  const options = threadInfo?.options ?? { ...draft, agent: dmAgent ?? draft.agent };
  const agents = useMemo(() => {
    const ids = snapshot?.agents.map((a) => a.id) ?? [];
    return ids.includes(options.agent) ? ids : [options.agent, ...ids];
  }, [snapshot, options.agent]);

  const send = async (text: string, refs: PromptRefs = { agents: [], skills: [] }): Promise<boolean> => {
    if (text.length > MAX_MESSAGE) {
      setError(t('composer.tooLong'));
      return false;
    }
    const command = (attachments: AttachmentUpload[]) =>
      threadId ? { cmd: 'thread.send' as const, threadId, text, attachments, refs } : { cmd: 'thread.create' as const, channelId, options, text, attachments, refs };
    const encoded = attachmentsEnabled ? await attachmentDraft.buildUploads(command) : [];
    const sent = command(encoded.map((e) => e.upload));
    let createdId: string | null = null;
    if (threadId) SendResult.parse(await client.request(sent));
    else createdId = ThreadInfo.parse(await client.request(sent)).id;
    store.getState().clearDraft(key);
    encoded.forEach((e) => primeAttachmentContent(client, { sha256: e.sha256, mime: e.upload.mime }, blobOfUpload(e.upload)));
    if (createdId) onThreadCreated(createdId);
    return true;
  };

  const onSubmit = async (text: string): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setError(null);
    try {
      const catalog = catalogEnabled
        ? { agentIds: snapshot?.agents.map((a) => a.id) ?? [], skillIds: snapshot?.skills?.map((k) => k.id) ?? [] }
        : { agentIds: [], skillIds: [] };
      const action = text === '' || resolveSlash(text, catalog.skillIds) === 'skill' ? null : parseSlash(text);
      if (!action) return await send(text, extractRefs(text, catalog));
      if (action.kind === 'error') {
        setError(action.reason === 'unknown' ? t('composer.unknownCommand', { name: action.name }) : t('composer.badArgs', { name: action.name }));
        return false;
      }
      if (action.kind === 'run') {
        const specId = specIdOfChannel(channelId);
        const args = action.name === 'gate' && action.args.length === 0 && specId && SAFE_ARG.test(specId) ? [specId] : action.args;
        const { runId } = RunResult.parse(await client.request({ cmd: 'command.run', name: action.name, args }));
        store.getState().startRun({ runId, name: action.name, args });
        return true;
      }
      const file = FileResult.parse(await client.request({ cmd: 'workspace.readFile', path: action.path }));
      return await send(action.args ? `${file.content}\n\n---\n${action.args}` : file.content);
    } catch (e) {
      setError(e instanceof FrameBudgetError ? budgetErrorText(e) : bridgeErrorText(e, t));
      return false;
    } finally {
      busy.current = false;
    }
  };

  const budgetErrorText = (e: FrameBudgetError) =>
    t('attach.error.budget', { excess: Math.ceil(e.excessBytes / 1024), names: e.heaviest.join(', ') });

  const onOptionsChange = (patch: Partial<ThreadOptions>) => {
    if (threadId) {
      const { agent: _agent, ...allowed } = patch;
      void client.request({ cmd: 'thread.setOptions', threadId, options: allowed }).catch((e: unknown) => setError(bridgeErrorText(e, t)));
    } else {
      setDraft((d) => ({ ...d, ...patch }));
    }
  };

  return (
    <ComposerView
      options={options}
      onOptionsChange={onOptionsChange}
      onSubmit={onSubmit}
      agents={agents}
      agentLocked={dmAgent !== null || threadId !== null}
      error={error}
      initialText={initialText}
      onTextChange={(text) => store.getState().setDraftText(key, text)}
      queueing={threadInfo ? BUSY_STATUSES.has(threadInfo.status) : false}
      tray={threadId ? <PendingMessages threadId={threadId} /> : null}
      mentions={{ agents: snapshot?.agents ?? NO_AGENTS, skills: snapshot?.skills ?? NO_SKILLS, catalogEnabled, searchFiles }}
      hasAttachments={attachmentsEnabled && attachmentDraft.attachments.length > 0}
      onFiles={attachmentsEnabled ? (files) => void attachmentDraft.add(files) : undefined}
      attachmentTray={
        attachmentsEnabled
          ? (dragging) => (
              <AttachmentTray
                attachments={attachmentDraft.attachments}
                failures={attachmentDraft.failures}
                dragging={dragging}
                onRemove={attachmentDraft.remove}
                onDismissFailures={attachmentDraft.dismissFailures}
              />
            )
          : undefined
      }
    />
  );
}
