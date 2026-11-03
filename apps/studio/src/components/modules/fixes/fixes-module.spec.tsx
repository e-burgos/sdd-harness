import { fireEvent, screen, within } from '@testing-library/react';
import type { BotEvent, FixSummary, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { bridgeValue, renderShell, shellSnapshot } from '../../shell/shell-test-utils';
import { fixesModule } from './index';

const { Panel, Center, Right } = fixesModule;

const fix = (over: Partial<FixSummary> & { id: string }): FixSummary => ({ title: over.id, status: 'pending', severity: null, specId: null, createdAt: null, closedAt: null, ...over });

const snapshotWith = (fixes: FixSummary[]): WorkspaceSnapshot => ({ ...shellSnapshot, fixes });

const FIXES = [
  fix({ id: 'FIX-001', title: 'Pérdida de datos', status: 'pending', severity: 'high', specId: 'spec-dev-001-pagos', createdAt: '2026-03-01T10:00:00Z' }),
  fix({ id: 'FIX-002', title: 'Texto roto', status: 'pending', severity: 'low' }),
  fix({ id: 'FIX-003', title: 'Cierre', status: 'validated', severity: 'critical', specId: 'spec-borrada', closedAt: '2026-03-05T10:00:00Z', document: 'sdd/fixes/fix-003.md' }),
  fix({ id: 'FIX-004', title: 'En marcha', status: 'in-progress' }),
];

const renderFixes = (fixes: FixSummary[], bot: Record<string, BotEvent[]> = {}, selected: string | null = null) => {
  const value = bridgeValue({}, snapshotWith(fixes));
  Object.entries(bot).forEach(([channel, events]) => value.store.getState().setBotHistory(channel, events));
  if (selected) window.localStorage.setItem('sdd-studio.nav.v1:fixture-project', JSON.stringify({ module: 'fixes', selection: { specs: null, fixes: selected, agents: null, kit: null, architecture: null, metrics: null }, specTab: 'summary', specCycle: null, home: { kind: 'channel', channelId: 'general' }, filters: { homeConversations: 'active', specs: 'active', map: 'all', activity: ['spec', 'fix', 'agent', 'tools'] } }));
  return renderShell(
    <>
      <Panel />
      <Center />
      {Right && <Right />}
    </>,
    { value },
  );
};

describe('Fixes panel', () => {
  beforeEach(() => window.localStorage.clear());

  it('groups fixes by state, ordered by lifecycle, with severity chips', () => {
    const { container } = renderFixes(FIXES);
    const groups = [...container.querySelectorAll('[data-panel-group]')].map((g) => g.getAttribute('data-panel-group'));
    expect(groups).toEqual(['in-progress', 'pending', 'validated']);
    const pending = container.querySelector('[data-panel-group="pending"]') as HTMLElement;
    const rows = within(pending).getAllByRole('button').filter((b) => b.hasAttribute('title'));
    expect(rows[0]).toHaveAttribute('title', 'FIX-001 · Pérdida de datos');
    expect(within(rows[0]).getByText('alta')).toBeInTheDocument();
    expect(within(rows[1]).getByText('baja')).toBeInTheDocument();
  });

  it('keeps closed groups collapsed by default', () => {
    renderFixes(FIXES);
    expect(screen.queryByText('Cierre')).not.toBeInTheDocument();
  });

  it('shows the id, title, state and severity to assistive tech and filters by search', () => {
    renderFixes(FIXES);
    expect(screen.getByRole('button', { name: 'FIX-001: Pérdida de datos, Pendiente, severidad alta' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar en Fixes' }), { target: { value: 'perdida' } });
    expect(screen.getByText('Pérdida de datos')).toBeInTheDocument();
    expect(screen.queryByText('Texto roto')).not.toBeInTheDocument();
  });

  it('shows an explanatory empty state when the project has no fixes', () => {
    renderFixes([]);
    expect(screen.getByText(/Todavía no hay fixes/)).toBeInTheDocument();
    expect(screen.getByText('No hay fixes en este proyecto')).toBeInTheDocument();
  });

  it('opens the fix card from a row', () => {
    renderFixes(FIXES);
    expect(screen.getByText('Elegí un fix')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /FIX-002/ }));
    expect(screen.getByRole('article', { name: 'Texto roto' })).toBeInTheDocument();
  });
});

describe('Fix card', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows state, severity, linked spec and dates', () => {
    renderFixes(FIXES, {}, 'FIX-001');
    const card = screen.getByRole('article', { name: 'Pérdida de datos' });
    expect(within(card).getByText('Pendiente')).toBeInTheDocument();
    expect(within(card).getByText('alta')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Abrir la spec spec-dev-001-pagos' })).toBeInTheDocument();
    expect(within(card).getByText('Sin fecha')).toBeInTheDocument();
    expect(within(card).getByText('Este fix no tiene documentos')).toBeInTheDocument();
  });

  it('shows a missing spec as unavailable without breaking the card', () => {
    renderFixes(FIXES, {}, 'FIX-003');
    const card = screen.getByRole('article', { name: 'Cierre' });
    expect(within(card).getByText('spec-borrada (no disponible)')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Abrir fix-003.md' })).toBeInTheDocument();
  });

  it('shows a fix without severity as "sin severidad"', () => {
    renderFixes(FIXES, {}, 'FIX-004');
    expect(within(screen.getByRole('article', { name: 'En marcha' })).getByText('sin severidad')).toBeInTheDocument();
  });

  it('says the fix no longer exists when the selection is gone', () => {
    renderFixes(FIXES, {}, 'FIX-999');
    expect(screen.getByText('Este fix ya no existe')).toBeInTheDocument();
  });
});

describe('Fixes right panel', () => {
  beforeEach(() => window.localStorage.clear());

  it('asks for a selection first', () => {
    renderFixes(FIXES);
    expect(screen.getByText('Elegí un fix para ver su actividad y detalles.')).toBeInTheDocument();
  });

  it('shows the fix activity and switches to details', () => {
    const events: BotEvent[] = [
      { channelId: 'fixes', botKind: 'fix.status', payload: { fixId: 'FIX-001', from: 'pending', to: 'in-progress' }, at: '2026-03-02T10:00:00Z' },
      { channelId: 'fixes', botKind: 'fix.status', payload: { fixId: 'FIX-002', from: 'pending', to: 'in-progress' }, at: '2026-03-02T10:00:00Z' },
    ];
    renderFixes(FIXES, { fixes: events }, 'FIX-001');
    const aside = screen.getByRole('complementary', { name: 'Fix' });
    expect(within(aside).getByText('FIX-001: pending → in-progress')).toBeInTheDocument();
    expect(within(aside).queryByText(/FIX-002/)).not.toBeInTheDocument();
    fireEvent.click(within(aside).getByRole('tab', { name: 'Detalles' }));
    expect(within(aside).getByText('spec-dev-001-pagos')).toBeInTheDocument();
  });

  it('shows an empty activity notice when the fix has no events', () => {
    renderFixes(FIXES, {}, 'FIX-002');
    expect(screen.getByText('Sin actividad registrada para este fix')).toBeInTheDocument();
  });
});
