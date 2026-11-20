'use client';

import { Skeleton, SplitModal, type SplitModalAction, type SplitModalSection } from '@e-burgos/tucu-ui';
import React, { useState, useEffect } from 'react';
import { Code2, ClipboardList, Zap, FileText, Check, Copy, Link2 } from 'lucide-react';
import { Markdown } from '../workspace/Markdown';
import type { AgentGeneratedDocument } from '@/lib/agent-documents';
import { useT } from '@/lib/i18n/i18n';
import { useBridge } from '../BridgeProvider';

export interface DocumentViewerModalProps {
  document: AgentGeneratedDocument | null;
  onClose: () => void;
  related?: AgentGeneratedDocument[];
  onNavigate?: (document: AgentGeneratedDocument) => void;
}

type ViewMode = 'rendered' | 'raw';

const DOCUMENT_PREFIX = 'document:';

const TYPE_BADGE_CLASS: Record<string, string> = {
  spec: 'border-sky-500/40 bg-sky-500/20 text-sky-300',
  plan: 'border-purple-500/40 bg-purple-500/20 text-purple-300',
  wbs: 'border-purple-500/40 bg-purple-500/20 text-purple-300',
  code: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300',
  context: 'border-amber-500/40 bg-amber-500/20 text-amber-300',
};

const DocumentTypeIcon = ({ type }: { type: string }) =>
  type === 'code' ? (
    <Code2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
  ) : type === 'plan' || type === 'wbs' ? (
    <ClipboardList className="h-3.5 w-3.5 text-purple-400" aria-hidden />
  ) : type === 'fix' ? (
    <Zap className="h-3.5 w-3.5 text-amber-400" aria-hidden />
  ) : (
    <FileText className="h-3.5 w-3.5 text-sky-400" aria-hidden />
  );

export function DocumentViewerModal({ document: doc, onClose, related = [], onNavigate }: DocumentViewerModalProps) {
  const { client } = useBridge();
  const { t } = useT();
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<ViewMode>('rendered');
  const [loadFailed, setLoadFailed] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [pathCopied, setPathCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!doc) return;
    let isCancelled = false;
    setIsLoading(true);
    setLoadFailed(false);

    const loadContent = async () => {
      if (client && client.request && doc.path) {
        try {
          const res = (await client.request({
            cmd: 'workspace.readFile',
            path: doc.path,
          })) as { path: string; content: string };
          if (!isCancelled && res?.content !== undefined) {
            setContent(res.content);
            setIsLoading(false);
            return;
          }
        } catch {
          setLoadFailed(true);
        }
      }

      if (!isCancelled) {
        setContent('');
        setLoadFailed(true);
        setIsLoading(false);
      }
    };

    void loadContent();

    return () => {
      isCancelled = true;
    };
  }, [doc, client]);

  useEffect(() => {
    setViewMode('rendered');
  }, [doc?.path]);

  const path = doc?.path ?? '';
  const isMarkdown = path.endsWith('.md');
  const isCodeOrJson = path.endsWith('.json') || path.endsWith('.ts') || path.endsWith('.tsx');

  const documents = doc && !related.some((item) => item.path === path) ? [doc, ...related] : related;
  const sections: SplitModalSection[] = [
    ...(isMarkdown
      ? [
          {
            id: 'view',
            label: t('ui.doc.view'),
            selectionMode: 'option' as const,
            activeItemId: viewMode,
            onActiveItemChange: (id: string) => setViewMode(id as ViewMode),
            items: [
              { id: 'rendered', label: t('ui.doc.rendered') },
              { id: 'raw', label: t('ui.doc.raw') },
            ],
          },
        ]
      : []),
    ...(documents.length > 1
      ? [
          {
            id: 'documents',
            label: t('ui.doc.documents'),
            items: documents.map((item) => ({
              id: `${DOCUMENT_PREFIX}${item.path}`,
              label: item.name,
              icon: <DocumentTypeIcon type={item.type} />,
              description: item.type,
            })),
          },
        ]
      : []),
  ];

  const handleSelect = (id: string) => {
    if (!id.startsWith(DOCUMENT_PREFIX)) return;
    const target = documents.find((item) => item.path === id.slice(DOCUMENT_PREFIX.length));
    if (target && target.path !== path) onNavigate?.(target);
  };

  const copyToClipboard = (value: string, flag: (copied: boolean) => void) => {
    void navigator.clipboard.writeText(value);
    flag(true);
    setTimeout(() => flag(false), 2000);
  };

  const sidebarActions: SplitModalAction[] = [
    {
      id: 'copy-content',
      label: copied ? t('ui.copied') : t('ui.copy'),
      tooltip: t('ui.doc.copyAll'),
      icon: copied ? <Check className="h-4 w-4 text-emerald-400" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />,
      onClick: () => copyToClipboard(content, setCopied),
    },
    {
      id: 'copy-path',
      label: pathCopied ? t('ui.doc.pathCopied') : t('ui.doc.copyPath'),
      icon: pathCopied ? <Check className="h-4 w-4 text-emerald-400" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />,
      onClick: () => copyToClipboard(path, setPathCopied),
    },
  ];

  const typeBadge = doc && (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-micro font-extrabold uppercase ${TYPE_BADGE_CLASS[doc.type] ?? 'border-rose-500/40 bg-rose-500/20 text-rose-300'}`}
    >
      {doc.type}
    </span>
  );

  return (
    <SplitModal
      isOpen={!!doc}
      onClose={onClose}
      title={doc?.name}
      chips={
        doc && (
          <>
            {typeBadge}
            <span className="shrink-0 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-micro text-emerald-400">{doc.status}</span>
          </>
        )
      }
      sections={sections}
      activeItemId={`${DOCUMENT_PREFIX}${path}`}
      onActiveItemChange={handleSelect}
      sidebarActions={sidebarActions}
      sidebarFooter={
        <div className="flex min-w-0 flex-col gap-0.5 border-t border-foreground/10 px-3 pt-2">
          <span className="text-micro uppercase text-ink-500">{t('ui.doc.path')}</span>
          <span data-testid="document-viewer-path" className="block max-w-full truncate font-mono text-meta text-ink-100" title={path}>
            {path}
          </span>
        </div>
      }
      maxWidth="64rem"
      maxHeight="min(82vh, 52rem)"
      overlayClassName="bg-ink-950/80 backdrop-blur-md"
      closeLabel={t('ui.doc.closeAria')}
      closeTooltip={t('ui.doc.closeHint')}
      closeButtonProps={{ 'data-testid': 'modal-close-button' }}
      data-testid="document-viewer-modal"
      className="select-text rounded-2xl border border-foreground/15 bg-ink-950/95 text-ink-100 shadow-2xl backdrop-blur-2xl"
      bodyClassName="bg-ink-900/30 p-6"
    >
      {doc && (
        <>
          {isLoading ? (
            <div className="space-y-3 py-6">
              <Skeleton animation="pulse" height="1.5rem" width="33%" className="bg-foreground/10" />
              <Skeleton animation="pulse" height="1rem" className="bg-foreground/5" />
              <Skeleton animation="pulse" height="1rem" width="83%" className="bg-foreground/5" />
              <Skeleton animation="pulse" height="1rem" width="66%" className="bg-foreground/5" />
              <Skeleton animation="pulse" height="8rem" className="mt-4 bg-foreground/5" />
            </div>
          ) : loadFailed ? (
            <p data-testid="document-load-error" className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 font-mono text-xs text-rose-200">
              {t('mc.doc.loadFailed', { path: doc.path })}
            </p>
          ) : viewMode === 'raw' || isCodeOrJson ? (
            <div className="relative overflow-x-auto rounded-xl border border-foreground/10 bg-ink-950 p-4 font-mono text-xs leading-relaxed text-emerald-300">
              <pre className="whitespace-pre-wrap break-words">{content}</pre>
            </div>
          ) : (
            <Markdown text={content} density="doc" />
          )}
        </>
      )}
    </SplitModal>
  );
}
