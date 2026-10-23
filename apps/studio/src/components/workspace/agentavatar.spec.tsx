import { render, screen } from '@testing-library/react';
import { AgentAvatar } from './AgentAvatar';

describe('AgentAvatar', () => {
  it('renders Clara with her shortcode and leader badge', () => {
    const { container } = render(<AgentAvatar agent="sdd-orchestrator" size={32} />);
    expect(screen.getByText('CL')).toBeInTheDocument();
    expect(screen.getByText('👑')).toBeInTheDocument();
    const wrapper = container.querySelector('.group');
    expect(wrapper).toHaveAttribute('title', expect.stringContaining('Clara'));
  });

  it('renders a specialist agent without leader crown', () => {
    render(<AgentAvatar agent="sdd-implementor-back" size={32} />);
    expect(screen.getByText('VU')).toBeInTheDocument();
    expect(screen.queryByText('👑')).toBeNull();
  });
});
