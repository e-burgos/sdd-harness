'use client';

import { Button, Skeleton, SplitModal, Tooltip, type SplitModalSection } from '@e-burgos/tucu-ui';
import React, { useState, useEffect } from 'react';
import { Code2, ClipboardList, Zap, FileText, Check, Copy, Link2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

const RELATED_PREFIX = 'related:';

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

  const others = related.filter((item) => item.path !== path);
  const sections: SplitModalSection[] = [
    ...(isMarkdown
      ? [
          {
            id: 'view',
            label: t('ui.doc.view'),
            items: [
              { id: 'rendered', label: t('ui.doc.rendered') },
              { id: 'raw', label: t('ui.doc.raw') },
            ],
          },
        ]
      : []),
    ...(others.length > 0
      ? [
          {
            id: 'related',
            label: t('ui.doc.related'),
            items: others.map((item) => ({
              id: `${RELATED_PREFIX}${item.path}`,
              label: item.name,
              icon: <DocumentTypeIcon type={item.type} />,
              description: item.type,
            })),
          },
        ]
      : []),
  ];

  const handleSelect = (id: string) => {
    if (id.startsWith(RELATED_PREFIX)) {
      const target = others.find((item) => item.path === id.slice(RELATED_PREFIX.length));
      if (target) onNavigate?.(target);
      return;
    }
    setViewMode(id as ViewMode);
  };

  const handleCopyContent = () => {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPath = () => {
    void navigator.clipboard.writeText(path);
    setPathCopied(true);
    setTimeout(() => setPathCopied(false), 2000);
  };

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
      activeItemId={isMarkdown ? viewMode : undefined}
      onActiveItemChange={handleSelect}
      sidebarHeader={
        doc && (
          <p data-testid="document-viewer-path" className="truncate font-mono text-meta text-ink-500" title={doc.path}>
            {doc.path}
          </p>
        )
      }
      sidebarFooter={
        <div data-testid="document-viewer-actions" className="flex flex-wrap items-center gap-2">
          <Tooltip content={t('ui.doc.copyAll')} size="xs" arrow={false} maxWidth={256} contentClassName="text-left">
            <Button type="button" onClick={handleCopyContent} variant="transparent" color="gray" size="tiny" className="whitespace-nowrap font-mono">
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">{t('ui.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>{t('ui.copy')}</span>
                </>
              )}
            </Button>
          </Tooltip>
          <Tooltip content={t('ui.doc.copyPath')} size="xs" arrow={false} maxWidth={256} contentClassName="text-left">
            <Button type="button" onClick={handleCopyPath} data-testid="copy-path-button" variant="transparent" color="gray" size="tiny" className="whitespace-nowrap font-mono">
              {pathCopied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">{t('ui.doc.pathCopied')}</span>
                </>
              ) : (
                <>
                  <Link2 className="h-3 w-3" />
                  <span>{t('ui.doc.copyPath')}</span>
                </>
              )}
            </Button>
          </Tooltip>
        </div>
      }
      maxWidth="64rem"
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
            <div className="prose-studio mx-auto max-w-[72ch] text-copy leading-7 select-text [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-ink-100 [&_h1]:border-b [&_h1]:border-foreground/10 [&_h1]:pb-2 [&_h1]:mb-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink-100 [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink-100 [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:my-2.5 [&_p]:text-ink-100 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1 [&_li]:text-ink-100 [&_code]:rounded [&_code]:bg-foreground/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-emerald-300 [&_pre]:overflow-auto [&_pre]:rounded-xl [&_pre]:bg-ink-950 [&_pre]:p-4 [&_pre]:border [&_pre]:border-foreground/10 [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500/60 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-300 [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_th]:border [&_th]:border-foreground/15 [&_th]:bg-foreground/5 [&_th]:p-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_td]:border [&_td]:border-foreground/10 [&_td]:p-2 [&_td]:text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </>
      )}
    </SplitModal>
  );
}
