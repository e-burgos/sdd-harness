import { render, screen, fireEvent } from '@testing-library/react';
import { AgentInspectorDrawer } from './AgentInspectorDrawer';

describe('AgentInspectorDrawer', () => {
  it('renders drawer for Clara with full personality, role and DM button', () => {
    const onClose = vi.fn();
    const onOpenDm = vi.fn();

    render(
      <AgentInspectorDrawer
        agentId="sdd-orchestrator"
        presence={{ agent: 'sdd-orchestrator', state: 'working', threadId: 't-1', specId: 's-1', tool: 'git status' }}
        onClose={onClose}
        onOpenDm={onOpenDm}
      />
    );

    expect(screen.getByTestId('agent-inspector-drawer')).toBeInTheDocument();
    expect(screen.getByText('LEADER')).toBeInTheDocument();
    expect(screen.getByText(/Directora de Orquesta/)).toBeInTheDocument();
    expect(screen.getByText(/git status/)).toBeInTheDocument();

    const dmBtn = screen.getByText(/Abrir chat directo con Clara/);
    fireEvent.click(dmBtn);
    expect(onOpenDm).toHaveBeenCalledWith('sdd-orchestrator');
    expect(onClose).toHaveBeenCalled();
  });

  it('returns null if agentId is null', () => {
    const { container } = render(
      <AgentInspectorDrawer agentId={null} onClose={() => {}} onOpenDm={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });
});
