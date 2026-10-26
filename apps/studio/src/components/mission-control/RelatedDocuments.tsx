'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, GitBranch, Wrench } from 'lucide-react';
import { toViewerDocument, type AgentGeneratedDocument } from '@/lib/agent-documents';
import type { ConversationDocument, RelatedFix, RelatedSpec } from '@/lib/conversation';
import { useT } from '@/lib/i18n/i18n';
import { DocumentViewerModal } from './DocumentViewerModal';

export interface RelatedDocumentsProps {
  specs: RelatedSpec[];
  fixes: RelatedFix[];
  documents: ConversationDocument[];
  emptyMessage?: string;
  open: boolean;
  onToggle: () => void;
}

export function RelatedDocuments({ specs, fixes, documents, emptyMessage, open, onToggle }: RelatedDocumentsProps) {
  const { t } = useT();
  const [viewing, setViewing] = useState<AgentGeneratedDocument | null>(null);

  const renderDocuments = (items: ConversationDocument[]) =>
    items.length > 0 && (
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item.path}>
            <button
              type="button"
              onClick={() => setViewing(toViewerDocument(item))}
              title={item.path}
              className="flex w-full items-center gap-1.5 rounded bg-white/5 px-1.5 py-1 text-left text-[10px] text-white hover:bg-white/10 hover:text-emerald-300"
            >
              <FileText className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden />
              <span className="truncate">{item.name}</span>
            </button>
          </li>
        ))}
      </ul>
    );

  const isEmpty = specs.length === 0 && fixes.length === 0;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <section
      data-testid="related-documents"
      aria-label={t('mc.related.title')}
      className="rounded-lg border border-white/10 bg-white/5 font-mono text-[10px]"
    >
      <button
        type="button"
        data-testid="related-documents-toggle"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left font-bold uppercase text-white/80 hover:text-white"
      >
        <Chevron className="h-3 w-3 shrink-0" aria-hidden />
        <span className="flex-1 truncate">{t('mc.related.title')}</span>
        <span className="text-white/50">{documents.length}</span>
      </button>
      {open && (
        <div data-testid="related-documents-body" className="space-y-2 border-t border-white/10 px-2 py-2">
          {isEmpty && (
            <p data-testid="related-documents-empty" className="text-white/50">
              {emptyMessage ?? t('mc.related.empty')}
            </p>
          )}
          {specs.length > 0 && (
            <div>
              <h4 className="mb-1 flex items-center gap-1 font-bold uppercase text-emerald-400">
                <GitBranch className="h-3 w-3" aria-hidden />
                {t('mc.related.specs')}
              </h4>
              <ul className="space-y-1.5">
                {specs.map((spec) => (
                  <li key={spec.specId} data-testid={`related-spec-${spec.specId}`}>
                    <div className="flex items-center justify-between gap-2 text-white">
                      <span className="truncate" title={spec.specId}>
                        {spec.specId}
                      </span>
                      {spec.cycle && <span className="shrink-0 text-white/50">{t('mc.related.cycle', { cycle: spec.cycle })}</span>}
                    </div>
                    {renderDocuments(documents.filter((item) => item.specId === spec.specId && item.fixId === null))}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fixes.length > 0 && (
            <div>
              <h4 className="mb-1 flex items-center gap-1 font-bold uppercase text-amber-400">
                <Wrench className="h-3 w-3" aria-hidden />
                {t('mc.related.fixes')}
              </h4>
              <ul className="space-y-1.5">
                {fixes.map((fix) => (
                  <li key={fix.fixId} data-testid={`related-fix-${fix.fixId}`}>
                    <div className="flex items-center justify-between gap-2 text-white">
                      <span className="truncate" title={fix.fixId}>
                        {fix.fixId}
                      </span>
                    </div>
                    {renderDocuments(documents.filter((item) => item.fixId === fix.fixId))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <DocumentViewerModal document={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}
