import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { AgentAvatar } from './AgentAvatar';

const renderAvatar = (ui: React.ReactElement) => render(<I18nProvider initial="es">{ui}</I18nProvider>);

describe('AgentAvatar', () => {
  it('renders Clara with her drawn face and leader badge', () => {
    const { container } = renderAvatar(<AgentAvatar agent="sdd-orchestrator" size={32} />);
    expect(screen.getByTestId('agent-face-sdd-orchestrator')).toBeInTheDocument();
    expect(screen.getByTestId('agent-leader-crown')).toBeInTheDocument();
    const wrapper = container.querySelector('.group');
    fireEvent.mouseEnter(wrapper as Element);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Clara');
  });

  it('renders a specialist agent without leader crown', () => {
    renderAvatar(<AgentAvatar agent="sdd-implementor-back" size={32} />);
    expect(screen.getByTestId('agent-face-sdd-implementor-back')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-leader-crown')).toBeNull();
  });
});
