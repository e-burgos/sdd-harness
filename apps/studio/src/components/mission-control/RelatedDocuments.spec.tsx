import { fireEvent, render, screen } from '@testing-library/react';
import type { CycleSummary } from '@sdd-studio/protocol';
import { BridgeContext } from '../BridgeProvider';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import type { RelatedFix, RelatedSpec } from '@/lib/conversation';
import { RelatedDocuments } from './RelatedDocuments';

const bridge: any = {
  client: { request: vi.fn().mockResolvedValue({ path: 'p', content: '# doc' }), supports: vi.fn().mockReturnValue(true) },
  connection: { status: 'open' },
  pairing: { port: 3100, token: 'abc' },
  store: createStudioStore(),
  syncError: null,
  retrySync: () => {},
};

const cycles: CycleSummary[] = [
  { specId: 'spec-a', cycle: 'cycle-01', status: 'completed', flow: 'full', apps: [], tasks: [], tasksTotal: 1, tasksDone: 1 },
  { specId: 'spec-a', cycle: 'cycle-02', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 1, tasksDone: 0 },
];

const renderDocs = (specs: RelatedSpec[], fixes: RelatedFix[]) =>
  render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={bridge}>
        <RelatedDocuments agentId="sdd-orchestrator" specs={specs} fixes={fixes} cycles={cycles} />
      </BridgeContext.Provider>
    </I18nProvider>,
  );

describe('RelatedDocuments', () => {
  it('shows the empty state without specs or fixes', () => {
    renderDocs([], []);
    expect(screen.getByTestId('related-documents-empty')).toHaveTextContent('Sin specs ni fixes relacionados');
  });

  it('links a known spec to the latest cycle of the snapshot when the event has none', () => {
    renderDocs([{ specId: 'spec-a', cycle: null, source: 'event', known: true }], []);
    const row = screen.getByTestId('related-spec-spec-a');
    const paths = [...row.querySelectorAll('button')].map((b) => b.getAttribute('title') ?? '');
    expect(paths.some((p) => p.includes('spec-a/cycles/cycle-02'))).toBe(true);
    expect(paths.some((p) => p.includes('cycle-01'))).toBe(false);
  });

  it('uses the cycle mentioned in the event', () => {
    renderDocs([{ specId: 'spec-a', cycle: 'cycle-01', source: 'event', known: true }], []);
    expect(screen.getByText('ciclo cycle-01')).toBeInTheDocument();
    const paths = [...screen.getByTestId('related-spec-spec-a').querySelectorAll('button')].map((b) => b.getAttribute('title') ?? '');
    expect(paths.some((p) => p.includes('cycles/cycle-01'))).toBe(true);
  });

  it('lists an unknown spec without links', () => {
    renderDocs([{ specId: 'spec-zzz', cycle: 'cycle-01', source: 'event', known: false }], []);
    const row = screen.getByTestId('related-spec-spec-zzz');
    expect(row).toHaveTextContent('no está en el workspace');
    expect(row.querySelectorAll('button')).toHaveLength(0);
  });

  it('links a known fix with its spec and lists a repo-level fix without links', () => {
    renderDocs([], [
      { fixId: 'FIX-1', specId: 'spec-a', source: 'event', known: true },
      { fixId: 'FIX-2', specId: null, source: 'event', known: true },
    ]);
    expect(screen.getByTestId('related-fix-FIX-1').querySelectorAll('button').length).toBeGreaterThan(0);
    expect(screen.getByTestId('related-fix-FIX-2').querySelectorAll('button')).toHaveLength(0);
  });

  it('opens the document viewer when a document is clicked', () => {
    renderDocs([{ specId: 'spec-a', cycle: 'cycle-01', source: 'event', known: true }], []);
    fireEvent.click(screen.getByTestId('related-spec-spec-a').querySelector('button') as HTMLElement);
    expect(screen.getByTestId('document-viewer-modal')).toBeInTheDocument();
  });
});
