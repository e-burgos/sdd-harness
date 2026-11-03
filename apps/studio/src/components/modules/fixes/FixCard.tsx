'use client';

import type { FixSummary } from '@sdd-studio/protocol';
import { FileText, MessagesSquare } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { useNav } from '@/lib/nav/use-nav';
import { ROW_ICON } from '@/lib/typography-tokens';
import { DocumentViewerModal } from '../../mission-control/DocumentViewerModal';
import { PanelRow } from '../../shell/PanelRow';
import { FixFacts } from './FixFacts';
import { documentOfFix, threadsOfFix } from './fix-model';
import { useFixes } from './use-fixes';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 border-t border-foreground/10 pt-3">
      <h3 className="text-small font-medium text-ink-400">{title}</h3>
      {children}
    </section>
  );
}

export function FixCard({ fix }: { fix: FixSummary }) {
  const { t } = useT();
  const { snapshot, threads } = useFixes();
  const openHome = useNav((s) => s.openHome);
  const [viewing, setViewing] = useState(false);
  const document = documentOfFix(fix);
  const linked = useMemo(() => threadsOfFix(fix.id, threads), [fix.id, threads]);
  const specAvailable = fix.specId !== null && (snapshot?.specs.some((spec) => spec.id === fix.specId) ?? false);
  return (
    <article data-fix-card={fix.id} aria-label={fix.title} className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-semibold text-ink-50">{fix.title}</h1>
        <p className="font-mono text-small text-ink-400">{fix.id}</p>
      </header>
      <FixFacts fix={fix} specAvailable={specAvailable} layout="grid" />
      <Section title={t('fixes.card.documents')}>
        {document === null ? (
          <p className="text-copy text-ink-400">{t('fixes.card.noDocuments')}</p>
        ) : (
          <PanelRow
            icon={FileText}
            label={document.name}
            meta={document.path}
            ariaLabel={t('fixes.card.openDocument', { name: document.name })}
            onClick={() => setViewing(true)}
          />
        )}
      </Section>
      <Section title={t('fixes.card.conversations')}>
        {linked.length === 0 ? (
          <p className="text-copy text-ink-400">{t('fixes.card.noConversations')}</p>
        ) : (
          <div className="flex flex-col gap-px">
            {linked.map((info) => (
              <PanelRow
                key={info.id}
                icon={MessagesSquare}
                label={info.title}
                meta={t(`status.${info.status}` as keyof Dict)}
                ariaLabel={t('fixes.card.openThread', { title: info.title })}
                onClick={() => openHome({ kind: 'thread', threadId: info.id })}
              />
            ))}
          </div>
        )}
      </Section>
      {document !== null && viewing && <DocumentViewerModal document={document} onClose={() => setViewing(false)} />}
    </article>
  );
}
