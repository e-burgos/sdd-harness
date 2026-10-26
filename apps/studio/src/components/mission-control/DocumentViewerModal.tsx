'use client';

import React, { useState, useEffect } from 'react';
import { Code2, ClipboardList, Zap, FileText, Check, Copy, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentGeneratedDocument } from '@/lib/agent-documents';
import { useBridge } from '../BridgeProvider';

export interface DocumentViewerModalProps {
  document: AgentGeneratedDocument | null;
  onClose: () => void;
}

export function DocumentViewerModal({ document: doc, onClose }: DocumentViewerModalProps) {
  const { client } = useBridge();
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  const [copied, setCopied] = useState<boolean>(false);
  const [pathCopied, setPathCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!doc) return;
    let isCancelled = false;
    setIsLoading(true);

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
          // Si el archivo está fuera de sdd/ o no se pudo leer por WebSocket, fallback elegante
        }
      }

      if (!isCancelled) {
        // Fallback descriptivo con metadatos del documento
        const ext = doc.path.split('.').pop() || 'md';
        if (ext === 'json') {
          setContent(
            JSON.stringify(
              {
                document: doc.name,
                path: doc.path,
                type: doc.type,
                status: doc.status,
                description: doc.description,
              },
              null,
              2,
            ),
          );
        } else {
          setContent(
            `# ${doc.name}\n\n> **Ruta:** \`${doc.path}\` · **Tipo:** \`${doc.type.toUpperCase()}\` · **Estado:** \`${doc.status}\`\n\n${doc.description}\n\n---\n\n*Documento registrado en el ciclo SDD activo.*`,
          );
        }
        setIsLoading(false);
      }
    };

    void loadContent();

    return () => {
      isCancelled = true;
    };
  }, [doc, client]);

  // Cerrar al pulsar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!doc) return null;

  const isMarkdown = doc.path.endsWith('.md');
  const isCodeOrJson = doc.path.endsWith('.json') || doc.path.endsWith('.ts') || doc.path.endsWith('.tsx');

  const handleCopyContent = () => {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPath = () => {
    void navigator.clipboard.writeText(doc.path);
    setPathCopied(true);
    setTimeout(() => setPathCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={doc.name}
      data-testid="document-viewer-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-ink-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl max-h-[88vh] rounded-2xl border border-white/15 bg-ink-950/95 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden select-text text-white">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0 bg-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              {doc.type === 'code' ? (
                <Code2 className="w-5 h-5 text-emerald-400" />
              ) : doc.type === 'plan' || doc.type === 'wbs' ? (
                <ClipboardList className="w-5 h-5 text-purple-400" />
              ) : doc.type === 'fix' ? (
                <Zap className="w-5 h-5 text-amber-400" />
              ) : (
                <FileText className="w-5 h-5 text-sky-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white truncate font-sans">{doc.name}</h2>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase shrink-0 ${
                    doc.type === 'spec'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : doc.type === 'plan' || doc.type === 'wbs'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : doc.type === 'code'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : doc.type === 'context'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {doc.type}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  {doc.status}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-white/50 font-mono">
                <span className="truncate max-w-md" title={doc.path}>
                  {doc.path}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="hover:text-emerald-400 transition-colors text-[10px] flex items-center gap-1"
                  title="Copiar ruta"
                >
                  {pathCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiada</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar ruta</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle de Modo de Vista */}
            {isMarkdown && (
              <div className="flex items-center bg-white/10 p-0.5 rounded-lg border border-white/10 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setViewMode('rendered')}
                  className={`px-2.5 py-1 rounded transition-all ${
                    viewMode === 'rendered'
                      ? 'bg-emerald-500 text-ink-950 font-bold shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Renderizado
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('raw')}
                  className={`px-2.5 py-1 rounded transition-all ${
                    viewMode === 'raw'
                      ? 'bg-emerald-500 text-ink-950 font-bold shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Crudo / Fuente
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleCopyContent}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs font-mono font-medium transition-colors flex items-center gap-1.5"
              title="Copiar todo el contenido"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              data-testid="modal-close-button"
              aria-label="Cerrar modal de documento"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              title="Cerrar modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-ink-900/30">
          {isLoading ? (
            <div className="space-y-3 py-6">
              <div className="h-6 w-1/3 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-full bg-white/5 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-white/5 rounded animate-pulse" />
              <div className="h-4 w-4/6 bg-white/5 rounded animate-pulse" />
              <div className="h-32 w-full bg-white/5 rounded animate-pulse mt-4" />
            </div>
          ) : viewMode === 'raw' || isCodeOrJson ? (
            <div className="relative rounded-xl border border-white/10 bg-ink-950 p-4 font-mono text-xs leading-relaxed overflow-x-auto text-emerald-300">
              <pre className="whitespace-pre-wrap break-words">{content}</pre>
            </div>
          ) : (
            <div className="prose-studio max-w-none text-sm leading-relaxed select-text [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:border-b [&_h1]:border-white/10 [&_h1]:pb-2 [&_h1]:mb-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-white [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:my-2.5 [&_p]:text-white/80 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1 [&_li]:text-white/80 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-emerald-300 [&_pre]:overflow-auto [&_pre]:rounded-xl [&_pre]:bg-ink-950 [&_pre]:p-4 [&_pre]:border [&_pre]:border-white/10 [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500/60 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-white/60 [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_th]:border [&_th]:border-white/15 [&_th]:bg-white/5 [&_th]:p-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_td]:border [&_td]:border-white/10 [&_td]:p-2 [&_td]:text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
