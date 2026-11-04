import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { GenerationState } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { BridgeFailure } from '@/lib/wizard/__tests__/fake-client';
import { loadPendingIdea, saveGenerationPointer } from '@/lib/wizard/persist';
import { OutputLog } from '../OutputLog';
import { renderWizard } from './harness';
import { DEFAULT_TARGET, generationState, preloadFullstack, summaryClient } from './summary-fixtures';

const chunk = (seq: number, text = `line ${seq}\n`, stream: 'stdout' | 'stderr' = 'stdout') => ({ seq, stream, chunk: text });

const snapshot = (generation: GenerationState | null, output = [chunk(1)], extra: object = {}) => ({ generation, output, truncatedBefore: false, hasMore: false, ...extra });

function pointTo(generation: GenerationState): void {
  saveGenerationPointer({ generationId: generation.id, target: generation.target, lastSeq: 0, lastStatus: generation.status }, window.sessionStorage);
}

async function openGeneration(generation: GenerationState, handlers: Parameters<typeof summaryClient>[0] = {}, output = [chunk(1)]) {
  preloadFullstack();
  pointTo(generation);
  const fake = summaryClient({ 'wizard.generation.get': () => snapshot(generation, output), ...handlers });
  const view = renderWizard({ fake });
  return { ...view, fake };
}

const finished = (overrides: Partial<GenerationState>): GenerationState =>
  generationState({
    status: 'succeeded',
    stages: [
      { stage: 'prepare', status: 'done' },
      { stage: 'scaffold', status: 'done' },
      { stage: 'install', status: 'done' },
      { stage: 'generate', status: 'done' },
      { stage: 'validate', status: 'done' },
      { stage: 'build', status: 'done' },
    ],
    gate: { validate: 'pass', build: 'pass' },
    hasSdd: true,
    exitCode: 0,
    finishedAt: '2026-11-04T10:05:00.000Z',
    ...overrides,
  });

const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
  window.sessionStorage.clear();
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});

describe('GenerationProgress', () => {
  it('lists the six stages in order with the active one highlighted', async () => {
    await openGeneration(generationState());
    const progress = await screen.findByTestId('generation-progress');
    const stages = within(progress).getAllByRole('listitem').filter((item) => item.hasAttribute('data-stage'));
    expect(stages.map((item) => item.getAttribute('data-stage'))).toEqual(['prepare', 'scaffold', 'install', 'generate', 'validate', 'build']);
    expect(stages.map((item) => item.getAttribute('data-status'))).toEqual(['done', 'done', 'active', 'pending', 'pending', 'pending']);
    expect(stages[0]).toHaveTextContent('Preparando carpeta');
    expect(stages[1]).toHaveTextContent('Generando estructura');
    expect(stages[2]).toHaveTextContent('Instalando dependencias');
    expect(stages[3]).toHaveTextContent('Generando apps y SDD');
    expect(stages[4]).toHaveTextContent('Validando SDD');
    expect(stages[5]).toHaveTextContent('Lint, test y build');
    expect(stages[2]).toHaveAttribute('aria-current', 'step');
    expect(progress).toHaveTextContent(`Carpeta: ${DEFAULT_TARGET}`);
  });

  it('streams the output and the stage changes live', async () => {
    const { fake } = await openGeneration(generationState());
    const log = await screen.findByRole('log');
    await waitFor(() => expect(log).toHaveTextContent('line 1'));
    act(() => fake.emit({ kind: 'generation.output', generationId: 'gen-1', seq: 2, stream: 'stdout', chunk: 'Installing deps\n' }));
    expect(log).toHaveTextContent('Installing deps');
    act(() =>
      fake.emit({
        kind: 'generation.status',
        generation: generationState({
          stages: [
            { stage: 'prepare', status: 'done' },
            { stage: 'scaffold', status: 'done' },
            { stage: 'install', status: 'done' },
            { stage: 'generate', status: 'active' },
            { stage: 'validate', status: 'pending' },
            { stage: 'build', status: 'pending' },
          ],
        }),
      }),
    );
    expect(document.querySelector('[data-stage="generate"]')).toHaveAttribute('data-status', 'active');
  });

  it('strips ANSI sequences from the log', async () => {
    await openGeneration(generationState(), {}, [chunk(1, '\u001b[32mgreen\u001b[0m text\n')]);
    const log = await screen.findByRole('log');
    await waitFor(() => expect(log).toHaveTextContent('green text'));
    expect(log.textContent).not.toContain('[32m');
  });

  it('asks for confirmation before cancelling and does not send anything if the user keeps going', async () => {
    const { fake } = await openGeneration(generationState(), { 'wizard.generation.cancel': () => generationState({ status: 'cancelled' }) });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar generación' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Lo ya escrito en la carpeta no se borra.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Seguir generando' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(fake.requests.some((r) => r.cmd === 'wizard.generation.cancel')).toBe(false);
  });

  it('cancels after confirming and moves to the partial failure result', async () => {
    const cancelled = generationState({
      status: 'cancelled',
      failure: { stage: 'install', kind: 'cancelled', message: 'cancelled' },
      stages: [
        { stage: 'prepare', status: 'done' },
        { stage: 'scaffold', status: 'done' },
        { stage: 'install', status: 'failed' },
        { stage: 'generate', status: 'skipped' },
        { stage: 'validate', status: 'skipped' },
        { stage: 'build', status: 'skipped' },
      ],
    });
    const { fake } = await openGeneration(generationState(), { 'wizard.generation.cancel': () => cancelled });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar generación' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar generación' }));
    expect(await screen.findByTestId('generation-result')).toHaveAttribute('data-variant', 'cancelled');
    expect(fake.requests.find((r) => r.cmd === 'wizard.generation.cancel')).toMatchObject({ generationId: 'gen-1' });
  });

  it('marks the connection as lost without declaring success or failure, and recovers on reconnect', async () => {
    const { fake } = await openGeneration(generationState());
    await screen.findByTestId('generation-progress');
    act(() => fake.setState({ status: 'closed' } as never));
    expect(await screen.findByText('Conexión perdida')).toBeInTheDocument();
    expect(screen.queryByTestId('generation-result')).not.toBeInTheDocument();
    expect(document.querySelector('[data-stage="install"]')).toHaveAttribute('data-status', 'active');
    act(() => fake.setState({ status: 'open' } as never));
    await waitFor(() => expect(screen.queryByText('Conexión perdida')).not.toBeInTheDocument());
  });

  it('shows the recovering state until the bridge answers', async () => {
    preloadFullstack();
    pointTo(generationState());
    const pending = new Promise(() => undefined);
    renderWizard({ fake: summaryClient({ 'wizard.generation.get': () => pending }) });
    expect(await screen.findByText('Recuperando el estado de la generación…')).toBeInTheDocument();
  });

  it('reports an unknown generation after a bridge restart and lets the dev review the folder', async () => {
    preloadFullstack();
    pointTo(generationState());
    const fake = summaryClient({
      'wizard.generation.get': () => {
        throw new BridgeFailure('not-found', 'unknown generation');
      },
      'wizard.checkTarget': (cmd) => ({
        input: String(cmd.path),
        resolvedPath: String(cmd.path),
        state: 'conflicting',
        reason: null,
        entries: { count: 1, sample: ['package.json'], conflicting: ['package.json'], notable: [] },
        insideProject: false,
        needsConfirmation: false,
        fingerprint: null,
      }),
    });
    renderWizard({ fake });
    const unknown = await screen.findByTestId('generation-unknown');
    expect(unknown).toHaveTextContent('Interrumpida o desconocida');
    expect(unknown).toHaveTextContent(`Lo que alcanzó a escribirse sigue en ${DEFAULT_TARGET}`);
    fireEvent.click(within(unknown).getByRole('button', { name: 'Revisar carpeta' }));
    await screen.findByRole('article', { name: 'Resumen' });
    expect(screen.getByLabelText('Ruta de la carpeta')).toHaveValue(DEFAULT_TARGET);
    expect(await screen.findByText(/Tiene contenido que la CLI no acepta: package.json/)).toBeInTheDocument();
  });
});

describe('OutputLog autoscroll', () => {
  function setup() {
    let scrollTop = 0;
    const wrapper = (chunks: Array<ReturnType<typeof chunk>>) => (
      <I18nProvider initial="es">
        <OutputLog chunks={chunks} truncatedBefore={false} />
      </I18nProvider>
    );
    const view = render(wrapper([chunk(1)]));
    const log = screen.getByRole('log');
    Object.defineProperty(log, 'scrollHeight', { configurable: true, get: () => 1000 });
    Object.defineProperty(log, 'clientHeight', { configurable: true, get: () => 100 });
    Object.defineProperty(log, 'scrollTop', { configurable: true, get: () => scrollTop, set: (value: number) => void (scrollTop = value) });
    return { view, log, wrapper, top: () => scrollTop, scrollTo: (value: number) => (scrollTop = value) };
  }

  it('keeps the view at the end while the user has not scrolled up', () => {
    const { view, wrapper, top } = setup();
    view.rerender(wrapper([chunk(1), chunk(2)]));
    expect(top()).toBe(1000);
  });

  it('does not autoscroll when the user scrolled up, and offers a way back to the end', () => {
    const { view, log, wrapper, top, scrollTo } = setup();
    scrollTo(0);
    fireEvent.scroll(log);
    view.rerender(wrapper([chunk(1), chunk(2)]));
    expect(top()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Ir al final' }));
    expect(top()).toBe(1000);
    expect(screen.queryByRole('button', { name: 'Ir al final' })).not.toBeInTheDocument();
    view.rerender(wrapper([chunk(1), chunk(2), chunk(3)]));
    expect(top()).toBe(1000);
  });

  it('resumes following when the user scrolls back to the bottom', () => {
    const { view, log, wrapper, top, scrollTo } = setup();
    scrollTo(0);
    fireEvent.scroll(log);
    scrollTo(900);
    fireEvent.scroll(log);
    view.rerender(wrapper([chunk(1), chunk(2)]));
    expect(top()).toBe(1000);
  });

  it('flags a truncated log', () => {
    render(
      <I18nProvider initial="es">
        <OutputLog chunks={[chunk(5)]} truncatedBefore />
      </I18nProvider>,
    );
    expect(screen.getByText('Se descartó la salida más vieja: el log está incompleto al principio.')).toBeInTheDocument();
  });
});

describe('GenerationResult', () => {
  const resultView = () => screen.findByTestId('generation-result');

  describe('success', () => {
    it('shows the title, the CLI version, the gate and the next steps', async () => {
      await openGeneration(finished({}));
      const result = await resultView();
      expect(result).toHaveAttribute('data-variant', 'success');
      expect(within(result).getByRole('heading', { name: 'Proyecto generado' })).toBeInTheDocument();
      expect(screen.getByTestId('result-cli')).toHaveTextContent('Generado con la CLI 0.17.0');
      expect(result).toHaveTextContent(`Ruta: ${DEFAULT_TARGET}`);
      expect(result.querySelectorAll('[data-gate-status="pass"]')).toHaveLength(2);
      expect(result).toHaveTextContent('next-web · nextjs');
      expect(result).toHaveTextContent('shared-types · shared-types');
      expect(result).toHaveTextContent('Vincular a un repositorio remoto llega en una próxima versión.');
      expect(within(result).queryByRole('button', { name: 'Editar y volver a intentar' })).not.toBeInTheDocument();
    });

    it('opens the project in Studio with the generation id and leaves the idea for Hermes', async () => {
      const { fake } = await openGeneration(finished({}), { 'workspace.open': () => ({ root: DEFAULT_TARGET, project: 'acme' }) });
      fireEvent.click(await screen.findByRole('button', { name: 'Abrir en Studio' }));
      await waitFor(() => expect(fake.requests.some((r) => r.cmd === 'workspace.open')).toBe(true));
      expect(fake.requests.find((r) => r.cmd === 'workspace.open')).toEqual({ cmd: 'workspace.open', generationId: 'gen-1' });
      expect(loadPendingIdea(window.sessionStorage)).toEqual(expect.any(String));
    });

    it('shows the error when opening is rejected', async () => {
      await openGeneration(finished({}), {
        'workspace.open': () => {
          throw new BridgeFailure('conflict', 'Hay agentes trabajando');
        },
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Abrir en Studio' }));
      expect(await screen.findByText('No se pudo completar la acción: Hay agentes trabajando')).toBeInTheDocument();
    });

    it('reveals the folder and copies the path', async () => {
      const { fake } = await openGeneration(finished({}), { 'wizard.reveal': () => null });
      fireEvent.click(await screen.findByRole('button', { name: 'Mostrar en el explorador' }));
      await waitFor(() => expect(fake.requests.find((r) => r.cmd === 'wizard.reveal')).toEqual({ cmd: 'wizard.reveal', generationId: 'gen-1' }));
      fireEvent.click(screen.getByRole('button', { name: 'Copiar ruta' }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(DEFAULT_TARGET));
      expect(await screen.findByRole('button', { name: 'Ruta copiada' })).toBeInTheDocument();
    });

    it('copies the whole log and toggles it', async () => {
      await openGeneration(finished({}), {}, [chunk(1, 'one\n'), chunk(2, 'two\n')]);
      const result = await resultView();
      expect(within(result).queryByRole('log')).not.toBeInTheDocument();
      fireEvent.click(within(result).getByRole('button', { name: 'Copiar log' }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith('one\ntwo\n'));
      fireEvent.click(within(result).getByRole('button', { name: 'Ver log completo' }));
      expect(within(result).getByRole('log')).toHaveTextContent('two');
    });
  });

  describe('generated with errors', () => {
    const gateFailed = () => finished({ status: 'gate-failed', gate: { validate: 'pass', build: 'fail' }, exitCode: 1, failure: { stage: 'build', kind: 'gate', message: 'build failed' } });

    it('says it in the title, shows the gate in red and still allows opening in Studio', async () => {
      await openGeneration(gateFailed());
      const result = await resultView();
      expect(result).toHaveAttribute('data-variant', 'gate-failed');
      expect(within(result).getByRole('heading', { name: 'Generado con errores' })).toBeInTheDocument();
      expect(result.querySelector('[data-gate-status="fail"]')).toHaveTextContent('lint, test y build: en rojo');
      expect(result.querySelector('[data-gate-status="pass"]')).toHaveTextContent('sdd:validate: en verde');
      expect(within(result).getByRole('button', { name: 'Abrir en Studio' })).toBeInTheDocument();
      expect(result).toHaveTextContent('el gate falló');
      expect(within(result).getByRole('button', { name: 'Editar y volver a intentar' })).toBeInTheDocument();
      expect(within(result).getByRole('log')).toBeInTheDocument();
    });
  });

  describe('failure before the project exists', () => {
    const failedInstall = () =>
      generationState({
        status: 'failed',
        exitCode: 1,
        hasSdd: false,
        failure: { stage: 'install', kind: 'network', message: 'ENOTFOUND' },
        stages: [
          { stage: 'prepare', status: 'done' },
          { stage: 'scaffold', status: 'done' },
          { stage: 'install', status: 'failed' },
          { stage: 'generate', status: 'skipped' },
          { stage: 'validate', status: 'skipped' },
          { stage: 'build', status: 'skipped' },
        ],
      });

    it('shows the failed stage, the exit code and the path, and never offers to open in Studio', async () => {
      await openGeneration(failedInstall());
      const result = await resultView();
      expect(result).toHaveAttribute('data-variant', 'failed');
      expect(within(result).getByRole('heading', { name: 'No se pudo generar el proyecto' })).toBeInTheDocument();
      expect(result).toHaveTextContent('No se pudieron instalar las dependencias (¿sin conexión?).');
      expect(result).toHaveTextContent('Etapa que falló: Instalando dependencias');
      expect(result).toHaveTextContent('Código de salida: 1');
      expect(result).toHaveTextContent(`Ruta: ${DEFAULT_TARGET}`);
      expect(result).toHaveTextContent('Studio no borra ni mueve nada');
      expect(result).toHaveTextContent('No se puede abrir en Studio: la generación terminó antes de crear la carpeta sdd/.');
      expect(within(result).queryByRole('button', { name: 'Abrir en Studio' })).not.toBeInTheDocument();
      expect(within(result).queryByRole('button', { name: /Reintentar instalación/ })).not.toBeInTheDocument();
      expect(document.querySelector('[data-stage="install"]')).toHaveAttribute('data-status', 'failed');
      expect(within(result).getByRole('log')).toBeInTheDocument();
    });

    it('does not offer to reveal a folder that could not even be prepared', async () => {
      await openGeneration(generationState({ status: 'failed', failure: { stage: 'prepare', kind: 'prepare', message: 'EACCES' }, hasSdd: false }));
      const result = await resultView();
      expect(within(result).queryByRole('button', { name: 'Mostrar en el explorador' })).not.toBeInTheDocument();
    });

    it('goes back to the summary with everything chosen when editing to retry', async () => {
      await openGeneration(failedInstall());
      fireEvent.click(await screen.findByRole('button', { name: 'Editar y volver a intentar' }));
      await screen.findByRole('article', { name: 'Resumen' });
      expect(document.querySelector('[data-summary-app="next-web"]')).toBeInTheDocument();
      expect(window.sessionStorage.getItem('sdd-studio:wizard:generation')).toBeNull();
    });

    it('goes back to the summary with an empty destination to generate in another folder', async () => {
      await openGeneration(failedInstall());
      fireEvent.click(await screen.findByRole('button', { name: 'Generar en otra carpeta' }));
      await screen.findByRole('article', { name: 'Resumen' });
      expect(screen.getByLabelText('Ruta de la carpeta')).toHaveValue('');
    });
  });

  describe('interrupted', () => {
    it('is shown as a failure by interruption', async () => {
      await openGeneration(generationState({ status: 'interrupted', hasSdd: true, failure: { stage: 'install', kind: 'signal', message: 'SIGKILL' } }));
      const result = await resultView();
      expect(result).toHaveAttribute('data-variant', 'interrupted');
      expect(within(result).getByRole('heading', { name: 'Generación interrumpida' })).toBeInTheDocument();
      expect(result).toHaveTextContent('El proceso se cortó por una señal externa.');
    });
  });
});

describe('English', () => {
  it('translates the result', async () => {
    preloadFullstack();
    pointTo(finished({}));
    renderWizard({ lang: 'en', fake: summaryClient({ 'wizard.generation.get': () => snapshot(finished({})) }) });
    const result = await screen.findByTestId('generation-result');
    expect(within(result).getByRole('heading', { name: 'Project generated' })).toBeInTheDocument();
    expect(within(result).getByRole('button', { name: 'Open in Studio' })).toBeInTheDocument();
  });
});
