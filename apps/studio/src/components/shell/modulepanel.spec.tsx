import { act, fireEvent, screen } from '@testing-library/react';
import { matchesQuery } from '@/lib/nav/search';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { COLLAPSED_KEY_PREFIX } from '@/lib/use-collapsed-state';
import { ModulePanel } from './ModulePanel';
import { PanelGroup } from './PanelGroup';
import { PanelRow } from './PanelRow';
import { ShellActionsContext } from './shell-context';
import { renderShell } from './shell-test-utils';

const ITEMS = [
  { id: 'a', label: 'Métricas del enjambre', group: 'one' },
  { id: 'b', label: 'Pagos', group: 'one' },
  { id: 'c', label: 'Arquitectura', group: 'two' },
];

function Sample({ status = 'ready' as const }: { status?: 'ready' | 'loading' | 'error' }) {
  const [query] = useModuleQuery('specs');
  const shown = ITEMS.filter((item) => matchesQuery(query, item.label));
  const groups = ['one', 'two'].map((group) => ({ group, items: shown.filter((item) => item.group === group) })).filter((g) => g.items.length > 0);
  return (
    <ModulePanel moduleId="specs" status={status} hasResults={shown.length > 0} onRetry={() => undefined}>
      {groups.map(({ group, items }) => (
        <PanelGroup key={group} id={group} title={`Grupo ${group}`} count={items.length}>
          {items.map((item) => (
            <PanelRow key={item.id} label={item.label} onClick={() => undefined} />
          ))}
        </PanelGroup>
      ))}
    </ModulePanel>
  );
}

const search = () => screen.getByRole('textbox', { name: 'Buscar en Specs' });

describe('ModulePanel', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows the module title, the search field and the groups separated by thin lines', () => {
    const { container } = renderShell(<Sample />);
    expect(screen.getByRole('heading', { name: 'Specs', level: 2 })).toBeInTheDocument();
    expect(search()).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K');
    const groups = container.querySelectorAll('[data-panel-group]');
    expect(groups).toHaveLength(2);
    expect(groups[1]).toHaveClass('border-t');
    expect(groups[0]).toHaveClass('first:border-t-0');
  });

  it('renders rows with a 28px height', () => {
    renderShell(<Sample />);
    expect(screen.getByRole('button', { name: 'Pagos' })).toHaveClass('h-7');
  });

  it('focuses the search with Cmd+K and Ctrl+K from anywhere', () => {
    renderShell(<Sample />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(search()).toHaveFocus();
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(search()).toHaveFocus();
  });

  it('filters without case or accents, hides empty groups and expands the rest', () => {
    renderShell(<Sample />);
    fireEvent.click(screen.getByRole('button', { name: 'Expandir o colapsar Grupo one' }));
    expect(screen.queryByRole('button', { name: 'Pagos' })).not.toBeInTheDocument();
    fireEvent.change(search(), { target: { value: 'METRICAS' } });
    expect(screen.getByRole('button', { name: 'Métricas del enjambre' })).toBeInTheDocument();
    expect(screen.queryByText('Grupo two')).not.toBeInTheDocument();
    fireEvent.change(search(), { target: { value: '' } });
    expect(screen.queryByRole('button', { name: 'Pagos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Arquitectura' })).toBeInTheDocument();
  });

  it('shows an empty state with a clear action when nothing matches', () => {
    renderShell(<Sample />);
    fireEvent.change(search(), { target: { value: 'zzz' } });
    expect(screen.getByText('Sin resultados para «zzz»')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtro' }));
    expect(search()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Pagos' })).toBeInTheDocument();
  });

  it('clears on the first Escape and returns focus to the list on the second', () => {
    renderShell(<Sample />);
    fireEvent.change(search(), { target: { value: 'pag' } });
    search().focus();
    fireEvent.keyDown(search(), { key: 'Escape' });
    expect(search()).toHaveValue('');
    expect(search()).toHaveFocus();
    fireEvent.keyDown(search(), { key: 'Escape' });
    expect(search()).not.toHaveFocus();
    expect(document.activeElement).toBe(screen.getByRole('complementary', { name: 'Specs' }).querySelector('[tabindex="-1"]'));
  });

  it('collapsing a group keeps the filter and the selection untouched and is remembered', () => {
    renderShell(<Sample />);
    fireEvent.change(search(), { target: { value: 'a' } });
    fireEvent.change(search(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Expandir o colapsar Grupo two' }));
    expect(search()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Expandir o colapsar Grupo two' })).toHaveAttribute('aria-expanded', 'false');
    expect(JSON.parse(window.localStorage.getItem(`${COLLAPSED_KEY_PREFIX}fixture-project`) ?? '{}')).toEqual({ 'specs:two': true });
  });

  it('shows skeleton rows while loading and no list', () => {
    renderShell(<Sample status="loading" />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pagos' })).not.toBeInTheDocument();
  });

  it('shows a bounded error with retry', () => {
    renderShell(<Sample status="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la lista');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Specs' })).toBeInTheDocument();
  });

  it('collapses through the shell action', () => {
    const collapsePanel = vi.fn();
    renderShell(
      <ShellActionsContext.Provider value={{ collapsePanel, collapseRight: () => undefined }}>
        <Sample />
      </ShellActionsContext.Provider>,
    );
    act(() => screen.getByRole('button', { name: 'Colapsar menú' }).click());
    expect(collapsePanel).toHaveBeenCalled();
  });
});
