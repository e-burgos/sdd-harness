'use client';

import { useMemo } from 'react';
import type { SessionStatus } from '@sdd-studio/protocol';
import { Check, ChevronRight, Loader2, Scissors, Wrench, X } from 'lucide-react';
import { agentMeta } from '@/lib/agents';
import { formatCost, formatTokens } from '@/lib/format';
import { useT } from '@/lib/i18n/i18n';
import { isUsageLimitError } from '@/lib/usage-limit';
import { groupTimeline } from '@/lib/store/selectors';
import { isToolSummaryClipped, type TimelineItem } from '@/lib/store/timeline';
import { AgentAvatar } from './AgentAvatar';
import { AttachmentList } from './AttachmentView';
import { ApprovalCard, type RespondFn } from './ApprovalCard';
import { Markdown } from './Markdown';

export function Timeline({ items, status, onRespond }: { items: TimelineItem[]; status?: SessionStatus; onRespond: (approvalId: string, ...args: Parameters<RespondFn>) => Promise<unknown> }) {
  const { t } = useT();
  const lastMessageId = useMemo(() => items.filter((i) => i.kind === 'message').at(-1)?.id, [items]);
  const blocks = useMemo(() => groupTimeline(items), [items]);
  return (
    <ol className="space-y-4">
      {blocks.map((block) => {
        if (block.kind === 'tools') {
          const meta = agentMeta(block.author.agent);
          return (
            <li key={block.id} className="min-w-0 pl-11">
              <details className="group rounded-lg border border-ink-800 bg-ink-900/60">
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-ink-300">
                  <ChevronRight size={12} className="transition group-open:rotate-90" />
                  <Wrench size={14} />
                  {t('tools.used', { name: meta.name, count: block.items.length })}
                </summary>
                <ul className="space-y-1 px-3 pb-3">
                  {block.items.map((tool) => (
                    <li key={tool.id} className="font-mono text-[11px]">
                      <span className={tool.status === 'error' ? 'text-roseish' : tool.status === 'running' ? 'text-amberish' : 'text-accent-300'}>
                        {tool.status === 'running' ? (
                          <Loader2 size={11} className="inline-block motion-safe:animate-spin" aria-hidden />
                        ) : tool.status === 'error' ? (
                          <X size={11} className="inline-block" aria-hidden />
                        ) : (
                          <Check size={11} className="inline-block" aria-hidden />
                        )}
                        <span className="sr-only">{t(`tool.${tool.status}`)}</span>
                      </span>{' '}
                      <span className="text-ink-300">{tool.tool}</span> <span className="break-all">{tool.summary}</span>
                      {isToolSummaryClipped(tool) && (
                        <span data-testid="tool-summary-clipped" className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-ink-500" title={t('tool.clipped.title')}>
                          <Scissors size={10} aria-hidden />
                          {t('tool.clipped')}
                        </span>
                      )}
                      {tool.diff && <pre className="mt-1 max-h-48 overflow-auto rounded bg-ink-950 p-2">{tool.diff}</pre>}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        }
        const item = block.item;
        switch (item.kind) {
          case 'user':
            return (
              <li key={item.id} className="flex gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-xs">{t('timeline.you')}</span>
                <div className="min-w-0 pt-1">
                  {item.text !== '' && <p className="whitespace-pre-wrap break-words text-sm">{item.text}</p>}
                  {item.attachments && item.attachments.length > 0 && <AttachmentList attachments={item.attachments} />}
                  {item.refs && item.refs.agents.length + item.refs.skills.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-1" aria-label={t('timeline.refs')}>
                      {item.refs.agents.map((id) => <li key={`a:${id}`} className="rounded bg-ink-800 px-1.5 font-mono text-[11px] text-ink-300">@{id}</li>)}
                      {item.refs.skills.map((id) => <li key={`s:${id}`} className="rounded bg-ink-800 px-1.5 font-mono text-[11px] text-ink-300">/{id}</li>)}
                    </ul>
                  )}
                  {item.pendingId && (
                    <p className={`mt-0.5 text-[11px] ${item.notDelivered ? 'text-amberish' : 'text-ink-300'}`}>
                      {item.notDelivered ? t('pending.notDelivered') : item.delivery === 'next-turn' ? t('pending.deliveredNextTurn') : t('pending.delivered')}
                    </p>
                  )}
                </div>
              </li>
            );
          case 'message': {
            const meta = agentMeta(item.author.agent);
            return (
              <li key={item.id} className="flex gap-3">
                <AgentAvatar agent={item.author.agent} status={item.id === lastMessageId ? status : undefined} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-col leading-tight">
                    <span className="text-sm font-semibold tracking-tight" style={{ color: meta.color }}>
                      {meta.name}
                    </span>
                    <span className="text-[11px] font-mono text-ink-400">
                      {meta.role} · {meta.title}
                    </span>
                  </div>
                  <Markdown text={item.text} />
                </div>
              </li>
            );
          }
          case 'approval':
            return (
              <li key={item.id} className="min-w-0 pl-11">
                <ApprovalCard item={item} onRespond={(...args) => onRespond(item.id, ...args)} />
              </li>
            );
          case 'subagent':
            return (
              <li key={item.id} className="pl-11 text-xs text-ink-300">
                {t(item.phase === 'start' ? 'subagent.start' : 'subagent.stop', { name: agentMeta(item.agentType).name })}
              </li>
            );
          case 'usage':
            return (
              <li key={item.id} className="pl-11 font-mono text-[11px] text-ink-500">
                {t('usage.footer', {
                  model: item.usage.model,
                  effort: item.usage.effort ?? 'kit',
                  tokensIn: formatTokens(item.usage.tokensIn),
                  tokensOut: formatTokens(item.usage.tokensOut),
                  cost: formatCost(item.usage.costUsd),
                })}
              </li>
            );
          case 'status':
            return (
              <li key={item.id} className="pl-11 text-xs text-roseish">
                {t(`status.${item.status}`)}
                {item.error ? ` — ${item.error.message}` : ''}
                {isUsageLimitError(item.error?.message) && <span className="mt-0.5 block text-ink-300">{t('status.usageLimitHint')}</span>}
              </li>
            );
          default:
            return null;
        }
      })}
    </ol>
  );
}
