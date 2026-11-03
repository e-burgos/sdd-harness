'use client';

import { useCallback, useState, type ReactNode } from 'react';
import type { AgentGeneratedDocument } from '@/lib/agent-documents';
import { DocumentViewerModal } from '../../mission-control/DocumentViewerModal';
import { toViewerDocument } from './specs-model';

export function useDocumentViewer(): { open: (path: string, siblings?: readonly string[]) => void; viewer: ReactNode } {
  const [state, setState] = useState<{ document: AgentGeneratedDocument; related: AgentGeneratedDocument[] } | null>(null);
  const open = useCallback((path: string, siblings: readonly string[] = []) => {
    setState({ document: toViewerDocument(path), related: siblings.filter((p) => p !== path).map(toViewerDocument) });
  }, []);
  const viewer = state ? (
    <DocumentViewerModal
      document={state.document}
      related={state.related}
      onClose={() => setState(null)}
      onNavigate={(document) => setState((current) => (current ? { document, related: current.related } : current))}
    />
  ) : null;
  return { open, viewer };
}
