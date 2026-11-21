import { vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { CycleSummary, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { MODULES } from '@/lib/nav/modules';
import { BridgeError } from '@/lib/bridge/client';
import { bridgeValue, renderShell, shellSnapshot } from '../../shell/shell-test-utils';

const cycle: CycleSummary = {
  specId: 'spec-dev-001-pagos', cycle: 'cycle-01', status: 'in-progress', flow: 'lite', apps: ['api'], tasks: [], tasksTotal: 0, tasksDone: 0,
};
const snapshot = (cycles: CycleSummary[]): WorkspaceSnapshot => ({ ...shellSnapshot, cycles });

const blocked = {
  spec: 'spec-dev-001-pagos', gate: 'B', passed: false,
  checks: [
    { id: 'B1', label: 'Spec registered', ok: true, detail: '' },
    { id: 'B4', label: 'Cycle documents required by flow lite: plan.md', ok: false, detail: 'missing plan.md' },
  ],
};

const { Panel, Center } = MODULES.specs;

function setup(options: { supported?: boolean; request: (req: unknown) => Promise<unknown>; cycles?: CycleSummary[] }) {
  window.localStorage.clear();
  const request = vi.fn(options.request);
  const value = bridgeValue({ client: { request, supports: (c: string) => (c === 'kit-gate' ? options.supported ?? true : false) } as never }, snapshot(options.cycles ?? [cycle]));
  renderShell(<><Panel /><Center /></>, { value });
  fireEvent.click(screen.getByRole('button', { name: /Pagos/ }));
  fireEvent.click(within(screen.getByTestId('spec-card')).getByRole('tab', { name: 'Plan' }));
  return { request };
}

describe('Panel SPEC GATE', () => {
  it('asks gate B with the running cycle and lists the checks with detail', async () => {
    const { request } = setup({ request: async () => blocked });
    await waitFor(() => expect(screen.getByTestId('gate-status').textContent).toBe('BLOQUEADO'));
    expect(request).toHaveBeenCalledWith({ cmd: 'kit.gate.check', spec: 'spec-dev-001-pagos', cycle: 'cycle-01' });
    expect(screen.getByText('B4. Cycle documents required by flow lite: plan.md')).toBeTruthy();
    expect(screen.getByText('missing plan.md')).toBeTruthy();
    expect(document.querySelector('[data-gate-check="B1"]')?.getAttribute('data-ok')).toBe('true');
  });

  it('shows approved and the next cycle for gate A without a running cycle', async () => {
    const { request } = setup({
      cycles: [{ ...cycle, status: 'completed' }],
      request: async () => ({ spec: 'spec-dev-001-pagos', gate: 'A', passed: true, checks: [{ id: 'A1', label: 'Spec exists', ok: true, detail: '' }], next: { cycle: 'cycle-02', flow: 'lite', profile: 'solo' } }),
    });
    await waitFor(() => expect(screen.getByTestId('gate-status').textContent).toBe('APROBADO'));
    expect(request).toHaveBeenCalledWith({ cmd: 'kit.gate.check', spec: 'spec-dev-001-pagos' });
    expect(screen.getByTestId('gate-next').textContent).toBe('Próximo: cycle-02 · flow sugerido lite · perfil solo');
  });

  it('rechecks on demand', async () => {
    const { request } = setup({ request: async () => blocked });
    await waitFor(() => expect(screen.getByTestId('gate-status')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it('warns on a bridge error', async () => {
    setup({ request: async () => { throw new BridgeError('bad-request', 'spec not found'); } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('spec not found'));
  });

  it('renders nothing without the capability', () => {
    const { request } = setup({ supported: false, request: async () => blocked });
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByText('SPEC GATE')).toBeNull();
  });
});
