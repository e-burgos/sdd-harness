import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
    const overlay = modal.parentElement as HTMLElement;
    expect(overlay.parentElement).toBe(document.body);
    expect(overlay.className).toContain('fixed');
    expect(overlay.className).toContain('inset-0');
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'plan.md' })).toBe(modal);
    expect(overlay.className).toContain('backdrop-blur-md');
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
    const overlay = modal.parentElement as HTMLElement;
    fireEvent.mouseDown(overlay);
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(modal, { key: 'Escape' });
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

  it('shows the path as an info item and the copy actions in the sidebar, with the close button and its hint in the header', async () => {
    mockClient.request.mockResolvedValue({ path: sampleDoc.path, content: '# x' });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <DocumentViewerModal document={sampleDoc} onClose={() => {}} />
      </BridgeContext.Provider></I18nProvider>,
    );
    const dialog = screen.getByTestId('document-viewer-modal');
    const path = screen.getByTestId('document-viewer-path');
    expect(path).toHaveAttribute('title', sampleDoc.path);
    expect(path.className).toContain('truncate');
    expect(dialog).toContainElement(path);
    await screen.findByText('x');
    fireEvent.click(within(dialog).getByRole('button', { name: /Copiar ruta/ }));
    expect(writeText).toHaveBeenCalledWith(sampleDoc.path);
    fireEvent.click(within(dialog).getByRole('button', { name: /^Copiar$/ }));
    expect(writeText).toHaveBeenCalledWith('# x');
    expect(screen.getByTestId('modal-close-button')).toBeInTheDocument();
  });

  it('exposes the view section as a radio group independent from the documents navigation', () => {
    mockClient.request.mockResolvedValue({ path: sampleDoc.path, content: '# x' });
    render(
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <DocumentViewerModal document={sampleDoc} onClose={() => {}} />
      </BridgeContext.Provider></I18nProvider>,
    );
    const dialog = screen.getByTestId('document-viewer-modal');
    expect(within(dialog).getByRole('radio', { name: 'Renderizado' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(dialog).getByRole('radio', { name: /Crudo/ }));
    expect(within(dialog).getByRole('radio', { name: /Crudo/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByRole('radio', { name: 'Renderizado' })).toHaveAttribute('aria-checked', 'false');
  });

  it('lists every document including the open one as active and navigates to another without closing', () => {
    mockClient.request.mockResolvedValue({ path: sampleDoc.path, content: '# x' });
    const other: AgentGeneratedDocument = { id: 'o', name: 'brief.yaml', path: 'sdd/specs/s/brief.yaml', type: 'spec', status: 'generated' };
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <DocumentViewerModal document={sampleDoc} onClose={onClose} related={[sampleDoc, other]} onNavigate={onNavigate} />
      </BridgeContext.Provider></I18nProvider>,
    );
    const dialog = screen.getByTestId('document-viewer-modal');
    const current = within(dialog).getAllByRole('button', { name: /plan\.md/ })[0];
    expect(current).toHaveAttribute('aria-current', 'page');
    fireEvent.click(current);
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getAllByRole('button', { name: /brief\.yaml/ })[0]);
    expect(onNavigate).toHaveBeenCalledWith(other);
    expect(onClose).not.toHaveBeenCalled();
  });
});
