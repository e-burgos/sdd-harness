import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { TargetCheck } from '@sdd-studio/protocol';
import { BridgeFailure } from '@/lib/wizard/__tests__/fake-client';
import { renderWizard } from './harness';
import { DEFAULT_TARGET, FINGERPRINT, generationState, preloadFullstack, readyPreflight, summaryClient, targetCheck } from './summary-fixtures';

async function openSummary(fake = summaryClient()) {
  preloadFullstack();
  const view = renderWizard({ fake });
  await screen.findByRole('article', { name: 'Resumen' });
  return { ...view, fake };
}

const status = async () => screen.findByTestId('target-status');
const generateButton = () => screen.getByRole('button', { name: 'Generar' });

const tolerated = targetCheck({
  state: 'tolerated',
  needsConfirmation: true,
  entries: { count: 3, sample: ['.git', 'README.md', 'LICENSE'], conflicting: [], notable: ['.git'] },
});

describe('target picker', () => {
  describe('status per TargetCheck state', () => {
    const cases: Array<[string, Partial<TargetCheck>, string]> = [
      ['missing', { state: 'missing' }, 'No existe: se creará al generar.'],
      ['empty', { state: 'empty' }, 'Existe y está vacía.'],
      ['tolerated', tolerated, 'Existe y tiene contenido (3 elementos). Hace falta confirmar antes de generar.'],
      [
        'conflicting',
        { state: 'conflicting', entries: { count: 2, sample: ['src', 'sdd'], conflicting: ['src', 'sdd'], notable: [] } },
        'Tiene contenido que la CLI no acepta: src, sdd. No se puede generar acá.',
      ],
      ['not-directory', { state: 'not-directory' }, 'La ruta es un archivo, no una carpeta.'],
      ['not-writable', { state: 'not-writable' }, 'Sin permiso de escritura en esta ruta.'],
      ['outside-allowed', { state: 'outside-allowed', reason: 'outside' }, 'La ruta está fuera de las carpetas permitidas (tu home y las dadas con --allow-target).'],
      ['base-itself', { state: 'outside-allowed', reason: 'base-itself' }, 'No se puede generar directamente en una carpeta base permitida: elegí una subcarpeta.'],
      ['invalid relative', { state: 'invalid', reason: 'relative' }, 'La ruta tiene que ser absoluta.'],
      ['invalid dot-segment', { state: 'invalid', reason: 'dot-segment' }, 'La ruta no puede tener segmentos «.» ni «..».'],
      ['invalid bad-char', { state: 'invalid', reason: 'bad-char' }, 'La ruta tiene caracteres inválidos para el sistema operativo.'],
      ['invalid reserved-name', { state: 'invalid', reason: 'reserved-name' }, 'La ruta usa un nombre reservado del sistema operativo.'],
      ['invalid unc', { state: 'invalid', reason: 'unc' }, 'No se admiten rutas de red ni de dispositivo.'],
      ['invalid too-long', { state: 'invalid', reason: 'too-long' }, 'La ruta es demasiado larga.'],
    ];

    it.each(cases)('shows the text for %s', async (_label, overrides, text) => {
      await openSummary(summaryClient({ 'wizard.checkTarget': () => targetCheck(overrides) }));
      expect(await status()).toHaveTextContent(text);
    });

    it('explains which entries the CLI tolerates for a conflicting folder', async () => {
      await openSummary(summaryClient({ 'wizard.checkTarget': () => targetCheck({ state: 'conflicting', entries: { count: 1, sample: ['src'], conflicting: ['src'], notable: [] } }) }));
      expect(await status()).toHaveTextContent('.git');
      expect(await status()).toHaveTextContent('README.md');
    });

    it('warns when the folder is inside the connected project', async () => {
      await openSummary(summaryClient({ 'wizard.checkTarget': () => targetCheck({ state: 'empty', insideProject: true, needsConfirmation: true }) }));
      expect(await status()).toHaveTextContent('Esta carpeta está dentro del proyecto conectado');
    });

    it('shows the normalized path returned by the bridge', async () => {
      await openSummary(summaryClient({ 'wizard.checkTarget': () => targetCheck({ resolvedPath: '/private/home/dev/projects/acme' }) }));
      expect(await screen.findByTestId('target-normalized')).toHaveTextContent('Se generará en: /private/home/dev/projects/acme');
    });

    it('shows the error when the check fails', async () => {
      await openSummary(
        summaryClient({
          'wizard.checkTarget': () => {
            throw new BridgeFailure('bad-path', 'ruta mal formada');
          },
        }),
      );
      expect(await screen.findByText('No se pudo comprobar la carpeta: ruta mal formada')).toBeInTheDocument();
      expect(generateButton()).toBeDisabled();
    });
  });

  describe('destination field', () => {
    it('proposes the suggested parent plus the project name', async () => {
      await openSummary();
      expect(screen.getByLabelText('Ruta de la carpeta')).toHaveValue(DEFAULT_TARGET);
    });

    it('checks the typed path after the debounce', async () => {
      const { fake } = await openSummary();
      fireEvent.change(screen.getByLabelText('Ruta de la carpeta'), { target: { value: '/home/dev/otra' } });
      await waitFor(() => expect(fake.requests.some((r) => r.cmd === 'wizard.checkTarget' && r.path === '/home/dev/otra')).toBe(true));
    });

    it('disables Generar with the reason while there is no path', async () => {
      await openSummary();
      await screen.findByText('Todo listo para generar.');
      fireEvent.change(screen.getByLabelText('Ruta de la carpeta'), { target: { value: '' } });
      expect(generateButton()).toBeDisabled();
      expect(screen.getByTestId('generate-blocked-reason')).toHaveTextContent('elegí la carpeta destino');
    });
  });

  describe('blocking states', () => {
    it.each<[string, Partial<TargetCheck>]>([
      ['conflicting', { state: 'conflicting', entries: { count: 1, sample: ['src'], conflicting: ['src'], notable: [] } }],
      ['not-writable', { state: 'not-writable' }],
      ['not-directory', { state: 'not-directory' }],
      ['invalid', { state: 'invalid', reason: 'relative' }],
      ['outside-allowed', { state: 'outside-allowed', reason: 'outside' }],
    ])('does not allow generating on %s and offers no confirmation', async (_label, overrides) => {
      const { fake } = await openSummary(summaryClient({ 'wizard.checkTarget': () => targetCheck(overrides) }));
      await status();
      await waitFor(() => expect(screen.getByTestId('generate-blocked-reason')).toHaveTextContent('la carpeta destino no admite generar'));
      expect(generateButton()).toBeDisabled();
      fireEvent.click(generateButton());
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(fake.requests.some((r) => r.cmd === 'wizard.generate')).toBe(false);
    });
  });

  describe('generate without confirmation', () => {
    it.each<Partial<TargetCheck>>([{ state: 'missing' }, { state: 'empty' }])('sends the config and the path without fingerprint on %o', async (overrides) => {
      const { fake } = await openSummary(
        summaryClient({
          'wizard.checkTarget': () => targetCheck(overrides),
          'wizard.generate': () => ({ outcome: 'started', generation: generationState() }),
        }),
      );
      await status();
      await waitFor(() => expect(generateButton()).toBeEnabled());
      fireEvent.click(generateButton());
      await waitFor(() => expect(fake.requests.some((r) => r.cmd === 'wizard.generate')).toBe(true));
      const sent = fake.requests.find((r) => r.cmd === 'wizard.generate') as Record<string, unknown>;
      expect(sent.path).toBe(DEFAULT_TARGET);
      expect(sent).not.toHaveProperty('fingerprint');
      expect((sent.config as { project: { name: string } }).project.name).toBe('acme');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  describe('confirmation', () => {
    const withTolerated = (generate: (cmd: Record<string, unknown>) => unknown = () => ({ outcome: 'started', generation: generationState() })) =>
      summaryClient({ 'wizard.checkTarget': () => tolerated, 'wizard.generate': generate });

    async function askConfirmation(fake: ReturnType<typeof summaryClient>) {
      await openSummary(fake);
      await status();
      await waitFor(() => expect(generateButton()).toBeEnabled());
      fireEvent.click(generateButton());
      return screen.findByRole('alertdialog');
    }

    it('shows the path, the count, the first names and the git warning, and does not focus the confirm button', async () => {
      const dialog = await askConfirmation(withTolerated());
      expect(dialog).toHaveTextContent(`Carpeta: ${DEFAULT_TARGET}`);
      expect(dialog).toHaveTextContent('Elementos en la carpeta: 3');
      expect(within(screen.getByTestId('confirm-sample')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['.git', 'README.md', 'LICENSE']);
      expect(dialog).toHaveTextContent('Contiene un repositorio git (.git).');
      const confirm = within(dialog).getByRole('button', { name: 'Generar en esta carpeta con contenido' });
      await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus());
      expect(confirm).not.toHaveFocus();
    });

    it('mentions a harness.config.json by name', async () => {
      const fake = summaryClient({
        'wizard.checkTarget': () => targetCheck({ state: 'tolerated', needsConfirmation: true, entries: { count: 1, sample: ['harness.config.json'], conflicting: [], notable: ['harness.config.json'] } }),
      });
      expect(await askConfirmation(fake)).toHaveTextContent('Contiene un harness.config.json');
    });

    it('sends the fingerprint only after confirming', async () => {
      const fake = withTolerated();
      const dialog = await askConfirmation(fake);
      expect(fake.requests.some((r) => r.cmd === 'wizard.generate')).toBe(false);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Generar en esta carpeta con contenido' }));
      await waitFor(() => expect(fake.requests.some((r) => r.cmd === 'wizard.generate')).toBe(true));
      expect(fake.requests.find((r) => r.cmd === 'wizard.generate')).toMatchObject({ path: DEFAULT_TARGET, fingerprint: FINGERPRINT });
    });

    it('cancelling asks again on the next attempt without sending anything', async () => {
      const fake = withTolerated();
      const dialog = await askConfirmation(fake);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      fireEvent.click(generateButton());
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
      expect(fake.requests.some((r) => r.cmd === 'wizard.generate')).toBe(false);
    });

    it('asks again with a notice when the bridge reports the folder changed', async () => {
      const changed = targetCheck({ state: 'tolerated', needsConfirmation: true, fingerprint: 'fedcba9876543210', entries: { count: 5, sample: ['a'], conflicting: [], notable: [] } });
      const fake = withTolerated(() => ({ outcome: 'needs-confirmation', check: changed }));
      const dialog = await askConfirmation(fake);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Generar en esta carpeta con contenido' }));
      expect(await screen.findByText('La carpeta cambió desde que la comprobaste. Revisá y confirmá de nuevo.')).toBeInTheDocument();
      expect(screen.getByRole('alertdialog')).toHaveTextContent('Elementos en la carpeta: 5');
    });

    it('asks for the confirmation of a folder inside the connected project even if it is empty', async () => {
      const fake = summaryClient({ 'wizard.checkTarget': () => targetCheck({ state: 'empty', insideProject: true, needsConfirmation: true }) });
      expect(await askConfirmation(fake)).toHaveTextContent('La carpeta está dentro del proyecto conectado.');
    });
  });

  describe('bridge outcomes', () => {
    async function generateWith(generate: (cmd: Record<string, unknown>) => unknown) {
      await openSummary(summaryClient({ 'wizard.generate': generate }));
      await status();
      await waitFor(() => expect(generateButton()).toBeEnabled());
      fireEvent.click(generateButton());
    }

    it('shows the active generation conflict with the bridge message', async () => {
      await generateWith(() => {
        throw new BridgeFailure('conflict', 'Corre en /home/dev/otra');
      });
      expect(await screen.findByText('Ya hay una generación en curso. Corre en /home/dev/otra')).toBeInTheDocument();
    });

    it('shows a blocked folder because of a different harness.config.json', async () => {
      await generateWith(() => ({ outcome: 'blocked', check: targetCheck(), reason: 'config-differs' }));
      expect(await screen.findByText('Ya hay un harness.config.json distinto en la carpeta; Studio nunca lo pisa.')).toBeInTheDocument();
    });

    it('shows an invalid config outcome', async () => {
      await generateWith(() => ({ outcome: 'invalid-config', validation: { format: 1, cliVersion: '0.17.0', ok: false, issues: [], resolved: null } }));
      expect(await screen.findByText('La CLI rechazó la configuración. Revisá los problemas del panel derecho.')).toBeInTheDocument();
    });

    it('switches the center to the progress view once the generation starts', async () => {
      await generateWith(() => ({ outcome: 'started', generation: generationState() }));
      expect(await screen.findByTestId('generation-progress')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Generar' })).not.toBeInTheDocument();
    });
  });

  describe('directory browser', () => {
    const listing = (path: string, parent: string | null, names: string[], extra: object = {}) => ({
      path,
      parent,
      entries: names.map((name) => ({ name, symlink: false })),
      truncated: false,
      ...extra,
    });

    const browserClient = () =>
      summaryClient({
        'wizard.listDirs': (cmd) => (cmd.path === '/home/dev/projects/work' ? listing('/home/dev/projects/work', '/home/dev/projects', []) : listing('/home/dev/projects', '/home/dev', ['work', 'play'])),
      });

    it('lists the directories, navigates and uses the shown folder', async () => {
      const { fake } = await openSummary(browserClient());
      fireEvent.click(screen.getByRole('button', { name: 'Elegir carpeta…' }));
      const browser = await screen.findByTestId('directory-browser');
      await waitFor(() => expect(within(browser).getByTestId('browser-path')).toHaveTextContent('/home/dev/projects'));
      expect(fake.requests.find((r) => r.cmd === 'wizard.listDirs')).toMatchObject({ showHidden: false });
      expect(within(browser).getByRole('button', { name: 'Abrir work' })).toBeInTheDocument();
      fireEvent.click(within(browser).getByRole('button', { name: 'Abrir work' }));
      await waitFor(() => expect(within(browser).getByTestId('browser-path')).toHaveTextContent('/home/dev/projects/work'));
      expect(await within(browser).findByText('No hay subcarpetas.')).toBeInTheDocument();
      fireEvent.click(within(browser).getByRole('button', { name: 'Usar esta carpeta' }));
      await waitFor(() => expect(screen.getByLabelText('Ruta de la carpeta')).toHaveValue('/home/dev/projects/work'));
      expect(screen.queryByTestId('directory-browser')).not.toBeInTheDocument();
    });

    it('goes up and asks for hidden folders', async () => {
      const { fake } = await openSummary(browserClient());
      fireEvent.click(screen.getByRole('button', { name: 'Elegir carpeta…' }));
      const browser = await screen.findByTestId('directory-browser');
      await within(browser).findByRole('button', { name: 'Abrir work' });
      fireEvent.click(within(browser).getByRole('checkbox', { name: 'Mostrar carpetas ocultas' }));
      await waitFor(() => expect(fake.requests.filter((r) => r.cmd === 'wizard.listDirs').at(-1)).toMatchObject({ showHidden: true }));
      fireEvent.click(within(browser).getByRole('button', { name: 'Subir un nivel' }));
      await waitFor(() => expect(fake.requests.filter((r) => r.cmd === 'wizard.listDirs').at(-1)).toMatchObject({ path: '/home/dev' }));
    });

    it('warns when the listing is truncated and shows listing errors', async () => {
      await openSummary(summaryClient({ 'wizard.listDirs': () => listing('/home/dev/projects', '/home/dev', ['a'], { truncated: true }) }));
      fireEvent.click(screen.getByRole('button', { name: 'Elegir carpeta…' }));
      expect(await screen.findByText(/Hay más carpetas de las que se muestran/)).toBeInTheDocument();
    });

    it('shows the error and keeps the use button disabled', async () => {
      await openSummary(
        summaryClient({
          'wizard.listDirs': () => {
            throw new BridgeFailure('bad-path', 'fuera de las bases');
          },
        }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Elegir carpeta…' }));
      expect(await screen.findByText('No se pudo leer la carpeta: fuera de las bases')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Usar esta carpeta' })).toBeDisabled();
    });
  });

  describe('preflight', () => {
    it('blocks Generar with an actionable cause when pnpm is missing', async () => {
      await openSummary(summaryClient({ 'wizard.preflight': () => ({ ...readyPreflight, pnpm: { found: false, version: null }, ready: false }) }));
      expect(await screen.findByText(/pnpm no está instalado/)).toBeInTheDocument();
      await status();
      await waitFor(() => expect(screen.getByTestId('generate-blocked-reason')).toHaveTextContent('el entorno no está listo'));
      expect(generateButton()).toBeDisabled();
    });

    it('blocks Generar when the registry does not respond', async () => {
      await openSummary(summaryClient({ 'wizard.preflight': () => ({ ...readyPreflight, registry: { url: null, reachable: 'no' }, ready: false }) }));
      expect(await screen.findByText(/El registry de paquetes no responde/)).toBeInTheDocument();
      expect(generateButton()).toBeDisabled();
    });

    it('informs git problems without blocking', async () => {
      await openSummary(summaryClient({ 'wizard.preflight': () => ({ ...readyPreflight, git: { found: true, identity: false } }) }));
      expect(await screen.findByText(/git sin identidad/)).toBeInTheDocument();
      await status();
      await waitFor(() => expect(generateButton()).toBeEnabled());
    });

    it('shows the versions and offers to check again after a failure', async () => {
      let calls = 0;
      const { fake } = await openSummary(
        summaryClient({
          'wizard.preflight': () => {
            calls += 1;
            if (calls === 1) throw new BridgeFailure('internal', 'sin respuesta');
            return readyPreflight;
          },
        }),
      );
      expect(await screen.findByText('No se pudo comprobar el entorno: sin respuesta')).toBeInTheDocument();
      expect(generateButton()).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Volver a comprobar' }));
      expect(await screen.findByText('Entorno listo.')).toBeInTheDocument();
      expect(screen.getByTestId('preflight')).toHaveTextContent('Node 22.1.0 · pnpm 9.12.0');
      expect(fake.requests.filter((r) => r.cmd === 'wizard.preflight')).toHaveLength(2);
    });
  });
});
