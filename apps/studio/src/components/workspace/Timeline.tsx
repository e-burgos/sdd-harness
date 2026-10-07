'use client';

import { useMemo } from 'react';
import { CaretRight, Wrench } from '@phosphor-icons/react';
import { agentMeta } from '@/lib/agents';
import { formatCost, formatTokens } from '@/lib/format';
import { useT } from '@/lib/i18n/i18n';
import { groupTimeline } from '@/lib/store/selectors';
import type { TimelineItem } from '@/lib/store/timeline';
import { AgentAvatar } from './AgentAvatar';
import { ApprovalCard, type RespondFn } from './ApprovalCard';
import { Markdown } from './Markdown';

export function Timeline({ items, onRespond }: { items: TimelineItem[]; onRespond: (approvalId: string, ...args: Parameters<RespondFn>) => Promise<unknown> }) {
  const { t } = useT();
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
                  <CaretRight size={12} className="transition group-open:rotate-90" />
                  <Wrench size={14} />
                  {t('tools.used', { name: meta.name, count: block.items.length })}
                </summary>
                <ul className="space-y-1 px-3 pb-3">
                  {block.items.map((tool) => (
                    <li key={tool.id} className="font-mono text-[11px]">
                      <span className={tool.status === 'error' ? 'text-roseish' : tool.status === 'running' ? 'text-amberish' : 'text-accent-300'}>
                        <span aria-hidden>{tool.status === 'running' ? '⟳' : tool.status === 'error' ? '✗' : '✓'}</span>
                        <span className="sr-only">{t(`tool.${tool.status}`)}</span>
                      </span>{' '}
                      <span className="text-ink-300">{tool.tool}</span> <span className="break-all">{tool.summary}</span>
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
                <p className="min-w-0 whitespace-pre-wrap break-words pt-1 text-sm">{item.text}</p>
              </li>
            );
          case 'message': {
            const meta = agentMeta(item.author.agent);
            return (
              <li key={item.id} className="flex gap-3">
                <AgentAvatar agent={item.author.agent} />
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 text-sm font-semibold" style={{ color: meta.color }}>{meta.name}</div>
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
              </li>
            );
          default:
            return null;
        }
      })}
    </ol>
  );
}
