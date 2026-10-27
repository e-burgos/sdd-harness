'use client';

import { EmptyState } from '@e-burgos/tucu-ui';
import { FileText } from 'lucide-react';
import { useMemo } from 'react';
import type { SpecSummary } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { useStudio } from '../../BridgeProvider';
import { Item, Section } from './SpecParts';
import { cycleDirectory, documentGroupsOf, fileNameOf } from './specs-model';
import { useDocumentViewer } from './use-document-viewer';

export function SpecDocumentsTab({ spec }: { spec: SpecSummary }) {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const { open, viewer } = useDocumentViewer();
  const groups = useMemo(() => (snapshot ? documentGroupsOf(spec, snapshot.cycles, snapshot.fixes) : []), [snapshot, spec]);
  if (!snapshot) return null;
  if (groups.length === 0) return <EmptyState size="sm" title={t('specs.docs.empty')} />;

  return (
    <div className="flex flex-col">
      {groups.map((group) => {
        const base = group.cycle ? `${cycleDirectory(spec, group.cycle)}/` : '';
        const title = group.kind === 'spec' ? t('specs.docs.spec') : group.kind === 'fixes' ? t('specs.docs.fixes') : group.cycle ?? group.id;
        return (
          <Section key={group.id} title={title} count={group.paths.length}>
            {group.paths.map((path) => {
              const label = base && path.startsWith(base) ? path.slice(base.length) : fileNameOf(path);
              return <Item key={path} mono icon={FileText} label={label} ariaLabel={t('specs.docs.open', { name: label })} onClick={() => open(path, group.paths)} />;
            })}
          </Section>
        );
      })}
      {viewer}
    </div>
  );
}
