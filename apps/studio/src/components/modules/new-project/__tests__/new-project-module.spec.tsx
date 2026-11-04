import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';
import { ISSUE_TEXT_CODES, issueTextKey } from '@/lib/wizard/issues';
import { WIZARD_STATE_KEY } from '@/lib/wizard/persist';
import { BridgeFailure } from '@/lib/wizard/__tests__/fake-client';
import { catalogResultFixture } from '@/lib/wizard/__tests__/fixtures';
import { renderWizard, wizardClient } from './harness';

const FORBIDDEN = /^text-(?:xs|sm|base|lg|[2-9]?xl|body|\[(?:\d|length:).*)$/;

const stepRow = (id: string) => document.querySelector(`[data-step="${id}"]`) as HTMLElement;

async function ready() {
  const view = renderWizard();
  await screen.findByRole('radiogroup', { name: 'Alcance del proyecto' });
  return view;
}

describe('new project module shell', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('shows the six steps with the first one current', async () => {
    await ready();
    expect(['scope', 'shape', 'front', 'back', 'extras', 'summary'].map((id) => stepRow(id).dataset.state)).toEqual([
      'current',
      'pending',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
    expect(within(stepRow('scope')).getByRole('button', { name: 'Paso 1: Alcance, paso actual' })).toHaveAttribute('aria-current', 'true');
  });

  it('marks completed steps and the ones the scope does not apply to', async () => {
    await ready();
    fireEvent.click(screen.getByTestId('scope-front'));
    expect(stepRow('back').dataset.state).toBe('na');
    expect(within(stepRow('back')).getByText('No aplica por el alcance')).toBeInTheDocument();
    expect(within(stepRow('back')).queryByRole('button')).not.toBeInTheDocument();
    expect(stepRow('front').dataset.state).toBe('pending');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(stepRow('scope').dataset.state).toBe('done');
    expect(stepRow('shape').dataset.state).toBe('current');
    expect(screen.getByText('Paso 2 de 5')).toBeInTheDocument();
  });

  it('keeps all six steps for full stack', async () => {
    await ready();
    fireEvent.click(screen.getByTestId('scope-fullstack'));
    expect(['scope', 'shape', 'front', 'back', 'extras', 'summary'].some((id) => stepRow(id).dataset.state === 'na')).toBe(false);
    expect(screen.getByText('Paso 1 de 6')).toBeInTheDocument();
  });

  it('disables Next with the reason until a scope is chosen', async () => {
    await ready();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(screen.getByTestId('next-blocked-reason')).toHaveTextContent('No podés avanzar: Elegí un alcance para continuar.');
    fireEvent.click(screen.getByTestId('scope-back'));
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
    expect(screen.queryByTestId('next-blocked-reason')).not.toBeInTheDocument();
  });

  it('goes back keeping the choices and lets a completed step be reopened from the panel', async () => {
    await ready();
    fireEvent.click(screen.getByTestId('scope-fullstack'));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByTestId('scope-fullstack')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(stepRow('shape')).getByRole('button'));
    expect(screen.getByRole('article', { name: 'Forma' })).toBeInTheDocument();
  });

  it('asks before starting over when there are choices and clears them', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar de nuevo' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('scope-front'));
    await waitFor(() => expect(window.sessionStorage.getItem(WIZARD_STATE_KEY)).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Empezar de nuevo' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByTestId('scope-front')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Empezar de nuevo' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Borrar y empezar' }));
    await waitFor(() => expect(screen.getByTestId('scope-front')).toHaveAttribute('aria-checked', 'false'));
    expect(stepRow('back').dataset.state).toBe('pending');
    expect(window.sessionStorage.getItem(WIZARD_STATE_KEY)).toBeNull();
  });

  it('restores the wizard after a reload at the first open step', async () => {
    const first = await ready();
    fireEvent.click(screen.getByTestId('scope-back'));
    await waitFor(() => expect(window.sessionStorage.getItem(WIZARD_STATE_KEY)).not.toBeNull());
    first.unmount();
    renderWizard();
    await screen.findByRole('article', { name: 'Forma' });
    expect(stepRow('front').dataset.state).toBe('na');
    expect(stepRow('scope').dataset.state).toBe('done');
  });

  it('offers a retry when the catalog cannot be loaded', async () => {
    let fail = true;
    renderWizard({
      fake: wizardClient({
        'wizard.catalog': () => {
          if (fail) throw new BridgeFailure('internal', 'cli exploded');
          return catalogResultFixture;
        },
      }),
    });
    expect(await screen.findByText(/No se pudo cargar el catálogo de la CLI: cli exploded/)).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getAllByRole('button', { name: 'Reintentar' })[0]!);
    expect(await screen.findByRole('article', { name: 'Alcance' })).toBeInTheDocument();
  });

  it('renders the shell only with scale tokens', async () => {
    const { container } = await ready();
    const offenders = Array.from(container.querySelectorAll('*')).flatMap((element) =>
      (element.getAttribute('class') ?? '')
        .split(/\s+/)
        .filter((token) => FORBIDDEN.test(token.replace(/^[a-z-]+:/, '')))
        .map((token) => `${element.tagName.toLowerCase()}.${token}`),
    );
    expect(offenders).toEqual([]);
  });

  it('translates every issue code in both languages', () => {
    ISSUE_TEXT_CODES.forEach((code) => {
      expect(es[issueTextKey(code) as keyof typeof es]).toBeTruthy();
      expect(en[issueTextKey(code) as keyof typeof en]).toBeTruthy();
    });
  });
});
