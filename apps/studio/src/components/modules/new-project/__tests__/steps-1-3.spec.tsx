import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { saveWizardState } from '@/lib/wizard/persist';
import type { WizardAction } from '@/lib/wizard/state';
import { run, scoped } from '@/lib/wizard/__tests__/fixtures';
import { renderWizard, validation, wizardClient } from './harness';

const named: WizardAction[] = [
  { type: 'project', patch: { name: 'acme', description: 'Acme platform' } },
];

function preload(actions: WizardAction[], scope: 'fullstack' | 'front' | 'back', mode: 'nx' | 'standalone') {
  saveWizardState(run([...named, ...actions], scoped(scope, mode)), window.sessionStorage);
}

const typeInto = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function openStep(id: string, title: string) {
  await screen.findByRole('article');
  fireEvent.click(within(document.querySelector(`[data-step="${id}"]`) as HTMLElement).getByRole('button'));
  return screen.findByRole('article', { name: title });
}
const center = () => within(screen.getByRole('article'));
const alerts = () => center().queryAllByRole('alert').map((node) => node.textContent ?? '').join(' | ');
const typeOption = (type: string) => document.querySelector(`[data-type-option="${type}"]`) as HTMLElement;

describe('wizard steps 1 to 3', () => {
  beforeEach(() => window.sessionStorage.clear());

  describe('shape', () => {
    it('blocks standalone for full stack with its reason and recommends the monorepo', async () => {
      saveWizardState(run([{ type: 'change', change: { type: 'scope', scope: 'fullstack' } }]), window.sessionStorage);
      renderWizard();
      await screen.findByTestId('mode-nx');
      expect(screen.getByTestId('mode-standalone')).toBeDisabled();
      expect(screen.getByTestId('mode-standalone')).toHaveTextContent('Full stack necesita al menos dos apps; standalone admite una sola');
      expect(within(screen.getByTestId('mode-nx')).getByText('Recomendado')).toBeInTheDocument();
      expect(within(screen.getByTestId('mode-standalone')).queryByText('Recomendado')).not.toBeInTheDocument();
    });

    it('recommends standalone for a single side and explains every option', async () => {
      saveWizardState(run([{ type: 'change', change: { type: 'scope', scope: 'back' } }]), window.sessionStorage);
      renderWizard();
      await screen.findByTestId('mode-nx');
      expect(within(screen.getByTestId('mode-standalone')).getByText('Recomendado')).toBeInTheDocument();
      expect(screen.getByTestId('mode-nx')).toHaveTextContent('Conviene con varias apps');
    });

    it('validates name, description and scope in the field and derives the scope from the name', async () => {
      saveWizardState(scoped('front', 'standalone'), window.sessionStorage);
      renderWizard();
      await screen.findByTestId('mode-nx');
      expect(center().queryByRole('alert')).not.toBeInTheDocument();
      typeInto('Nombre del proyecto', 'Mi Proyecto');
      expect(alerts()).toMatch(/Usá minúsculas, números y guiones, y empezá con una letra/);
      typeInto('Nombre del proyecto', 'mi-proyecto');
      expect(screen.queryAllByText(/Usá minúsculas, números y guiones, y empezá/)).toHaveLength(0);
      expect(screen.getByLabelText('Scope npm')).toHaveValue('@mi-proyecto');
      fireEvent.blur(screen.getByLabelText('Descripción'));
      expect(alerts()).toContain('Escribí una descripción.');
      typeInto('Scope npm', 'sin-arroba');
      expect(alerts()).toMatch(/El scope tiene que empezar con @/);
      expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
      typeInto('Descripción', 'Algo');
      typeInto('Scope npm', '@mi-proyecto');
      expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
    });

    it('confirms before a mode change that discards apps and lists exactly those apps', async () => {
      preload([{ type: 'app-add', appType: 'mfe-shell' }], 'front', 'nx');
      renderWizard();
      await openStep('shape', 'Forma');
      fireEvent.click(screen.getByTestId('mode-standalone'));
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByTestId('discard-list')).toHaveTextContent('App «shell» (mfe-shell): solo existe en monorepo Nx');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      expect(screen.getByTestId('mode-nx')).toHaveAttribute('aria-checked', 'true');
      fireEvent.click(screen.getByTestId('mode-standalone'));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Aplicar el cambio' }));
      await waitFor(() => expect(screen.getByTestId('mode-standalone')).toHaveAttribute('aria-checked', 'true'));
    });
  });

  describe('front', () => {
    it('blocks the monorepo-only types in standalone with the reason', async () => {
      preload([], 'front', 'standalone');
      renderWizard();
      await openStep('front', 'Front');
      ['next-bff', 'mfe-shell', 'mfe'].forEach((type) => {
        expect(within(typeOption(type)).getByRole('button')).toBeDisabled();
        expect(typeOption(type)).toHaveTextContent('Solo disponible en monorepo Nx');
      });
      expect(within(typeOption('react')).getByRole('button')).toBeEnabled();
      expect(typeOption('react')).toHaveTextContent('Stack: react stack');
    });

    it('enables every front type in a monorepo and requires at least one app', async () => {
      preload([], 'front', 'nx');
      renderWizard();
      await openStep('front', 'Front');
      ['react', 'nextjs', 'next-bff', 'mfe-shell', 'mfe'].forEach((type) => expect(within(typeOption(type)).getByRole('button')).toBeEnabled());
      expect(screen.getByText('Todavía no agregaste ninguna app de front.')).toBeInTheDocument();
      expect(screen.getByTestId('next-blocked-reason')).toHaveTextContent('Agregá al menos una app de front.');
      fireEvent.click(within(typeOption('react')).getByRole('button'));
      expect(document.querySelector('[data-app-row="web"]')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
    });

    it('allows a single app in standalone with the reason on the add buttons', async () => {
      preload([], 'front', 'standalone');
      renderWizard();
      await openStep('front', 'Front');
      fireEvent.click(within(typeOption('react')).getByRole('button'));
      expect(within(typeOption('nextjs')).getByRole('button')).toBeDisabled();
      expect(typeOption('nextjs')).toHaveTextContent('Standalone admite una sola app');
    });

    it('shows the tucu-ui switch only for the types that support it and writes tucuUi false', async () => {
      preload([{ type: 'app-add', appType: 'react' }], 'front', 'nx');
      renderWizard();
      await openStep('front', 'Front');
      const row = document.querySelector('[data-app-row="web"]') as HTMLElement;
      const toggle = within(row).getByRole('switch', { name: 'Usar tucu-ui' });
      expect(toggle).toBeChecked();
      expect(screen.getByTestId('config-preview')).not.toHaveTextContent('tucuUi');
      fireEvent.click(toggle);
      await waitFor(() => expect(screen.getByTestId('config-preview')).toHaveTextContent('"tucuUi": false'));
    });

    it('validates app names and ports in the field and flags both apps of a port conflict', async () => {
      preload([{ type: 'app-add', appType: 'react' }, { type: 'app-add', appType: 'nextjs' }], 'front', 'nx');
      renderWizard();
      await openStep('front', 'Front');
      const rows = Array.from(document.querySelectorAll('[data-app-row]')) as HTMLElement[];
      const [web, next] = rows as [HTMLElement, HTMLElement];
      fireEvent.change(within(web).getByLabelText('Nombre de la app'), { target: { value: 'Web App' } });
      expect(within(web).getByText(/Usá minúsculas, números y guiones/)).toBeInTheDocument();
      fireEvent.change(within(web).getByLabelText('Nombre de la app'), { target: { value: 'web' } });
      fireEvent.change(within(web).getByLabelText('Puerto'), { target: { value: 'abc' } });
      expect(within(web).getByText('El puerto tiene que ser un entero entre 1000 y 65535.')).toBeInTheDocument();
      fireEvent.change(within(web).getByLabelText('Puerto'), { target: { value: '999' } });
      expect(within(web).getByText('El puerto tiene que estar entre 1000 y 65535.')).toBeInTheDocument();
      fireEvent.change(within(web).getByLabelText('Puerto'), { target: { value: '5000' } });
      fireEvent.change(within(next).getByLabelText('Puerto'), { target: { value: '5000' } });
      expect(within(web).getByText('El puerto 5000 ya lo usa «next-web».')).toBeInTheDocument();
      expect(within(next).getByText('El puerto 5000 ya lo usa «web».')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
      fireEvent.change(within(web).getByLabelText('Puerto'), { target: { value: '' } });
      expect(within(web).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(web).getByText('Por defecto: 3000')).toBeInTheDocument();
    });

    it('blocks an mfe without shell and a shell without mfe, and unblocks once paired', async () => {
      preload([{ type: 'app-add', appType: 'mfe' }], 'front', 'nx');
      renderWizard();
      await openStep('front', 'Front');
      expect(screen.getByTestId('next-blocked-reason')).toHaveTextContent('Los microfrontends necesitan un shell');
      fireEvent.click(within(typeOption('mfe-shell')).getByRole('button'));
      await waitFor(() => expect(screen.queryByTestId('next-blocked-reason')).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Quitar mfe' }));
      expect(screen.getByTestId('next-blocked-reason')).toHaveTextContent('El shell necesita al menos un microfrontend');
    });

    it('lets each mfe pick its shell only when there is more than one shell', async () => {
      preload([{ type: 'app-add', appType: 'mfe-shell' }, { type: 'app-add', appType: 'mfe' }], 'front', 'nx');
      renderWizard();
      await openStep('front', 'Front');
      expect(screen.queryAllByLabelText('Shell de mfe')).toHaveLength(0);
      expect(screen.getByText('Se sirve en /mfe/')).toBeInTheDocument();
      fireEvent.click(within(typeOption('mfe-shell')).getByRole('button'));
      expect((await screen.findAllByLabelText('Shell de mfe')).length).toBeGreaterThan(0);
    });

    it('shows the first issue of the CLI validation as the reason and lists it in the preview', async () => {
      preload([{ type: 'app-add', appType: 'mfe-shell' }, { type: 'app-add', appType: 'mfe-shell' }, { type: 'app-add', appType: 'mfe' }], 'front', 'nx');
      renderWizard({
        fake: wizardClient({
          'wizard.validate': () => validation([{ severity: 'error', code: 'shell-ambiguous', path: ['apps', 2, 'shell'], message: 'ambiguous' }]),
        }),
      });
      await openStep('front', 'Front');
      await waitFor(() => expect(screen.getByTestId('next-blocked-reason')).toHaveTextContent('Hay más de un shell: elegí el de «mfe».'));
      expect(screen.getByRole('button', { name: /Hay más de un shell/ })).toBeInTheDocument();
    });
  });
});
