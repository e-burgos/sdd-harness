'use client';

import { FileText, Zap } from 'lucide-react';
import { agentMeta } from '@/lib/agents';
import { documentsOfAgent, type ConversationView } from '@/lib/conversation';
import { useT } from '@/lib/i18n/i18n';
import { useStudio } from '../../BridgeProvider';
import { AgentFaceChip } from './AgentFaceChip';
import { AgentDirectChat } from './AgentDirectChat';
import { presenceDotClass, presenceLabelKey, presenceOfAgent } from './agent-presence';

const MAX_DOCUMENTS = 8;

function Field({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-meta text-ink-400">{label}</dt>
      <dd className="break-words text-ui text-ink-100" title={title}>
        {value}
      </dd>
    </div>
  );
}

export function AgentCard({ agentId, conversation = null }: { agentId: string; conversation?: ConversationView | null }) {
  const { t } = useT();
  const summary = useStudio((s) => s.snapshot?.agents.find((agent) => agent.id === agentId) ?? null);
  const presence = useStudio((s) => presenceOfAgent(s.presence, agentId));
  const meta = agentMeta(agentId);

  if (summary === null) {
    return (
      <article data-testid="agent-card" data-agent={agentId} className="flex flex-col gap-3">
        <div role="status" className="flex flex-col gap-1">
          <h3 className="text-copy font-semibold text-ink-100">{t('module.agents.card.unavailable')}</h3>
          <p className="text-ui text-ink-300">{t('module.agents.card.unavailableHint')}</p>
        </div>
        <AgentDirectChat agentId={agentId} disabledReason={t('module.agents.chat.unavailable')} />
      </article>
    );
  }

  const documents = conversation ? documentsOfAgent(conversation.documents, agentId).slice(0, MAX_DOCUMENTS) : [];
  const currentTask = presence?.tool ?? presence?.specId ?? null;

  return (
    <article data-testid="agent-card" data-agent={agentId} className="flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <AgentFaceChip agent={agentId} size={40} state={presence?.state ?? 'idle'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 truncate text-copy font-semibold text-ink-100">{meta.name}</h3>
            {meta.isLeader && <span className="shrink-0 rounded bg-accent-dim px-1.5 text-micro font-medium text-ink-50">{t('module.agents.card.leader')}</span>}
          </div>
          <p className="truncate text-meta text-ink-400">{meta.role}</p>
        </div>
      </header>

      <div data-testid="agent-presence" data-state={presence?.state ?? 'idle'} className="flex items-center gap-2">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${presenceDotClass(presence)}`} />
        <span className="text-ui text-ink-100">{t(presenceLabelKey(presence))}</span>
      </div>

      <dl className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-meta text-ink-400">{t('module.agents.card.currentTask')}</dt>
          <dd className="flex items-center gap-1.5 text-ui text-ink-100">
            {currentTask ? (
              <>
                <Zap aria-hidden size={16} className="shrink-0 text-ink-400" />
                <span data-testid="agent-current-task" className="min-w-0 truncate">{currentTask}</span>
              </>
            ) : (
              <span className="text-ink-300">{t('module.agents.card.idleTask')}</span>
            )}
          </dd>
        </div>
        {summary.description !== '' && <Field label={t('module.agents.card.description')} value={summary.description} />}
        <Field label={t('module.agents.card.model')} value={summary.model ?? '—'} />
        <Field label={t('module.agents.card.source')} value={t(summary.source === 'sdd' ? 'module.agents.card.source.kit' : 'module.agents.card.source.project')} />
        <Field label={t('module.agents.card.path')} value={summary.path} title={summary.path} />
      </dl>

      {documents.length > 0 && (
        <section aria-label={t('module.agents.card.documents')} className="flex flex-col gap-1 border-t border-foreground/10 pt-2">
          <h4 className="flex h-7 items-center text-small font-medium text-ink-400">{t('module.agents.card.documents')}</h4>
          <ul className="flex flex-col gap-px">
            {documents.map((document) => (
              <li key={document.path} title={document.path} className="flex h-7 items-center gap-2 text-ui text-ink-100">
                <FileText aria-hidden size={16} className="shrink-0 text-ink-400" />
                <span className="min-w-0 truncate">{document.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AgentDirectChat agentId={agentId} />
    </article>
  );
}
