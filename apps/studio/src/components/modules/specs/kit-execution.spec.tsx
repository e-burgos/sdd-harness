import { vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { CycleSummary, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { MODULES } from '@/lib/nav/modules';
import { BridgeError } from '@/lib/bridge/client';
import { StudioHeader } from '../../StudioHeader';
import { bridgeValue, renderShell, shellSnapshot } from '../../shell/shell-test-utils';

const usage = { tokensTotal: 12_340, providerModel: 'sonnet', effort: 'medium', agent: 'implementor-back', approx: false };
const result = (extra: Record<string, unknown> = {}) => ({
  app: 'apps/studio', level: 'quick', unit: 'TASK-003', ok: true, commit: 'abcdef1234', startedAt: new Date(Date.now() - 120_000).toISOString(), durationMs: 4200, reused: false,
  commands: [{ command: 'pnpm lint', exitCode: 0, durationMs: 1000, skipped: false }, { command: 'pnpm test', exitCode: null, durationMs: 0, skipped: true }], ...extra,
});

const cycle: CycleSummary = {
  specId: 'spec-dev-001-pagos', cycle: 'cycle-01', status: 'in-progress', flow: 'lite', apps: ['api'],
  tasks: [
    { id: 'TASK-001', title: 'Modelo', status: 'done', storyPoints: 3, usage, batch: 'B-01' },
    { id: 'TASK-002', title: 'Endpoint', status: 'pending', storyPoints: null, batch: 'B-01', usage: { ...usage, tokensTotal: 1000, approx: true } },
    { id: 'TASK-003', title: 'Suelta', status: 'pending', storyPoints: 2 },
  ],
  tasksTotal: 3, tasksDone: 1,
  batches: [{ id: 'B-01', app: 'apps/studio-bridge', role: 'implementor-back', tasks: ['TASK-001', 'TASK-002'], dependsOn: [] }],
  verifyResults: [result(), result({ unit: 'B-01', level: 'full', ok: false, reused: true })] as never,
};

const snapshot = (extra: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot => ({
  ...shellSnapshot,
  cycles: [cycle],
  verifyConfig: [{ app: 'apps/studio', levels: ['quick', 'full'] }],
  ...extra,
});

const { Panel, Center } = MODULES.specs;
const Harness = () => (
  <>
    <Panel />
    <Center />
  </>
);

function setup(options: { supported?: boolean; request?: (req: unknown) => Promise<unknown>; snap?: WorkspaceSnapshot } = {}) {
  window.localStorage.clear();
  const request = vi.fn(options.request ?? (async () => ({ runId: 'r1' })));
  const value = bridgeValue({ client: { request, supports: () => options.supported ?? true } as never }, options.snap ?? snapshot());
  const view = renderShell(<Harness />, { value });
  fireEvent.click(screen.getByRole('button', { name: /Pagos/ }));
  return { ...view, value, request };
}

const openTab = (name: string) => fireEvent.click(within(screen.getByTestId('spec-card')).getByRole('tab', { name }));

describe('Tareas por bloque', () => {
  it('groups by batch with progress, block tokens and a loose group last', () => {
    setup();
    openTab('Tareas');
    const blocks = document.querySelectorAll('[data-task-block]');
    expect([...blocks].map((b) => b.getAttribute('data-task-block'))).toEqual(['B-01', 'loose']);
    const block = blocks[0] as HTMLElement;
    expect(within(block).getByText('B-01 · apps/studio-bridge · implementor-back')).toBeTruthy();
    expect(within(block).getByTestId('block-progress').textContent).toBe('1/2 hechas');
    expect(within(block).getByTestId('block-tokens').textContent).toBe('≈13,3k tokens');
    const chips = within(block).getAllByTestId('usage-chip').map((c) => c.textContent);
    expect(chips).toEqual(['12,3k · sonnet · implementor-back', '≈1,0k · sonnet · implementor-back']);
  });

  it('collapses a block', () => {
    setup();
    openTab('Tareas');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar u ocultar el bloque B-01' }));
    expect(screen.queryByText('Modelo')).toBeNull();
    expect(screen.getByText('Suelta')).toBeTruthy();
  });

  it('keeps the status grouping without batches and still shows usage', () => {
    const { batches: _batches, ...plain } = cycle;
    setup({ snap: snapshot({ cycles: [plain] }) });
    openTab('Tareas');
    expect(document.querySelector('[data-task-block]')).toBeNull();
    expect(screen.getByText('Pendientes')).toBeTruthy();
    expect(screen.getAllByTestId('usage-chip')).toHaveLength(2);
  });
});

describe('Verificación', () => {
  it('lists results with detail and reused marker', () => {
    setup();
    openTab('Verificación');
    expect(screen.getByText('apps/studio · quick · TASK-003')).toBeTruthy();
    expect(screen.getAllByText('abcdef1')).toHaveLength(2);
    expect(screen.getByText('reusado')).toBeTruthy();
    expect(screen.getAllByText('hace 2 min').length).toBeGreaterThan(0);
    expect(screen.queryByText('pnpm lint')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar u ocultar los comandos de apps/studio · quick · TASK-003' }));
    expect(screen.getByText('pnpm lint')).toBeTruthy();
    expect(screen.getByText('saltado')).toBeTruthy();
  });

  it('runs verify with the cycle args, streams output and disables the button', async () => {
    const { request, value } = setup();
    openTab('Verificación');
    fireEvent.click(screen.getByRole('button', { name: 'Correr verify quick de apps/studio' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith({ cmd: 'kit.verify.run', app: 'apps/studio', level: 'quick', spec: 'spec-dev-001-pagos', cycle: 'cycle-01' }));
    await screen.findByTestId('verify-run');
    act(() => value.store.getState().receive({ kind: 'command.output', runId: 'r1', stream: 'stdout', chunk: 'linting…\n' } as never));
    expect(screen.getByLabelText('Salida de verify apps/studio quick').textContent).toContain('linting…');
    expect((screen.getByRole('button', { name: 'Correr verify full de apps/studio' }) as HTMLButtonElement).disabled).toBe(true);
    act(() => value.store.getState().receive({ kind: 'command.exit', runId: 'r1', exitCode: 0 } as never));
    expect(await screen.findByText('Verify ok (exit 0).')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Correr verify full de apps/studio' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each([
    [1, 'Verify falló (exit 1).'],
    [75, 'Otro verify full tiene el lease (exit 75).'],
    [9, 'Verify terminó con error (exit 9).'],
  ])('shows exit %i', async (code, message) => {
    const { value } = setup();
    openTab('Verificación');
    fireEvent.click(screen.getByRole('button', { name: 'Correr verify full de apps/studio' }));
    await screen.findByTestId('verify-run');
    act(() => value.store.getState().receive({ kind: 'command.exit', runId: 'r1', exitCode: code } as never));
    expect(await screen.findByText(message)).toBeTruthy();
  });

  it('warns on busy', async () => {
    setup({ request: async () => Promise.reject(new BridgeError('conflict', 'busy')) });
    openTab('Verificación');
    fireEvent.click(screen.getByRole('button', { name: 'Correr verify quick de apps/studio' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Ya hay un verify corriendo en este puente. Esperá a que termine.');
  });

  it('without the feature shows results and no run buttons', () => {
    setup({ supported: false });
    openTab('Verificación');
    expect(screen.getByText('apps/studio · quick · TASK-003')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Correr verify/ })).toBeNull();
    expect(screen.getByTestId('capability-notice')).toBeTruthy();
  });

  it('hides the tab when unsupported and there are no results', () => {
    setup({ supported: false, snap: snapshot({ cycles: [{ ...cycle, verifyResults: undefined }] }) });
    expect(within(screen.getByTestId('spec-card')).queryByRole('tab', { name: 'Verificación' })).toBeNull();
  });
});

describe('pill del lease', () => {
  const lease = (state: 'live' | 'stale' | 'dead') => ({ app: 'apps/studio', repo: '/work/sdd-harness', host: 'mac', pid: 4242, startedAt: new Date(Date.now() - 300_000).toISOString(), state });

  it.each(['live', 'stale', 'dead'] as const)('renders the %s state', (state) => {
    renderShell(<StudioHeader />, { value: bridgeValue({}, snapshot({ verifyLease: lease(state) })) });
    const pill = screen.getByTestId('verify-lease-pill');
    expect(pill.getAttribute('data-lease-state')).toBe(state);
    expect(pill.textContent).toBe('verify full · apps/studio · sdd-harness · hace 5 min');
    expect(pill.getAttribute('aria-label')).toContain('host mac, pid 4242');
  });

  it('is absent without lease', () => {
    renderShell(<StudioHeader />, { value: bridgeValue({}, snapshot({ verifyLease: null })) });
    expect(screen.queryByTestId('verify-lease-pill')).toBeNull();
  });
});
