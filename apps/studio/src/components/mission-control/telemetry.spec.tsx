import { render, screen, waitFor } from '@testing-library/react';
import { LiveTelemetryHUD, formatModelName } from './LiveTelemetryHUD';
import { BridgeContext } from '../BridgeProvider';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';

const cycleRef = { specId: 'spec-real-1', cycle: 'cycle-01', status: 'completed', flow: 'full', apps: [], tasks: [], tasksTotal: 1, tasksDone: 1 };

function mount(files: Record<string, unknown>, withCycles = true) {
  const store = createStudioStore();
  store.getState().setSnapshot({
    project: 'p',
    profile: 'team',
    kitVersion: null,
    specs: [],
    cycles: withCycles ? [cycleRef] : [],
    fixes: [],
    agents: [],
    skills: [],
    gateMode: 'block',
    pricing: null,
    stale: [],
  });
  const request = vi.fn(async (command: { path: string }) => {
    if (!(command.path in files)) throw new Error('missing');
    return { path: command.path, content: JSON.stringify(files[command.path]) };
  });
  const value: any = { client: { request }, connection: { status: 'open' }, pairing: { port: 3100, token: 'abc' }, store, syncError: null, retrySync: () => {} };
  render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <LiveTelemetryHUD />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
  return request;
}

const base = 'sdd/specs/spec-real-1/cycles/cycle-01';

describe('LiveTelemetryHUD', () => {
  it('shows the empty state and no fabricated figures when the project has no cycles', () => {
    mount({}, false);
    expect(screen.getByTestId('live-telemetry-hud')).toBeInTheDocument();
    expect(screen.getByTestId('telemetry-empty')).toHaveTextContent('Sin telemetría todavía');
    expect(screen.queryByText('Tokens Totales Consumidos')).toBeNull();
    expect(screen.queryByText(/6[.,]611[.,]605/)).toBeNull();
    expect(screen.queryByText(/Gemini/)).toBeNull();
  });

  it('shows the empty state when no usage was recorded', async () => {
    const request = mount({ [`${base}/cycle.json`]: { metrics: {} }, [`${base}/tasks.json`]: { tasks: [] } });
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(screen.getByTestId('telemetry-empty')).toBeInTheDocument();
    expect(screen.queryByText('STREAMING TELEMETRY ACTIVE')).toBeNull();
  });

  it('computes tokens, cost, models and agents from the recorded usage only', async () => {
    mount({
      [`${base}/cycle.json`]: {
        metrics: {
          usage: {
            by_agent: [
              { agent: 'sdd-orchestrator', provider_model: 'claude/sonnet', tokens_in: 1_000_000, tokens_out: 100_000 },
              { agent: 'sdd-reviewer', provider_model: 'claude/opus', tokens_in: 0, tokens_out: 100_000 },
            ],
          },
        },
      },
      [`${base}/tasks.json`]: { tasks: [{ estimation_hours: 10 }] },
      'sdd/fixes.json': { fixes: [] },
    });

    expect(await screen.findByText('Tokens Totales Consumidos')).toBeInTheDocument();
    expect(screen.getByText(/1[.,]200[.,]000/)).toBeInTheDocument();
    expect(screen.getByText(/\$7\.00 USD/)).toBeInTheDocument();
    expect(screen.getByText('Inversión Real en Modelos')).toBeInTheDocument();
    expect(screen.getByText('sonnet')).toBeInTheDocument();
    expect(screen.getByText('opus')).toBeInTheDocument();
    expect(screen.getByText(/Clara/)).toBeInTheDocument();
    expect(screen.getByText(/Argus/)).toBeInTheDocument();
    expect(screen.queryByText(/Gemini|Copilot/)).toBeNull();
    expect(screen.getByText(/Escudo de Compresión RTK Activo/)).toBeInTheDocument();
  });

  it('does not invent a price for a model without rates and reports no savings without hours', async () => {
    mount({
      [`${base}/cycle.json`]: { metrics: { usage: { by_agent: [{ agent: 'a', provider_model: 'acme/unpriced', tokens_in: 1000, tokens_out: 1000 }] } } },
    });
    expect(await screen.findByText(/\$0\.00 USD/)).toBeInTheDocument();
    expect(screen.getByText('unpriced')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('counts fix usage', async () => {
    mount({
      [`${base}/cycle.json`]: { metrics: {} },
      'sdd/fixes.json': { fixes: [{ usage: { agent: 'sdd-implementor-front', provider_model: 'claude/haiku', tokens_in: 2000, tokens_out: 1000 }, estimation_hours: 2 }] },
    });
    expect((await screen.findAllByText(/3[.,]000/)).length).toBeGreaterThan(0);
  });
});

describe('formatModelName', () => {
  it('uses the real id and the provider prefix', () => {
    expect(formatModelName('claude/sonnet')).toEqual({ name: 'sonnet', provider: 'claude' });
    expect(formatModelName('gemini/flash-lite')).toEqual({ name: 'flash-lite', provider: 'gemini' });
  });

  it('keeps an id without prefix and reports no provider', () => {
    expect(formatModelName('desconocido')).toEqual({ name: 'desconocido', provider: null });
  });
});
