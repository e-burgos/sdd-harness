import { act, fireEvent, screen, within } from '@testing-library/react';
import { PANEL_STATE_KEY } from '@/lib/use-panel-state';
import { StudioShell } from './StudioShell';
import { renderShell } from './shell-test-utils';

const setWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
};

const rail = () => within(screen.getByRole('navigation', { name: 'Módulos' }));
const body = () => screen.getByTestId('shell-body');

describe('StudioShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setWidth(1440);
  });

  it('shows rail, module panel, center and right panel for a module with all three', () => {
    renderShell(<StudioShell />);
    fireEvent.click(rail().getByRole('button', { name: 'Specs' }));
    expect(body()).toHaveAttribute('data-module', 'specs');
    expect(body().style.gridTemplateColumns).toBe('240px minmax(0,1fr) 320px');
    expect(screen.getByRole('complementary', { name: 'Specs' })).toBeInTheDocument();
    expect(screen.getByTestId('module-center')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Detalles' })).toBeInTheDocument();
  });

  it('drops the right column for modules without a right panel', () => {
    renderShell(<StudioShell />);
    fireEvent.click(rail().getByRole('button', { name: 'Actividad' }));
    expect(body().style.gridTemplateColumns).toBe('240px minmax(0,1fr)');
    expect(screen.queryByRole('complementary', { name: 'Detalles' })).not.toBeInTheDocument();
  });

  it('always shows the panel and the center of the same module', () => {
    renderShell(<StudioShell />);
    fireEvent.click(rail().getByRole('button', { name: 'Fixes' }));
    expect(screen.getByRole('complementary', { name: 'Fixes' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Specs' })).not.toBeInTheDocument();
    expect(body()).toHaveAttribute('data-module', 'fixes');
  });

  it('renders Home and Map as three-column modules', () => {
    renderShell(<StudioShell />);
    expect(body()).toHaveAttribute('data-module', 'home');
    expect(body().style.gridTemplateColumns).toBe('240px minmax(0,1fr) 320px');
    expect(screen.getByRole('heading', { name: '# general' })).toBeInTheDocument();
    fireEvent.click(rail().getByRole('button', { name: 'Mapa' }));
    expect(screen.getByTestId('agent-map-canvas')).toBeInTheDocument();
    expect(body().style.gridTemplateColumns).toBe('240px minmax(0,1fr) 320px');
  });

  it('collapses the panel to a rail strip and expands it again', () => {
    renderShell(<StudioShell />);
    fireEvent.click(rail().getByRole('button', { name: 'Specs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Colapsar menú' }));
    expect(body().style.gridTemplateColumns).toBe('44px minmax(0,1fr) 320px');
    expect(JSON.parse(window.localStorage.getItem(PANEL_STATE_KEY) ?? '{}').sidebarCollapsed).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Expandir menú' }));
    expect(body().style.gridTemplateColumns).toBe('240px minmax(0,1fr) 320px');
  });

  it('collapses the right panel', () => {
    renderShell(<StudioShell />);
    fireEvent.click(rail().getByRole('button', { name: 'Specs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Colapsar panel' }));
    expect(body().style.gridTemplateColumns).toBe('240px minmax(0,1fr) 44px');
  });

  it('starts with the right panel collapsed under 1024px', () => {
    setWidth(900);
    renderShell(<StudioShell />);
    fireEvent.click(rail().getByRole('button', { name: 'Specs' }));
    expect(body().style.gridTemplateColumns).toBe('240px minmax(0,1fr) 44px');
    fireEvent.click(screen.getByRole('button', { name: 'Expandir panel' }));
    expect(body().style.gridTemplateColumns).toBe('240px minmax(0,1fr) 320px');
  });

  it('turns the panel into an overlay under 768px that the module icon opens', () => {
    setWidth(600);
    renderShell(<StudioShell />);
    fireEvent.click(rail().getByRole('button', { name: 'Specs' }));
    expect(body().style.gridTemplateColumns).toBe('minmax(0,1fr) 44px');
    const overlay = screen.getByTestId('panel-overlay');
    expect(within(overlay).getByRole('complementary', { name: 'Specs' })).toBeInTheDocument();
    fireEvent.click(rail().getByRole('button', { name: 'Specs' }));
    expect(screen.queryByTestId('panel-overlay')).not.toBeInTheDocument();
    fireEvent.click(rail().getByRole('button', { name: 'Specs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar lista' }));
    expect(screen.queryByTestId('panel-overlay')).not.toBeInTheDocument();
  });

  it('still shows the active module after hiding it from the rail', () => {
    renderShell(<StudioShell />);
    fireEvent.click(rail().getByRole('button', { name: 'Fixes' }));
    fireEvent.click(rail().getByRole('button', { name: 'Más' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar Fixes' }));
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(body()).toHaveAttribute('data-module', 'fixes');
    expect(screen.getByRole('complementary', { name: 'Fixes' })).toBeInTheDocument();
  });

  it('the new conversation button in the rail goes Home', () => {
    renderShell(<StudioShell />);
    fireEvent.click(rail().getByRole('button', { name: 'Specs' }));
    fireEvent.click(screen.getByTestId('new-conversation-button'));
    expect(body()).toHaveAttribute('data-module', 'home');
  });
});
