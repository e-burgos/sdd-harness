'use client';

import { Button, Textarea, Tooltip } from '@e-burgos/tucu-ui';
import { Clock, Paperclip, Send } from 'lucide-react';
import {
  DEFAULT_AGENT,
  defaultThreadOptions,
  type DevProfile,
  type FlowChoice,
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
import { briefingFor } from '@/lib/auto-conversation';
import { applyFlowChoice, fullExceptionOf, profileOf } from '@/lib/flow-choice';
import { draftKey } from '@/lib/store/state';
import { primeAttachmentContent } from '@/lib/use-attachment-content';
import { useAttachmentDraft } from '@/lib/use-attachment-draft';
import { useMentionMenu } from '@/lib/use-mention-menu';
import { useBridge, useStudio } from '../BridgeProvider';
import { HelpSelect } from '../HelpSelect';
import { AgentFace } from './AgentFace';
import { AttachmentTray } from './AttachmentTray';
import { MentionMenu } from './MentionMenu';
import { ModeSelectors } from './ModeSelectors';
import { PendingMessages } from './PendingMessages';

const RunResult = z.object({ runId: z.string().min(1) });
const FileResult = z.object({ path: z.string(), content: z.string() });

const MAX_MESSAGE = 100_000;
export const TEXTAREA_MAX_HEIGHT_PX = 192;
const ATTACH_ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', ...TEXT_ATTACHMENT_EXTENSIONS.map((e) => `.${e}`)].join(',');
const BUSY_STATUSES = new Set(['running', 'waiting-approval', 'queued']);

const MODELS: ModelChoice[] = ['kit', 'haiku', 'sonnet', 'opus', 'fable'];
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const PERMS: PermissionModeChoice[] = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
const MODEL_NAMES: Record<ModelChoice, string> = { kit: 'Kit', haiku: 'Haiku', sonnet: 'Sonnet', opus: 'Opus', fable: 'Fable' };

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
  modes?: ReactNode;
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
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
  }, [text]);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) box.current?.focus({ preventScroll: true });
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
          <Textarea
            {...(mentionsOn ? menu.comboboxProps : {})}
            variant="transparent"
            inputClassName="min-h-[44px] sm:min-h-[44px] resize-none overflow-y-auto rounded-none px-3 py-2 focus-visible:outline-0"
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
            <HelpSelect
              label={t('composer.agent')}
              help={t('help.composer.agent')}
              disabled={p.agentLocked}
              value={p.options.agent}
              searchable={p.agents.length > 8}
              options={p.agents.map((a) => ({
                value: a,
                label: agentMeta(a).name,
                description: agentMeta(a).role,
                icon: <span className="inline-flex size-[18px] items-center justify-center"><AgentFace agent={a} size={18} /></span>,
              }))}
              onChange={(agent) => p.onOptionsChange({ agent })}
            />
            <HelpSelect
              label={t('composer.model')}
              help={t('help.composer.model')}
              value={p.options.model}
              options={MODELS.map((m) => ({ value: m, label: MODEL_NAMES[m], description: t(`model.${m}.desc`) }))}
              onChange={(value) => {
                const model = value as ModelChoice;
                p.onOptionsChange(model === 'kit' ? { model, effort: null } : { model, effort: p.options.effort ?? 'medium' });
              }}
            />
            <HelpSelect
              label={t('composer.effort')}
              help={t('help.composer.effort')}
              disabled={p.options.model === 'kit'}
              value={p.options.effort ?? ''}
              options={[
                ...(p.options.model === 'kit' ? [{ value: '', label: '—', description: t('effort.none.desc') }] : []),
                ...EFFORTS.map((x) => ({ value: x, label: x, description: t(`effort.${x}.desc`) })),
              ]}
              onChange={(value) => p.onOptionsChange({ effort: value as Effort })}
            />
            <HelpSelect
              label={t('composer.permission')}
              help={t('help.composer.permission')}
              value={p.options.permissionMode}
              options={PERMS.map((x) => ({ value: x, label: t(`perm.${x}`), description: t(`perm.${x}.desc`) }))}
              onChange={(value) => p.onOptionsChange({ permissionMode: value as PermissionModeChoice })}
            />
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
                <Tooltip size="xs" arrow={false} content={t('attach.add')}>
                  <Button
                    type="button"
                    variant="transparent"
                    color="gray"
                    shape="circle"
                    size="mini"
                    aria-label={t('attach.add')}
                    disabled={pending}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Paperclip size={16} />
                  </Button>
                </Tooltip>
              </>
            )}
            <div className="ml-auto">
              <Tooltip size="xs" arrow={false} content={p.queueing ? t('composer.queueHint') : t('composer.send')}>
                <Button
                  type="button"
                  shape={p.queueing ? 'rounded' : 'circle'}
                  size="mini"
                  aria-label={p.queueing ? t('composer.queue') : t('composer.send')}
                  disabled={pending}
                  onClick={() => void submit()}
                >
                  {p.queueing ? <Clock size={16} /> : <Send size={16} />}
                  {p.queueing && <span className="pr-1 text-xs font-medium">{t('composer.queue')}</span>}
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
        {p.modes}
        <p data-testid="composer-hints" className="mt-1.5 px-1 text-meta text-ink-500">{t('composer.hints')}</p>
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
  const [flow, setFlow] = useState<FlowChoice>('auto');
  const [profileError, setProfileError] = useState<string | null>(null);
  const showModes = threadId === null && dmAgent === null && channelId !== 'fixes';
  const chosenFlow: FlowChoice = showModes ? flow : 'auto';
  const changeProfile = (profile: DevProfile) => {
    setProfileError(null);
    client.request({ cmd: 'profile.set', profile }).catch((e: unknown) => setProfileError(t('mode.profileError', { message: bridgeErrorText(e, t) })));
  };
  const options = threadInfo?.options ?? { ...draft, agent: dmAgent ?? draft.agent };
  const agents = useMemo(() => {
    const ids = snapshot?.agents?.map((a) => a.id) ?? [];
    return ids.includes(options.agent) ? ids : [options.agent, ...ids];
  }, [snapshot, options.agent]);

  const opened = useStudio((s) => s.prepared.find((p) => p.id === s.openedPreparedId && p.channelId === channelId) ?? null);

  const send = async (text: string, refs: PromptRefs = { agents: [], skills: [] }): Promise<boolean> => {
    if (text.length > MAX_MESSAGE) {
      setError(t('composer.tooLong'));
      return false;
    }
    const linked = opened && text.startsWith(briefingFor(opened, snapshot).split('\n')[0] ?? '') ? opened : null;
    const command = (attachments: AttachmentUpload[]) =>
      threadId ? { cmd: 'thread.send' as const, threadId, text, attachments, refs } : { cmd: 'thread.create' as const, channelId, options, text, attachments, refs, ...(linked && linked.link.kind !== 'none' ? { link: linked.link } : {}) };
    const encoded = attachmentsEnabled ? await attachmentDraft.buildUploads(command) : [];
    const sent = command(encoded.map((e) => e.upload));
    let createdId: string | null = null;
    if (threadId) SendResult.parse(await client.request(sent));
    else createdId = ThreadInfo.parse(await client.request(sent)).id;
    store.getState().clearDraft(key);
    encoded.forEach((e) => primeAttachmentContent(client, { sha256: e.sha256, mime: e.upload.mime }, blobOfUpload(e.upload)));
    if (createdId && linked) store.getState().dismissPrepared(linked.id);
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
      if (!action) return await send(applyFlowChoice(text, chosenFlow), extractRefs(text, catalog));
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
      const args = applyFlowChoice(action.args, chosenFlow);
      return await send(args ? `${file.content}\n\n---\n${args}` : file.content);
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
      modes={
        showModes ? (
          <ModeSelectors
            profile={profileOf(snapshot)}
            flow={flow}
            exception={fullExceptionOf(specIdOfChannel(channelId), snapshot)}
            canEditProfile={client.supports('profile-set')}
            profileError={profileError}
            onProfileChange={changeProfile}
            onFlowChange={setFlow}
          />
        ) : null
      }
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
