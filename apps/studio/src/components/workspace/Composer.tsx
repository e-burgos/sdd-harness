'use client';

import { PaperPlaneRight } from '@phosphor-icons/react';
import {
  DEFAULT_AGENT,
  defaultThreadOptions,
  dmAgentOfChannel,
  ThreadInfo,
  type Effort,
  type ModelChoice,
  type PermissionModeChoice,
  type ThreadOptions,
} from '@sdd-studio/protocol';
import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { parseSlash } from '@/lib/slash';
import { useBridge, useStudio } from '../BridgeProvider';

const RunResult = z.object({ runId: z.string().min(1) });
const FileResult = z.object({ path: z.string(), content: z.string() });

const MAX_MESSAGE = 100_000;
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const MODELS: ModelChoice[] = ['kit', 'haiku', 'sonnet', 'opus', 'fable'];
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const PERMS: PermissionModeChoice[] = ['default', 'acceptEdits', 'plan'];

export interface ComposerViewProps {
  options: ThreadOptions;
  onOptionsChange(patch: Partial<ThreadOptions>): void;
  /** Resuelve true si el mensaje se envió (el texto se limpia); false o rechazo conservan el texto. */
  onSubmit(text: string): Promise<boolean>;
  agents: string[];
  agentLocked: boolean;
  error: string | null;
}

export function ComposerView(p: ComposerViewProps) {
  const { t } = useT();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) box.current?.focus();
    wasPending.current = pending;
  }, [pending]);
  const submit = async () => {
    const value = text.trim();
    if (!value || busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      if (await p.onSubmit(value)) setText('');
    } catch {
      // el error lo informa el contenedor; el texto se conserva
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const select = 'rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-ink-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';
  return (
    <div className="border-t border-ink-800 p-3">
      {p.error && <p role="alert" className="mb-2 text-xs text-roseish">{p.error}</p>}
      <div className="rounded-xl border border-ink-700 bg-ink-900 focus-within:border-accent-500/60">
        <textarea
          className="block max-h-48 min-h-[44px] w-full resize-y bg-transparent px-3 py-2 text-sm outline-none"
          aria-label={t('composer.placeholder')}
          placeholder={t('composer.placeholder')}
          ref={box}
          value={text}
          disabled={pending}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
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
          <button aria-label={t('composer.send')} className="ml-auto rounded-md bg-accent-500 p-1.5 text-ink-950 hover:bg-accent-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-50" disabled={pending} onClick={() => void submit()}>
            <PaperPlaneRight size={16} weight="fill" />
          </button>
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
  const options = threadInfo?.options ?? { ...draft, agent: dmAgent ?? draft.agent };
  const agents = useMemo(() => {
    const ids = snapshot?.agents.map((a) => a.id) ?? [];
    return ids.includes(options.agent) ? ids : [options.agent, ...ids];
  }, [snapshot, options.agent]);

  const send = async (text: string): Promise<boolean> => {
    if (text.length > MAX_MESSAGE) {
      setError(t('composer.tooLong'));
      return false;
    }
    if (threadId) {
      await client.request({ cmd: 'thread.send', threadId, text });
    } else {
      const created = ThreadInfo.parse(await client.request({ cmd: 'thread.create', channelId, options, text }));
      onThreadCreated(created.id);
    }
    return true;
  };

  const onSubmit = async (text: string): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setError(null);
    try {
      const action = parseSlash(text);
      if (!action) return await send(text);
      if (action.kind === 'error') {
        setError(action.reason === 'unknown' ? t('composer.unknownCommand', { name: action.name }) : t('composer.badArgs', { name: action.name }));
        return false;
      }
      if (action.kind === 'run') {
        const { runId } = RunResult.parse(await client.request({ cmd: 'command.run', name: action.name, args: action.args }));
        store.getState().startRun({ runId, name: action.name, args: action.args });
        return true;
      }
      const file = FileResult.parse(await client.request({ cmd: 'workspace.readFile', path: action.path }));
      return await send(action.args ? `${file.content}\n\n---\n${action.args}` : file.content);
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      busy.current = false;
    }
  };

  const onOptionsChange = (patch: Partial<ThreadOptions>) => {
    if (threadId) {
      const { agent: _agent, ...allowed } = patch;
      void client.request({ cmd: 'thread.setOptions', threadId, options: allowed }).catch((e: unknown) => setError(errorText(e)));
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
    />
  );
}
