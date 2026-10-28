'use client';

import { dmAgentOfChannel, specIdOfChannel } from '@sdd-studio/protocol';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { agentMeta } from '@/lib/agents';
import { deriveConversation } from '@/lib/conversation';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { cycleForChannel } from '@/lib/store/selectors';
import { PANEL_TYPE } from '@/lib/typography-tokens';
import { useStudio } from '../../BridgeProvider';
import { RelatedDocuments } from '../../mission-control/RelatedDocuments';
import { formatWhen } from './channel-sections';
import { approvalThreads, isFixOpen, isSpecActive, isSpecClosed, runningCycles, runningThreads } from './derive';

type Entry = [label: string, value: ReactNode];

export function HomeDetails() {
  const { t, lang } = useT();
  const home = useNav((s) => s.home);
  const snapshot = useStudio((s) => s.snapshot);
  const threads = useStudio((s) => s.threads);
  const none = t('home.details.none');
  const [documentsOpen, setDocumentsOpen] = useState(true);
  const openThread = home.kind === 'thread' ? threads[home.threadId] : undefined;
  const conversation = useMemo(() => (openThread ? deriveConversation(openThread, snapshot) : null), [openThread, snapshot]);

  const projectEntries = (): Entry[] => [
    [t('home.details.project'), snapshot?.project ?? none],
    [t('home.details.profile'), snapshot?.profile ?? none],
    [t('home.details.kit'), snapshot?.kitVersion ?? none],
    [t('home.details.gate'), snapshot?.tools?.gate ?? snapshot?.gateMode ?? none],
    [t('home.details.specs'), snapshot?.specs.length ?? 0],
    [t('home.details.fixesOpen'), snapshot?.fixes.filter(isFixOpen).length ?? 0],
    [t('home.details.agents'), snapshot?.agents.length ?? 0],
  ];

  const entries = (): Entry[] => {
    if (home.kind === 'specs-channel') {
      const specs = snapshot?.specs ?? [];
      return [
        [t('home.details.specs'), specs.length],
        [t('home.details.specsActive'), specs.filter((spec) => isSpecActive(spec, snapshot?.cycles ?? [])).length],
        [t('home.details.specsClosed'), specs.filter(isSpecClosed).length],
      ];
    }
    if (home.kind === 'inbox') {
      return [
        [t('home.threads'), home.which === 'running' ? runningThreads(threads).length : approvalThreads(threads).length],
        ...(home.which === 'running' ? ([[t('home.inbox.cycles'), runningCycles(snapshot).length]] as Entry[]) : []),
      ];
    }
    if (home.kind === 'thread') {
      const info = threads[home.threadId]?.info;
      if (!info) return [[t('home.details.id'), home.threadId]];
      return [
        [t('home.details.id'), info.id],
        [t('home.details.agent'), agentMeta(info.agent).name],
        [t('home.details.status'), t(`status.${info.status}`)],
        [t('home.details.channel'), info.channelId],
        [t('home.details.created'), formatWhen(info.createdAt, lang) || none],
        [t('home.details.lastActivity'), formatWhen(info.lastActivity, lang) || none],
      ];
    }
    const dm = dmAgentOfChannel(home.channelId);
    if (dm) {
      const agent = snapshot?.agents.find((entry) => entry.id === dm);
      return [
        [t('home.details.agent'), agentMeta(dm).name],
        [t('home.details.model'), agent?.model ?? none],
        [t('home.details.id'), dm],
      ];
    }
    const specId = specIdOfChannel(home.channelId);
    if (specId) {
      const spec = snapshot?.specs.find((entry) => entry.id === specId);
      const cycle = cycleForChannel(snapshot, home.channelId);
      return [
        [t('home.details.id'), specId],
        [t('home.details.status'), spec?.status ?? none],
        [t('home.details.folder'), spec?.folder ?? none],
        [t('home.details.module'), spec?.module ?? none],
        [t('home.details.app'), spec?.app ?? none],
        [t('home.details.cycle'), cycle ? `${cycle.cycle} · ${cycle.flow} · ${t('cycle.progress', { done: cycle.tasksDone, total: cycle.tasksTotal })}` : none],
      ];
    }
    if (home.channelId === 'fixes') {
      const fixes = snapshot?.fixes ?? [];
      return [
        [t('home.details.fixesOpen'), fixes.filter(isFixOpen).length],
        [t('home.details.fixesClosed'), fixes.filter((fix) => !isFixOpen(fix)).length],
      ];
    }
    return projectEntries();
  };

  return (
    <div className="space-y-5">
      <dl data-testid="home-right-details" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
        {entries().map(([label, value]) => (
          <Fragment key={label}>
            <dt className={`${PANEL_TYPE.meta} text-ink-400`}>{label}</dt>
            <dd className={`${PANEL_TYPE.item} min-w-0 break-words text-ink-100`}>{value}</dd>
          </Fragment>
        ))}
      </dl>
      {conversation && (
        <section data-testid="panel-documents" data-studio-exempt="hosted-component">
          <RelatedDocuments
            specs={conversation.specs}
            fixes={conversation.fixes}
            documents={conversation.documents}
            documentSource={conversation.documentSource}
            open={documentsOpen}
            onToggle={() => setDocumentsOpen((open) => !open)}
          />
        </section>
      )}
    </div>
  );
}
