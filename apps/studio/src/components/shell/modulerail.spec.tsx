import { fireEvent, screen, within } from '@testing-library/react';
import { MODULE_ICONS } from '@/lib/nav/modules';
import { RAIL_KEY_PREFIX, useRailPreferences } from '@/lib/nav/use-rail-preferences';
import type { ModuleId } from '@/lib/nav/module-ids';
import { ModuleRail } from './ModuleRail';
import { renderShell } from './shell-test-utils';

function Harness({ active = 'home', onSelect = () => undefined, onNew = () => undefined }: { active?: ModuleId; onSelect?: (id: ModuleId) => void; onNew?: () => void }) {
  const preferences = useRailPreferences('fixture-project');
  return (
    <ModuleRail
      project="fixture-project"
      kitVersion="0.17.0"
      activeModule={active}
      icons={MODULE_ICONS}
      preferences={preferences}
      connection="open"
      onSelectModule={onSelect}
      onNewConversation={onNew}
    />
  );
}

const railLabels = () =>
  Array.from(screen.getByRole('navigation', { name: 'Módulos' }).querySelector('ul')!.querySelectorAll(':scope > li > button')).map((button) => button.getAttribute('aria-label'));

describe('ModuleRail', () => {
  beforeEach(() => window.localStorage.clear());

  it('lists the nine modules in order with Más, new conversation and account below', () => {
    renderShell(<Harness />);
    expect(railLabels()).toEqual(['Inicio', 'Specs', 'Fixes', 'Agentes', 'Actividad', 'Mapa', 'Kit', 'Arquitectura', 'Métricas']);
    expect(screen.getByRole('button', { name: 'Más' })).toBeInTheDocument();
    expect(screen.getByTestId('new-conversation-button')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cuenta y conexión' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Proyecto fixture-project · kit 0.17.0' })).toBeInTheDocument();
  });

  it('shows each module label below its icon', () => {
    renderShell(<Harness />);
    expect(within(screen.getByRole('button', { name: 'Arquitectura' })).getByText('Arquitectura')).toBeInTheDocument();
  });

  it('marks the active module with aria-current and a shape indicator, not only colour', () => {
    renderShell(<Harness active="fixes" />);
    expect(screen.getByRole('button', { name: 'Fixes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Specs' })).not.toHaveAttribute('aria-current');
    expect(screen.getAllByTestId('rail-active-indicator')).toHaveLength(1);
  });

  it('reports the selected module and the new conversation request', () => {
    const onSelect = vi.fn();
    const onNew = vi.fn();
    renderShell(<Harness onSelect={onSelect} onNew={onNew} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kit' }));
    expect(onSelect).toHaveBeenCalledWith('kit');
    fireEvent.click(screen.getByTestId('new-conversation-button'));
    expect(onNew).toHaveBeenCalled();
  });

  it('shows the hidden-module count on Más only when something is hidden', () => {
    renderShell(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    expect(screen.getByText('No hay módulos ocultos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar Kit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar Mapa' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Más (ocultos: 2)' })).toBeInTheDocument();
    expect(railLabels()).not.toContain('Kit');
    expect(railLabels()).not.toContain('Mapa');
  });

  it('opens a hidden module from Más', () => {
    const onSelect = vi.fn();
    renderShell(<Harness onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar Métricas' }));
    fireEvent.click(within(screen.getByRole('region', { name: 'Ocultos' })).getByRole('button', { name: 'Métricas' }));
    expect(onSelect).toHaveBeenCalledWith('metrics');
    expect(screen.queryByRole('dialog', { name: 'Personalizar riel' })).not.toBeInTheDocument();
  });

  it('never offers to hide Inicio', () => {
    renderShell(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    expect(screen.queryByRole('button', { name: 'Ocultar Inicio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ocultar Specs' })).toBeInTheDocument();
  });

  it('reorders with keyboard-reachable buttons and disables the edges', () => {
    renderShell(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    expect(screen.getByRole('button', { name: 'Subir Inicio' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bajar Métricas' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Subir Fixes' }));
    expect(railLabels().slice(0, 3)).toEqual(['Inicio', 'Fixes', 'Specs']);
  });

  it('persists per project and restores after remount', () => {
    const first = renderShell(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar Fixes' }));
    expect(JSON.parse(window.localStorage.getItem(`${RAIL_KEY_PREFIX}fixture-project`) ?? '{}').hidden).toEqual(['fixes']);
    first.unmount();
    renderShell(<Harness />);
    expect(railLabels()).not.toContain('Fixes');
    expect(screen.getByRole('button', { name: 'Más (ocultos: 1)' })).toBeInTheDocument();
  });

  it('resets to the default order and visibility in one action', () => {
    renderShell(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    expect(screen.getByRole('button', { name: 'Restablecer riel' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar Fixes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subir Kit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer riel' }));
    expect(railLabels()).toEqual(['Inicio', 'Specs', 'Fixes', 'Agentes', 'Actividad', 'Mapa', 'Kit', 'Arquitectura', 'Métricas']);
    expect(window.localStorage.getItem(`${RAIL_KEY_PREFIX}fixture-project`)).toBeNull();
  });

  it('keeps showing the active module even when it is hidden from the rail', () => {
    renderShell(<Harness active="kit" />);
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar Kit' }));
    expect(railLabels()).not.toContain('Kit');
    expect(screen.getByRole('button', { name: /^Más/ })).toHaveAttribute('data-active', 'true');
  });

  it('opens the account popover with the auth panel and closes it with Escape', () => {
    renderShell(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta y conexión' }));
    expect(screen.getByRole('dialog', { name: 'Cuenta y conexión' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the popover when clicking outside of it', () => {
    renderShell(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
