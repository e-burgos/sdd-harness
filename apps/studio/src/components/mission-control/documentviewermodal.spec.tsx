import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentViewerModal } from './DocumentViewerModal';
import { BridgeContext } from '../BridgeProvider';
import { createStudioStore } from '@/lib/store/store';
import type { AgentGeneratedDocument } from '@/lib/agent-documents';

const store = createStudioStore();
const mockClient = {
  request: vi.fn(),
  supports: vi.fn().mockReturnValue(true),
};

const mockBridgeValue: any = {
  client: mockClient,
  connection: { status: 'open' },
  pairing: { port: 3100, token: 'abc' },
  store,
  syncError: null,
  retrySync: () => {},
};

describe('DocumentViewerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleDoc: AgentGeneratedDocument = {
    id: 'test-plan',
    name: 'plan.md',
    path: 'sdd/specs/spec-e-burgos-004-studio-gates-topology/cycles/cycle-01/plan.md',
    type: 'plan',
    status: 'generated',
    description: 'Plan lite unificado de ejecución',
  };

  it('renders modal with document title, path and badges', async () => {
    mockClient.request.mockResolvedValueOnce({
      path: sampleDoc.path,
      content: '# Objetivo del Plan\n\nTexto de prueba.',
    });

    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <DocumentViewerModal document={sampleDoc} onClose={() => {}} />
      </BridgeContext.Provider>,
    );

    expect(screen.getByTestId('document-viewer-modal')).toBeInTheDocument();
    expect(screen.getByText('plan.md')).toBeInTheDocument();
    expect(screen.getByText('plan')).toBeInTheDocument();
    expect(screen.getByText('generated')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Objetivo del Plan')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <DocumentViewerModal document={sampleDoc} onClose={onClose} />
      </BridgeContext.Provider>,
    );

    const closeBtn = screen.getByTestId('modal-close-button');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('allows toggling between rendered markdown and raw view', async () => {
    mockClient.request.mockResolvedValueOnce({
      path: sampleDoc.path,
      content: '# Título Markdown\n\nContenido de prueba.',
    });

    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <DocumentViewerModal document={sampleDoc} onClose={() => {}} />
      </BridgeContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Título Markdown')).toBeInTheDocument();
    });

    const rawBtn = screen.getByText('Crudo / Fuente');
    fireEvent.click(rawBtn);

    expect(screen.getByText(/# Título Markdown/)).toBeInTheDocument();
  });
});
