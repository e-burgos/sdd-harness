import { fireEvent, render, screen } from '@testing-library/react';
import { BridgeContext } from '../BridgeProvider';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import type { ConversationDocument, RelatedFix, RelatedSpec } from '@/lib/conversation';
import { RelatedDocuments } from './RelatedDocuments';

const bridge: any = {
  client: { request: vi.fn().mockResolvedValue({ path: 'p', content: '# doc' }), supports: vi.fn().mockReturnValue(true) },
  connection: { status: 'open' },
  pairing: { port: 3100, token: 'abc' },
  store: createStudioStore(),
  syncError: null,
  retrySync: () => {},
};

const planDoc: ConversationDocument = { path: 'sdd/specs/spec-a/cycles/cycle-01/plan.md', name: 'plan.md', specId: 'spec-a', fixId: null, modified: true };
const fixDoc: ConversationDocument = { path: 'sdd/specs/spec-a/fixes/fix-1.md', name: 'fix-1.md', specId: 'spec-a', fixId: 'FIX-1', modified: false };

const renderDocs = (
  specs: RelatedSpec[],
  fixes: RelatedFix[],
  documents: ConversationDocument[] = [],
  { open = true, onToggle = () => {} }: { open?: boolean; onToggle?: () => void } = {},
) =>
  render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={bridge}>
        <RelatedDocuments specs={specs} fixes={fixes} documents={documents} open={open} onToggle={onToggle} />
      </BridgeContext.Provider>
    </I18nProvider>,
  );

describe('RelatedDocuments', () => {
  it('shows the empty state without specs or fixes', () => {
    renderDocs([], []);
    expect(screen.getByTestId('related-documents-empty')).toHaveTextContent('Sin specs ni fixes relacionados');
  });

  it('hides the body when collapsed and reports the toggle', () => {
    const onToggle = vi.fn();
    renderDocs([{ specId: 'spec-a', cycle: null, source: 'event', known: true }], [], [planDoc], { open: false, onToggle });
    expect(screen.queryByTestId('related-documents-body')).toBeNull();
    expect(screen.getByTestId('related-documents-toggle')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByTestId('related-documents-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('lists only the conversation documents under their spec and shows the cycle of the event', () => {
    renderDocs([{ specId: 'spec-a', cycle: 'cycle-01', source: 'event', known: true }], [], [planDoc, fixDoc]);
    expect(screen.getByText('ciclo cycle-01')).toBeInTheDocument();
    const buttons = [...screen.getByTestId('related-spec-spec-a').querySelectorAll('button')].map((b) => b.getAttribute('title'));
    expect(buttons).toEqual([planDoc.path]);
  });

  it('lists a link-only spec that is not in the workspace without documents', () => {
    renderDocs([{ specId: 'spec-zzz', cycle: 'cycle-01', source: 'link', known: false }], []);
    const row = screen.getByTestId('related-spec-spec-zzz');
    expect(row).toHaveTextContent('no está en el workspace');
    expect(row.querySelectorAll('button')).toHaveLength(0);
  });

  it('lists fix documents under their fix', () => {
    renderDocs([], [{ fixId: 'FIX-1', specId: 'spec-a', source: 'event', known: true }, { fixId: 'FIX-2', specId: null, source: 'event', known: true }], [fixDoc]);
    expect(screen.getByTestId('related-fix-FIX-1').querySelectorAll('button')).toHaveLength(1);
    expect(screen.getByTestId('related-fix-FIX-2').querySelectorAll('button')).toHaveLength(0);
  });

  it('opens the document viewer when a document is clicked', () => {
    renderDocs([{ specId: 'spec-a', cycle: 'cycle-01', source: 'event', known: true }], [], [planDoc]);
    fireEvent.click(screen.getByTestId('related-spec-spec-a').querySelector('button') as HTMLElement);
    expect(screen.getByTestId('document-viewer-modal')).toBeInTheDocument();
  });
});
