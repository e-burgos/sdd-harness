import { render, screen } from '@testing-library/react';
import { AgentAvatar } from './AgentAvatar';

describe('AgentAvatar', () => {
  it('renders Clara with her drawn face and leader badge', () => {
    const { container } = render(<AgentAvatar agent="sdd-orchestrator" size={32} />);
    expect(screen.getByTestId('agent-face-sdd-orchestrator')).toBeInTheDocument();
    expect(screen.getByText('👑')).toBeInTheDocument();
    const wrapper = container.querySelector('.group');
    expect(wrapper).toHaveAttribute('title', expect.stringContaining('Clara'));
  });

  it('renders a specialist agent without leader crown', () => {
    render(<AgentAvatar agent="sdd-implementor-back" size={32} />);
    expect(screen.getByTestId('agent-face-sdd-implementor-back')).toBeInTheDocument();
    expect(screen.queryByText('👑')).toBeNull();
  });
});
