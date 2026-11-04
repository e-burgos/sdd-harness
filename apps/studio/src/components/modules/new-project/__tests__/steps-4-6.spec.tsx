import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ResolvedConfig } from '@sdd-studio/protocol';
import { saveWizardState } from '@/lib/wizard/persist';
import { planDiscards, type WizardAction, type WizardChange } from '@/lib/wizard/state';
import { catalogFixture, run, scoped } from '@/lib/wizard/__tests__/fixtures';
import { renderWizard, validation, wizardClient } from './harness';

const named: WizardAction[] = [{ type: 'project', patch: { name: 'acme', description: 'Acme platform' } }];

function preload(actions: WizardAction[], scope: 'fullstack' | 'front' | 'back', mode: 'nx' | 'standalone') {
  const state = run([...named, ...actions], scoped(scope, mode));
  saveWizardState(state, window.sessionStorage);
  return state;
}

async function openStep(id: string, title: string) {
  await screen.findByRole('article');
  fireEvent.click(within(document.querySelector(`[data-step="${id}"]`) as HTMLElement).getByRole('button'));
  return screen.findByRole('article', { name: title });
}

const typeOption = (type: string) => document.querySelector(`[data-type-option="${type}"]`) as HTMLElement;

const resolved: ResolvedConfig = {
  mode: 'nx',
  project: { name: 'acme', packageScope: '@acme' },
  apps: [
    { name: 'next-web', type: 'nextjs', path: 'apps/next-web', port: 3010, portSource: 'default', tucuUi: true, ml: false, shell: null, route: null, stack: 'Next.js App Router' },
    { name: 'api', type: 'nestjs', path: 'apps/api', port: 4000, portSource: 'default', tucuUi: null, ml: false, shell: null, route: null, stack: 'NestJS modular' },
  ],
  libs: [{ name: 'shared-types', type: 'shared-types', path: 'libs/shared-types' }],
  services: [{ type: 'postgres', port: 5432, version: '16' }],
  dockerCompose: true,
  profile: 'team',
};

const fullstack: WizardAction[] = [
  { type: 'app-add', appType: 'nextjs' },
  { type: 'app-add', appType: 'nestjs' },
  { type: 'lib-toggle', libType: 'shared-types' },
  { type: 'service-toggle', serviceType: 'postgres' },
];

describe('wizard steps 4 to 6', () => {
  beforeEach(() => window.sessionStorage.clear());

  describe('back', () => {
    it('groups the backends in families and recommends nestjs for a nextjs front', async () => {
      preload([{ type: 'app-add', appType: 'nextjs' }], 'fullstack', 'nx');
      renderWizard();
      await openStep('back', 'Back');
      expect(document.querySelector('[data-family="node"]')).toHaveTextContent('Node (streaming, muchos dispositivos)');
      expect(document.querySelector('[data-family="python"]')).toHaveTextContent('Python FastAPI (CPU pesado, LangGraph/TensorFlow)');
      expect(document.querySelector('[data-family="java"]')).toHaveTextContent('Java');
      expect(within(typeOption('nestjs')).getByText('Recomendado')).toBeInTheDocument();
      expect(within(typeOption('fastify')).queryByText('Recomendado')).not.toBeInTheDocument();
      expect(screen.getByTestId('next-blocked-reason')).toHaveTextContent('Agregá al menos una app de back.');
    });

    it('shows the upstream note for a next-bff front', async () => {
      preload([{ type: 'app-add', appType: 'next-bff' }], 'fullstack', 'nx');
      renderWizard();
      await openStep('back', 'Back');
      expect(screen.getByText('El BFF necesita un upstream: elegí el back al que proxea.')).toBeInTheDocument();
    });

    it('offers the ml switch only for python and writes ml true', async () => {
      preload([{ type: 'app-add', appType: 'python' }, { type: 'app-add', appType: 'nestjs' }], 'back', 'nx');
      renderWizard();
      await openStep('back', 'Back');
      const python = document.querySelector('[data-app-row="py-api"]') as HTMLElement;
      const nest = document.querySelector('[data-app-row="api"]') as HTMLElement;
      expect(within(python).getByRole('switch', { name: 'Incluir TensorFlow (ml)' })).not.toBeChecked();
      expect(within(nest).queryByRole('switch')).not.toBeInTheDocument();
      fireEvent.click(within(python).getByRole('switch', { name: 'Incluir TensorFlow (ml)' }));
      await waitFor(() => expect(screen.getByTestId('config-preview')).toHaveTextContent('"ml": true'));
    });

    it('allows a single back app in standalone', async () => {
      preload([{ type: 'app-add', appType: 'nestjs' }], 'back', 'standalone');
      renderWizard();
      await openStep('back', 'Back');
      expect(within(typeOption('fastify')).getByRole('button')).toBeDisabled();
      expect(typeOption('fastify')).toHaveTextContent('Standalone admite una sola app');
    });
  });

  describe('extras', () => {
    it('hides the shared libs in standalone', async () => {
      preload([{ type: 'app-add', appType: 'nestjs' }], 'back', 'standalone');
      renderWizard();
      await openStep('extras', 'Extras');
      expect(screen.queryByText('Libs compartidas')).not.toBeInTheDocument();
      expect(screen.getByText('Servicios (Docker Compose)')).toBeInTheDocument();
    });

    it('lists the five lib types unchecked, with recommendations and a name per chosen lib', async () => {
      preload([{ type: 'app-add', appType: 'nextjs' }, { type: 'app-add', appType: 'nestjs' }], 'fullstack', 'nx');
      renderWizard();
      await openStep('extras', 'Extras');
      const libs = Array.from(document.querySelectorAll('[data-lib]')) as HTMLElement[];
      expect(libs.map((lib) => lib.dataset.lib)).toEqual(['shared-types', 'shared-utils', 'ui-kit', 'api-client', 'config']);
      libs.forEach((lib) => expect(within(lib).getByRole('checkbox')).not.toBeChecked());
      expect(within(libs[0] as HTMLElement).getByText('Recomendado')).toBeInTheDocument();
      expect(within(libs[3] as HTMLElement).getByText('Recomendado')).toBeInTheDocument();
      expect(within(libs[2] as HTMLElement).queryByText('Recomendado')).not.toBeInTheDocument();
      fireEvent.click(within(libs[0] as HTMLElement).getByRole('checkbox'));
      const name = within(libs[0] as HTMLElement).getByLabelText('Nombre de la lib shared-types');
      fireEvent.change(name, { target: { value: 'Bad Name' } });
      expect(within(libs[0] as HTMLElement).getByRole('alert')).toHaveTextContent('Usá minúsculas');
    });

    it('shows the port of a chosen service as read-only', async () => {
      preload([{ type: 'app-add', appType: 'nestjs' }, { type: 'service-toggle', serviceType: 'redis' }], 'back', 'standalone');
      renderWizard();
      await openStep('extras', 'Extras');
      const service = document.querySelector('[data-service="redis"]') as HTMLElement;
      const port = within(service).getByLabelText('Puerto del servicio (solo lectura)');
      expect(port).toHaveValue('6379');
      expect(port).toHaveAttribute('readonly');
      fireEvent.change(port, { target: { value: '1234' } });
      expect(port).toHaveValue('6379');
      const postgres = document.querySelector('[data-service="postgres"]') as HTMLElement;
      expect(within(postgres).queryByLabelText('Puerto del servicio (solo lectura)')).not.toBeInTheDocument();
      expect(within(postgres).getByRole('checkbox')).not.toBeChecked();
    });

    it('proposes the profile of the mode, lets the user change it and edits the ports of the apps', async () => {
      preload([{ type: 'app-add', appType: 'nestjs' }], 'back', 'standalone');
      renderWizard();
      await openStep('extras', 'Extras');
      expect(screen.getByText('Por defecto para esta forma: solo.')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'solo' })).toBeChecked();
      fireEvent.click(screen.getByRole('radio', { name: 'team' }));
      await waitFor(() => expect(screen.getByTestId('config-preview')).toHaveTextContent('"profile": "team"'));
      fireEvent.change(screen.getByLabelText('Puerto'), { target: { value: '4500' } });
      await waitFor(() => expect(screen.getByTestId('config-preview')).toHaveTextContent('"port": 4500'));
    });
  });

  describe('summary', () => {
    const summaryClient = () => wizardClient({ 'wizard.validate': () => validation([], resolved) });

    it('shows the resolved apps, libs, services, the command and the config', async () => {
      preload(fullstack, 'fullstack', 'nx');
      renderWizard({ fake: summaryClient() });
      await screen.findByRole('article', { name: 'Resumen' });
      await waitFor(() => expect(screen.getByText('Todo listo para generar.')).toBeInTheDocument());
      const next = document.querySelector('[data-summary-app="next-web"]') as HTMLElement;
      expect(next).toHaveTextContent('Next.js App Router');
      expect(next).toHaveTextContent('Puerto 3010 (por defecto)');
      expect(next).toHaveTextContent('con tucu-ui');
      expect(document.querySelector('[data-summary-section="libs"]')).toHaveTextContent('shared-types · shared-types');
      expect(document.querySelector('[data-summary-section="services"]')).toHaveTextContent('Postgres · puerto 5432');
      expect(screen.getByTestId('init-command')).toHaveTextContent('harness init --config harness.config.json -y');
      expect(document.querySelector('[data-summary-section="commands"]')).toHaveTextContent('La instalación necesita red');
      const tree = within(document.querySelector('[data-summary-section="tree"]') as HTMLElement).getByTestId('project-tree');
      expect(tree).toHaveTextContent('acme/');
      expect(tree).toHaveTextContent('docker-compose.yml');
      expect(within(document.querySelector('[data-summary-section="config"]') as HTMLElement).getByTestId('config-preview')).toHaveTextContent('"name": "acme"');
    });

    it('lists the pending problems and the way back to the field', async () => {
      preload(fullstack, 'fullstack', 'nx');
      renderWizard({
        fake: wizardClient({
          'wizard.validate': () => validation([{ severity: 'error', code: 'duplicate-lib-name', path: ['libs', 0, 'name'], message: 'dup' }]),
        }),
      });
      await screen.findByRole('article', { name: 'Resumen' });
      await waitFor(() => expect(screen.getByText('Hay 1 problemas pendientes. Corregilos para poder generar.')).toBeInTheDocument());
      const goTo = screen.getByRole('button', { name: 'Ir al campo: Hay dos libs con el mismo nombre.' });
      fireEvent.click(goTo);
      await screen.findByRole('article', { name: 'Extras' });
      await waitFor(() => expect(document.activeElement?.id).toBe('wizard-field-libs-0-name'));
    });

    it('edits a section and returns to the summary on Next', async () => {
      preload(fullstack, 'fullstack', 'nx');
      renderWizard({ fake: summaryClient() });
      await screen.findByRole('article', { name: 'Resumen' });
      fireEvent.click(screen.getByRole('button', { name: 'Editar Servicios' }));
      await screen.findByRole('article', { name: 'Extras' });
      fireEvent.click(within(document.querySelector('[data-service="redis"]') as HTMLElement).getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      await screen.findByRole('article', { name: 'Resumen' });
      await waitFor(() => expect(document.querySelector('[data-summary-section="services"]')).toHaveTextContent('Redis'));
    });

    it('does not show stale resolved data while validating again', async () => {
      preload(fullstack, 'fullstack', 'nx');
      renderWizard({ fake: summaryClient() });
      await screen.findByRole('article', { name: 'Resumen' });
      await waitFor(() => expect(screen.getByText('Todo listo para generar.')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Editar Apps' }));
      await screen.findByRole('article', { name: 'Front' });
      fireEvent.click(screen.getByRole('button', { name: 'Quitar next-web' }));
      expect(screen.getByTestId('next-blocked-reason')).toHaveTextContent('Agregá al menos una app de front.');
    });
  });

  describe('discard dialog', () => {
    it.each<[string, 'fullstack' | 'front', WizardChange]>([
      ['scope to front', 'fullstack', { type: 'scope', scope: 'front' }],
      ['scope to back', 'fullstack', { type: 'scope', scope: 'back' }],
      ['mode to standalone', 'front', { type: 'mode', mode: 'standalone' }],
    ])('lists exactly what planDiscards discards on %s', async (_label, scope, change) => {
      const state = preload(
        [{ type: 'app-add', appType: 'mfe-shell' }, { type: 'app-add', appType: 'mfe' }, { type: 'app-add', appType: 'react' }, { type: 'lib-toggle', libType: 'shared-types' }, ...(scope === 'fullstack' ? [{ type: 'app-add' as const, appType: 'nestjs' }] : [])],
        scope,
        'nx',
      );
      const plan = planDiscards(state, change, catalogFixture);
      renderWizard();
      await screen.findByRole('article');
      if (change.type === 'scope') {
        fireEvent.click(within(document.querySelector('[data-step="scope"]') as HTMLElement).getByRole('button'));
        fireEvent.click(await screen.findByTestId(`scope-${change.scope}`));
      } else {
        fireEvent.click(within(document.querySelector('[data-step="shape"]') as HTMLElement).getByRole('button'));
        fireEvent.click(await screen.findByTestId(`mode-${change.mode}`));
      }
      const list = await screen.findByTestId('discard-list');
      expect(plan.items.length).toBeGreaterThan(0);
      const entries = within(list).getAllByRole('listitem');
      expect(entries).toHaveLength(plan.items.length);
      plan.items.forEach((item, index) => {
        const text = entries[index]?.textContent ?? '';
        if (item.kind === 'app') expect(text).toContain(`«${item.name}» (${item.appType})`);
        if (item.kind === 'lib') expect(text).toContain(`«${item.name}» (${item.libType})`);
        if (item.kind === 'shell-link') expect(text).toContain(`«${item.shell}»`);
        if (item.kind === 'mode') expect(text).toContain('La forma');
      });
    });

    it('applies nothing when the user cancels and everything when the user confirms', async () => {
      preload([{ type: 'app-add', appType: 'nestjs' }, { type: 'app-add', appType: 'react' }], 'fullstack', 'nx');
      renderWizard();
      await openStep('scope', 'Alcance');
      fireEvent.click(screen.getByTestId('scope-front'));
      const dialog = await screen.findByRole('alertdialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      expect(screen.getByTestId('scope-fullstack')).toHaveAttribute('aria-checked', 'true');
      fireEvent.click(screen.getByTestId('scope-front'));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Aplicar el cambio' }));
      await waitFor(() => expect(screen.getByTestId('scope-front')).toHaveAttribute('aria-checked', 'true'));
      expect(document.querySelector('[data-step="back"]')).toHaveAttribute('data-state', 'na');
    });
  });
});
