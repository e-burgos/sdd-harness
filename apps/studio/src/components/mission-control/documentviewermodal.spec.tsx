import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentViewerModal } from './DocumentViewerModal';
import { BridgeContext } from '../BridgeProvider';
import { createStudioStore } from '@/lib/store/store';
import { I18nProvider } from '@/lib/i18n/i18n';
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
  };

  it('renders modal with document title, path and badges', async () => {
    mockClient.request.mockResolvedValueOnce({
      path: sampleDoc.path,
      content: '# Objetivo del Plan\n\nTexto de prueba.',
    });

    render(
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <DocumentViewerModal document={sampleDoc} onClose={() => {}} />
      </BridgeContext.Provider></I18nProvider>,
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
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <DocumentViewerModal document={sampleDoc} onClose={onClose} />
      </BridgeContext.Provider></I18nProvider>,
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
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <DocumentViewerModal document={sampleDoc} onClose={() => {}} />
      </BridgeContext.Provider></I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Título Markdown')).toBeInTheDocument();
    });

    const rawBtn = screen.getByText('Crudo / Fuente');
    fireEvent.click(rawBtn);

    expect(screen.getByText(/# Título Markdown/)).toBeInTheDocument();
  });

  it('renders as a centered portal on the body, outside the container that opens it', () => {
    mockClient.request.mockResolvedValueOnce({ path: sampleDoc.path, content: '# x' });
    const { container } = render(
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <DocumentViewerModal document={sampleDoc} onClose={() => {}} />
      </BridgeContext.Provider></I18nProvider>,
    );
    const modal = screen.getByTestId('document-viewer-modal');
    expect(container.contains(modal)).toBe(false);
    expect(modal.parentElement).toBe(document.body);
    expect(modal.className).toContain('fixed');
    expect(modal.className).toContain('inset-0');
    expect(modal.className).toContain('items-center');
    expect(modal.className).toContain('justify-center');
    expect(modal.firstElementChild?.className).toContain('max-w-4xl');
    expect(modal.firstElementChild?.className).toContain('max-h-[85vh]');
  });

  it('closes with Escape and with a click on the backdrop but not on the panel', () => {
    mockClient.request.mockResolvedValue({ path: sampleDoc.path, content: '# x' });
    const onClose = vi.fn();
    render(
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <DocumentViewerModal document={sampleDoc} onClose={onClose} />
      </BridgeContext.Provider></I18nProvider>,
    );
    const modal = screen.getByTestId('document-viewer-modal');
    fireEvent.click(modal.firstElementChild as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(modal);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows an honest error instead of invented content when the file cannot be read', async () => {
    mockClient.request.mockRejectedValueOnce(new Error('no such file'));
    render(
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <DocumentViewerModal document={sampleDoc} onClose={() => {}} />
      </BridgeContext.Provider></I18nProvider>,
    );
    expect(await screen.findByTestId('document-load-error')).toHaveTextContent(sampleDoc.path);
  });

  it('splits the header into an info zone and an actions zone with the close button after a divider', () => {
    mockClient.request.mockResolvedValue({ path: sampleDoc.path, content: '# x' });
    render(
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <DocumentViewerModal document={sampleDoc} onClose={() => {}} />
      </BridgeContext.Provider></I18nProvider>,
    );
    const path = screen.getByTestId('document-viewer-path');
    expect(path).toHaveAttribute('title', sampleDoc.path);
    expect(path.className).toContain('truncate');
    const actions = screen.getByTestId('document-viewer-actions');
    expect(actions.className).toContain('flex-wrap');
    expect(actions).not.toContainElement(path);
    const copyPath = screen.getByTestId('copy-path-button');
    expect(actions).toContainElement(copyPath);
    expect(copyPath.className).toContain('whitespace-nowrap');
    expect(copyPath.className).toContain('shrink-0');
    expect(copyPath).toHaveTextContent('Copiar ruta');
    expect(actions).toContainElement(screen.getByText('Renderizado'));
    expect(actions).toContainElement(screen.getByText('Copiar'));
    const divider = screen.getByTestId('document-viewer-divider');
    expect(actions).toContainElement(divider);
    const close = screen.getByTestId('modal-close-button');
    expect(divider.nextElementSibling).toBe(close);
    expect(screen.getByTestId('document-viewer-header').className).toContain('flex-wrap');
  });
});
