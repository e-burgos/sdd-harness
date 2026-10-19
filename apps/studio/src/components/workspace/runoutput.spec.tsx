import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { RunOutput } from './RunOutput';

describe('RunOutput', () => {
  it('exposes a focusable labelled output and a live exit status', () => {
    const store = createStudioStore();
    store.getState().startRun({ runId: 'r', name: 'gate', args: ['a'.repeat(80)] });
    render(
      <I18nProvider initial="es">
        <BridgeContext.Provider value={{ store } as unknown as BridgeContextValue}><RunOutput /></BridgeContext.Provider>
      </I18nProvider>,
    );
    const out = screen.getByLabelText('Salida del comando gate');
    expect(out).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('corriendo…')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTitle(/^\$ pnpm sdd:gate a+…$/)).toBeInTheDocument();
  });
});
