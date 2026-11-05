'use client';

import { File, Folder, FolderCode } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import { ROW_ICON } from '@/lib/typography-tokens';
import { previewTree, sourceFromResolved, sourceFromState } from '@/lib/wizard/preview-tree';
import { useWizard } from './wizard-context';

const ICON = { dir: Folder, file: File, app: FolderCode, lib: FolderCode } as const;

export function ProjectTree() {
  const { t } = useT();
  const { catalog, state, validation } = useWizard();
  const resolved = validation.validation?.resolved ?? null;
  const source = resolved ? sourceFromResolved(resolved) : catalog ? sourceFromState(state, catalog) : null;
  if (source === null) return <p className="text-small text-ink-400">{t('wizard.right.treeEmpty')}</p>;
  return (
    <ul data-testid="project-tree" className="flex flex-col gap-px font-mono text-meta text-ink-100">
      {previewTree(source).map((node) => {
        const Icon = ICON[node.kind];
        return (
          <li key={node.id} data-tree-node={node.id} style={{ paddingLeft: `${node.depth * 14}px` }} className="flex min-w-0 items-baseline gap-1.5">
            <Icon aria-hidden size={ROW_ICON - 4} className="shrink-0 self-center text-ink-400" />
            <span className="shrink-0">{node.name}</span>
            {node.detail !== null && <span className="min-w-0 truncate text-ink-400">{node.detail}</span>}
          </li>
        );
      })}
    </ul>
  );
}
