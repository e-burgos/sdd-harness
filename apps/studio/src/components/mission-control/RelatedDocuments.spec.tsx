import { fireEvent, render, screen } from '@testing-library/react';
import { BridgeContext } from '../BridgeProvider';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import type { ConversationDocument, DocumentSource, RelatedFix, RelatedSpec } from '@/lib/conversation';
import { RelatedDocuments } from './RelatedDocuments';

const bridge: any = {
  client: { request: vi.fn().mockResolvedValue({ path: 'p', content: '# doc' }), supports: vi.fn().mockReturnValue(true) },
  connection: { status: 'open' },
  pairing: { port: 3100, token: 'abc' },
  store: createStudioStore(),
  syncError: null,
  retrySync: () => {},
};

const planDoc: ConversationDocument = { path: 'sdd/specs/spec-a/cycles/cycle-01/plan.md', name: 'plan.md', specId: 'spec-a', fixId: null, cycle: 'cycle-01', agents: ['sdd-planner'] };
const fixDoc: ConversationDocument = { path: 'sdd/specs/spec-a/fixes/fix-1.md', name: 'fix-1.md', specId: 'spec-a', fixId: 'FIX-1', cycle: null, agents: ['sdd-reviewer'] };

const renderDocs = (
  specs: RelatedSpec[],
  fixes: RelatedFix[],
  documents: ConversationDocument[] = [],
  { open = true, onToggle = () => {}, emptyMessage, documentSource }: { open?: boolean; onToggle?: () => void; emptyMessage?: string; documentSource?: DocumentSource } = {},
) =>
  render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={bridge}>
        <RelatedDocuments specs={specs} fixes={fixes} documents={documents} documentSource={documentSource} emptyMessage={emptyMessage} open={open} onToggle={onToggle} />
      </BridgeContext.Provider>
    </I18nProvider>,
  );

describe('RelatedDocuments', () => {
  it('shows the empty state without specs or fixes', () => {
    renderDocs([], []);
    expect(screen.getByTestId('related-documents-empty')).toHaveTextContent('Sin documentos generados en esta conversación');
  });

  it('hides the body when collapsed and reports the toggle', () => {
    const onToggle = vi.fn();
    renderDocs([{ specId: 'spec-a', cycle: null, cycles: [] }], [], [planDoc], { open: false, onToggle });
    expect(screen.queryByTestId('related-documents-body')).toBeNull();
    expect(screen.getByTestId('related-documents-toggle')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByTestId('related-documents-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('lists only the conversation documents under their spec and shows the cycle of the event', () => {
    renderDocs([{ specId: 'spec-a', cycle: 'cycle-01', cycles: ['cycle-01'] }], [], [planDoc, fixDoc]);
    expect(screen.getByText('Ciclo cycle-01')).toBeInTheDocument();
    const buttons = [...screen.getByTestId('related-spec-spec-a').querySelectorAll('button')].map((b) => b.getAttribute('title'));
    expect(buttons).toEqual([planDoc.path]);
  });

  it('shows the custom empty message for an agent that generated nothing', () => {
    renderDocs([], [], [], { emptyMessage: 'Este agente no generó documentos en esta conversación' });
    expect(screen.getByTestId('related-documents-empty')).toHaveTextContent('Este agente no generó documentos en esta conversación');
  });

  it('lists fix documents under their fix', () => {
    renderDocs([], [{ fixId: 'FIX-1', specId: 'spec-a' }], [fixDoc]);
    expect(screen.getByTestId('related-fix-FIX-1').querySelectorAll('button')).toHaveLength(1);
  });

  it('opens the document viewer when a document is clicked', () => {
    renderDocs([{ specId: 'spec-a', cycle: 'cycle-01', cycles: ['cycle-01'] }], [], [planDoc]);
    fireEvent.click(screen.getByTestId('related-spec-spec-a').querySelector('button') as HTMLElement);
    expect(screen.getByTestId('document-viewer-modal')).toBeInTheDocument();
  });

  it('groups a spec into root and ordered cycles with counts and authoring agents', () => {
    const doc = (name: string, cycle: string | null, agent: string): ConversationDocument => ({
      path: `sdd/specs/spec-a/${cycle ? `cycles/${cycle}/` : ''}${name}`,
      name,
      specId: 'spec-a',
      fixId: null,
      cycle,
      agents: [agent],
    });
    renderDocs(
      [{ specId: 'spec-a', cycle: 'cycle-02', cycles: ['cycle-01', 'cycle-02'] }],
      [],
      [doc('plan.md', 'cycle-02', 'sdd-planner'), doc('spec.md', null, 'sdd-orchestrator'), doc('brief.yaml', 'cycle-01', 'sdd-orchestrator'), doc('tasks.json', 'cycle-02', 'sdd-planner')],
    );
    const groups = [...screen.getByTestId('related-spec-spec-a').querySelectorAll('[data-testid^="related-group-"]')];
    expect(groups.map((g) => g.getAttribute('data-testid'))).toEqual(['related-group-spec-a-root', 'related-group-spec-a-cycle-01', 'related-group-spec-a-cycle-02']);
    expect(groups[0]).toHaveTextContent('Raíz de la spec1');
    expect(groups[2]).toHaveTextContent('Ciclo cycle-022');
    expect(screen.getAllByText('sdd-planner')).toHaveLength(2);
  });

  it('links a fix to its spec and counts its documents', () => {
    renderDocs([{ specId: 'spec-a', cycle: null, cycles: [] }], [{ fixId: 'FIX-1', specId: 'spec-a' }], [fixDoc]);
    const item = screen.getByTestId('related-fix-FIX-1');
    expect(item).toHaveTextContent('en spec-a');
    expect(item).toHaveTextContent('FIX-11');
  });

  it('does not list a spec that was only mentioned and has no documents', () => {
    renderDocs([], [], []);
    expect(screen.queryByTestId('related-spec-spec-a')).toBeNull();
    expect(screen.getByTestId('related-documents-empty')).toBeInTheDocument();
  });

  it('truncates long ids with min-w-0 and a full-text title so nothing overflows the narrow panel', () => {
    const longSpec = 'spec-e-burgos-005-studio-conversation-sessions-with-a-very-long-slug';
    const longFix = 'FIX-e-burgos-005-004';
    const longDoc: ConversationDocument = {
      path: `sdd/specs/${longSpec}/cycles/cycle-01/architect-decisions-and-contracts.md`,
      name: 'architect-decisions-and-contracts.md',
      specId: longSpec,
      fixId: null,
      cycle: 'cycle-01',
      agents: ['sdd-architect', 'sdd-planner', 'sdd-reviewer'],
    };
    renderDocs([{ specId: longSpec, cycle: 'cycle-01', cycles: ['cycle-01'] }], [{ fixId: longFix, specId: longSpec }], [longDoc]);
    const specId = screen.getByTitle(longSpec);
    expect(specId).toHaveClass('truncate', 'min-w-0');
    const name = screen.getByTitle(longDoc.name);
    expect(name).toHaveClass('truncate', 'min-w-0');
    const agents = screen.getByTitle('sdd-architect, sdd-planner, sdd-reviewer');
    expect(agents).toHaveClass('truncate', 'min-w-0', 'text-xs');
    const inSpec = screen.getByTitle(`en ${longSpec}`);
    expect(inSpec).toHaveClass('truncate', 'min-w-0');
    expect(screen.getByTestId('related-documents')).toHaveClass('min-w-0', 'overflow-hidden');
  });

  it('always shows the file name on the fix document row, separate from the agents', () => {
    renderDocs([], [{ fixId: 'FIX-1', specId: 'spec-a' }], [fixDoc]);
    const row = screen.getByTestId('related-fix-FIX-1').querySelector('button')!;
    expect(row).toHaveTextContent('fix-1.md');
    expect(row).toHaveTextContent('sdd-reviewer');
    expect(screen.getByTitle('fix-1.md')).toBeInTheDocument();
  });

  it('shows the operation and the source only when they are known', () => {
    const specs = [{ specId: 'spec-a', cycle: 'cycle-01', cycles: ['cycle-01'] }];
    const { unmount } = renderDocs(specs, [], [planDoc]);
    expect(screen.queryByTestId('document-op-created')).toBeNull();
    expect(screen.queryByTestId('related-documents-source')).toBeNull();
    unmount();
    renderDocs(specs, [], [{ ...planDoc, op: 'created' }], { documentSource: 'mixed' });
    expect(screen.getByTestId('document-op-created')).toHaveTextContent('creado');
    expect(screen.getByTestId('related-documents-source')).toHaveTextContent('Inferido de las herramientas y registrado por el puente');
  });

  it('does not offer to open a deleted document in the viewer', () => {
    const specs = [{ specId: 'spec-a', cycle: 'cycle-01', cycles: ['cycle-01'] }];
    renderDocs(specs, [], [{ ...planDoc, op: 'deleted' }]);
    const button = screen.getByTitle('Eliminado: ya no hay contenido para abrir en el visor');
    expect(button).toBeDisabled();
    expect(screen.getByTestId('document-op-deleted')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByTestId('document-viewer-modal')).toBeNull();
  });
});
