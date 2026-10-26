'use client';

import { useState } from 'react';
import { FileText, GitBranch, Wrench } from 'lucide-react';
import type { CycleSummary } from '@sdd-studio/protocol';
import { getAgentGeneratedDocuments, type AgentDocContext, type AgentGeneratedDocument } from '@/lib/agent-documents';
import type { RelatedFix, RelatedSpec } from '@/lib/conversation';
import { useT } from '@/lib/i18n/i18n';
import { DocumentViewerModal } from './DocumentViewerModal';

export interface RelatedDocumentsProps {
  agentId: string;
  specs: RelatedSpec[];
  fixes: RelatedFix[];
  cycles: CycleSummary[];
}

const latestCycleOf = (specId: string, cycles: CycleSummary[]): string | null => {
  const own = cycles.filter((cycle) => cycle.specId === specId).map((cycle) => cycle.cycle);
  return own.sort().at(-1) ?? null;
};

const documentsFor = (agentId: string, context: AgentDocContext | null): AgentGeneratedDocument[] =>
  context ? getAgentGeneratedDocuments(agentId, context) : [];

export function RelatedDocuments({ agentId, specs, fixes, cycles }: RelatedDocumentsProps) {
  const { t } = useT();
  const [viewing, setViewing] = useState<AgentGeneratedDocument | null>(null);

  if (specs.length === 0 && fixes.length === 0) {
    return (
      <p data-testid="related-documents-empty" className="font-mono text-[10px] text-white/50">
        {t('mc.related.empty')}
      </p>
    );
  }

  const specContext = (spec: RelatedSpec): AgentDocContext | null => {
    const cycleId = spec.cycle ?? latestCycleOf(spec.specId, cycles);
    return spec.known && cycleId ? { specId: spec.specId, cycleId } : null;
  };

  const fixContext = (fix: RelatedFix): AgentDocContext | null =>
    fix.known && fix.specId ? { specId: fix.specId, fixId: fix.fixId } : null;

  const renderDocuments = (documents: AgentGeneratedDocument[]) =>
    documents.length > 0 && (
      <ul className="mt-1 space-y-1">
        {documents.map((doc) => (
          <li key={doc.id}>
            <button
              type="button"
              onClick={() => setViewing(doc)}
              title={doc.path}
              className="flex w-full items-center gap-1.5 rounded bg-white/5 px-1.5 py-1 text-left text-[10px] text-white hover:bg-white/10 hover:text-emerald-300"
            >
              <FileText className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden />
              <span className="truncate">{doc.name}</span>
            </button>
          </li>
        ))}
      </ul>
    );

  return (
    <section data-testid="related-documents" aria-label={t('mc.related.title')} className="space-y-2 font-mono text-[10px]">
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
                  <span className="shrink-0 text-white/50">
                    {spec.known
                      ? spec.cycle
                        ? t('mc.related.cycle', { cycle: spec.cycle })
                        : null
                      : t('mc.related.notInWorkspace')}
                  </span>
                </div>
                {renderDocuments(documentsFor(agentId, specContext(spec)))}
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
                  {!fix.known && <span className="shrink-0 text-white/50">{t('mc.related.notInWorkspace')}</span>}
                </div>
                {renderDocuments(documentsFor(agentId, fixContext(fix)))}
              </li>
            ))}
          </ul>
        </div>
      )}
      <DocumentViewerModal document={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}
