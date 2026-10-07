import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { SidebarView } from './Sidebar';

describe('Sidebar', () => {
  it('lists channels and agents with presence and selects them', () => {
    const onSelect = vi.fn();
    render(
      <I18nProvider initial="es">
        <SidebarView
          project="studio fixture" kitVersion="0.16.0" authMode="local-claude-login" connection="open"
          channels={[{ id: 'general', kind: 'general', label: 'general' }, { id: 'spec:s1', kind: 'spec', label: 's1', status: 'in-progress' }]}
          dms={[{ id: 'dm:sdd-planner', kind: 'dm', label: 'sdd-planner' }]}
          presence={[{ agent: 'sdd-planner', state: 'working', threadId: 't', specId: null, tool: 'Read' }]}
          activeChannel="general" onSelect={onSelect}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('studio fixture')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Planner, trabajando' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '# s1, en curso' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /# s1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Planner/ }));
    expect(screen.getByText('conectado', { selector: '.sr-only' })).toBeInTheDocument();
    expect(onSelect.mock.calls).toEqual([['spec:s1'], ['dm:sdd-planner']]);
  });

  it.each([
    ['open', 'conectado', 'bg-accent-400'],
    ['reconnecting', 'reconectando', 'bg-amberish'],
    ['connecting', 'reconectando', 'bg-amberish'],
    ['failed', 'sin conexión', 'bg-roseish'],
    ['idle', 'sin conexión', 'bg-roseish'],
  ] as const)('shows the %s connection state in the dot', (connection, label, cls) => {
    render(
      <I18nProvider initial="es">
        <SidebarView project="p" kitVersion={null} authMode={null} connection={connection} channels={[]} dms={[]} presence={[]} activeChannel="general" onSelect={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByText(label, { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByTestId('conn-dot')).toHaveClass(cls);
  });
});
