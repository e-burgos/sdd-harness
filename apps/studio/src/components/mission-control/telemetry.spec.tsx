import { render, screen } from '@testing-library/react';
import { LiveTelemetryHUD } from './LiveTelemetryHUD';
import { BridgeContext } from '../BridgeProvider';

const mockBridgeValue: any = {
  connection: { status: 'open' },
  pairing: { port: 3100, token: 'abc' },
  presence: [],
  snapshot: {
    project: 'test-monorepo',
    profile: 'team',
    kitVersion: '0.16.1',
    specs: [],
    cycles: [],
    fixes: [],
    agents: [],
    skills: [],
    gateMode: 'block',
    pricing: null,
    stale: [],
  },
  store: { getState: () => ({ threads: {} }) },
  syncError: null,
  retrySync: () => {},
};

describe('LiveTelemetryHUD', () => {
  it('renders token counters, financial cost and RTK status', () => {
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <LiveTelemetryHUD />
      </BridgeContext.Provider>
    );

    expect(screen.getByTestId('live-telemetry-hud')).toBeInTheDocument();
    expect(screen.getByText('Telemetría de Misión & Tokens')).toBeInTheDocument();
    expect(screen.getByText('Tokens Totales Consumidos')).toBeInTheDocument();
    expect(screen.getByText('Inversión Real en Modelos')).toBeInTheDocument();
    expect(screen.getByText('Ahorro Agéntico vs Tradicional')).toBeInTheDocument();
    expect(screen.getByText(/Escudo de Compresión RTK Activo/)).toBeInTheDocument();
  });
});
