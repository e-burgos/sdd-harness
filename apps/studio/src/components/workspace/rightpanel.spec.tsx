import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { RightPanelView } from './RightPanel';

describe('RightPanelView', () => {
  it('shows activity and the cycle checklist', () => {
    const onOpenThread = vi.fn();
    render(
      <I18nProvider initial="es">
        <RightPanelView
          activity={[{ threadId: 't', title: 'pagos v2', status: 'running', agents: [{ agent: 'sdd-implementor-back', state: 'working', tool: 'Edit' }] }]}
          cycle={{ specId: 's', cycle: 'cycle-02', status: 'in-progress', flow: 'full', apps: ['apps/api'], tasksTotal: 2, tasksDone: 1, tasks: [
            { id: 'BE-001', title: 'Endpoint', status: 'done', storyPoints: 3 },
            { id: 'BE-002', title: 'Tests', status: 'in-progress', storyPoints: 2 },
          ] }}
          onOpenThread={onOpenThread}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('Impl-back')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('1/2 tasks')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Panel de actividad y detalles' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '2');
    expect(screen.getByText('hecha')).toBeInTheDocument();
    expect(screen.getAllByText('trabajando')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /pagos v2/ }));
    expect(onOpenThread).toHaveBeenCalledWith('t');
  });
  it('shows empty states', () => {
    render(<I18nProvider initial="es"><RightPanelView activity={[]} cycle={null} onOpenThread={vi.fn()} /></I18nProvider>);
    expect(screen.getByText('Nadie está trabajando ahora.')).toBeInTheDocument();
    expect(screen.getByText('Este canal no tiene un ciclo activo.')).toBeInTheDocument();
  });
});
