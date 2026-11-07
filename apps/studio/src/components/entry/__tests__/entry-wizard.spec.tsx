import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { EntryWizard, type EntryWizardProps } from '../EntryWizard';
import { ENTRY_STORAGE_KEY } from '../entry-storage';

const TOKEN = 'abcDEF123_-xyz7890';
const SITE_LINK = `${window.location.origin}/w#bridge=4455&token=${TOKEN}`;
const LOCAL_LINK = `http://127.0.0.1:4455/w/#bridge=4455&token=${TOKEN}`;

function renderWizard(props: EntryWizardProps = {}, lang: 'es' | 'en' = 'es') {
  return render(
    <I18nProvider initial={lang}>
      <EntryWizard {...props} />
    </I18nProvider>,
  );
}

function mockMatchMedia(matches: (query: string) => boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

const heading = (name: string | RegExp) => screen.getByRole('heading', { level: 1, name });
const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Siguiente|Ir a conectar)$/ }));

function goToConnect(path: 'Proyecto nuevo' | 'Repo que ya tengo') {
  fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
  fireEvent.click(screen.getByRole('radio', { name: path }));
  next();
  next();
  next();
}

describe('EntryWizard', () => {
  beforeEach(() => sessionStorage.clear());

  it('opens on a welcome that explains Studio, with one primary action', () => {
    renderWizard();
    expect(heading('De una idea a un proyecto construido con agentes de IA')).toBeInTheDocument();
    expect(screen.getByText(/paso a paso con el método SDD/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ya tengo el puente corriendo' })).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: /agentes del ciclo SDD/ })).toBeInTheDocument();
    expect(screen.queryByText('npx @e-burgos/sdd-studio')).toBeNull();
  });

  it('walks the guided path step by step and back', async () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(heading('¿Cómo querés empezar?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled();
    expect(screen.getByText('Elegí un camino para seguir.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Proyecto nuevo' }));
    expect(screen.getByText('Paso 2 de 5')).toHaveAttribute('aria-live', 'polite');
    next();
    expect(heading('Lo que necesitás')).toBeInTheDocument();
    next();
    expect(heading('Lo que viene dentro de Studio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ir a conectar/ })).toBeInTheDocument();
    next();
    expect(heading('Conectá Studio con tu máquina')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Siguiente|Ir a conectar/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Atrás/ }));
    expect(heading('Lo que viene dentro de Studio')).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(heading('Lo que viene dentro de Studio')));
  });

  it('jumps back to a completed step from the progress indicator', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Repo que ya tengo' }));
    next();
    const progress = screen.getByRole('navigation', { name: 'Progreso del asistente' });
    expect(within(progress).getByRole('button', { name: 'Requisitos' })).toHaveAttribute('aria-current', 'step');
    expect(within(progress).getByRole('button', { name: 'Conectar' })).toBeDisabled();
    fireEvent.click(within(progress).getByRole('button', { name: 'Camino (completado)' }));
    expect(heading('¿Cómo querés empezar?')).toBeInTheDocument();
  });

  it('shows the commands of a new project', () => {
    renderWizard();
    goToConnect('Proyecto nuevo');
    const commands = screen.getByRole('list', { name: 'Comandos para tu camino' });
    expect(within(commands).getByText('mkdir mi-proyecto && cd mi-proyecto')).toBeInTheDocument();
    expect(within(commands).getByText('npx @e-burgos/sdd-studio')).toBeInTheDocument();
    expect(within(commands).queryByText('npx @e-burgos/sdd-harness configure sdd')).toBeNull();
    expect(screen.getByText('La terminal abre Studio en tu navegador, ya conectado.')).toBeInTheDocument();
    expect(screen.getByText('npx @e-burgos/sdd-harness init --terminal')).toBeInTheDocument();
  });

  it('shows the commands of an existing repo and the install docs', () => {
    renderWizard();
    goToConnect('Repo que ya tengo');
    const commands = screen.getByRole('list', { name: 'Comandos para tu camino' });
    expect(within(commands).getByText('npx @e-burgos/sdd-harness configure sdd')).toBeInTheDocument();
    expect(within(commands).getByText('npx @e-burgos/sdd-studio')).toBeInTheDocument();
    expect(within(commands).getByText(/raíz del repo/)).toBeInTheDocument();
    expect(within(commands).queryByText('mkdir mi-proyecto && cd mi-proyecto')).toBeNull();
    const docs = screen.getByRole('link', { name: /Cómo instalar SDD Harness/ });
    expect(docs).toHaveAttribute('href', 'https://sdd.estebanburgos.com.ar');
    expect(docs).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('goes straight to connect when the bridge is already running', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Ya tengo el puente corriendo' }));
    expect(heading('Conectá Studio con tu máquina')).toBeInTheDocument();
    expect(screen.getByText('Paso 3 de 3')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Pegá el enlace que imprimió la terminal' })).toBeInTheDocument();
    expect(screen.queryByText('mkdir mi-proyecto && cd mi-proyecto')).toBeNull();
  });

  it('moves between the doors with the arrow keys and remembers the choice', () => {
    const { unmount } = renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    const group = screen.getByRole('radiogroup', { name: 'Punto de partida' });
    const doors = within(group).getAllByRole('radio');
    expect(doors.map((door) => door.tabIndex)).toEqual([0, -1, -1]);
    expect(within(group).getByText('Recomendado')).toBeInTheDocument();
    fireEvent.keyDown(doors[0]!, { key: 'ArrowRight' });
    expect(doors[1]).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(doors[1]);
    fireEvent.keyDown(doors[1]!, { key: 'End' });
    expect(doors[2]).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(doors[2]!, { key: 'ArrowRight' });
    expect(doors[0]).toHaveAttribute('aria-checked', 'true');
    expect(JSON.parse(sessionStorage.getItem(ENTRY_STORAGE_KEY) ?? '{}')).toMatchObject({ path: 'new' });
    unmount();
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(screen.getByRole('radio', { name: 'Proyecto nuevo' })).toHaveAttribute('aria-checked', 'true');
  });

  it('guides the requirements without blocking', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Proyecto nuevo' }));
    next();
    const node = screen.getByRole('article', { name: 'Node 20 o superior' });
    expect(within(node).getByText('node -v')).toBeInTheDocument();
    const download = within(node).getByRole('link', { name: /nodejs\.org/ });
    expect(download).toHaveAttribute('href', 'https://nodejs.org');
    expect(download).toHaveAttribute('target', '_blank');
    const claude = screen.getByRole('article', { name: 'Claude Code con sesión iniciada' });
    expect(within(claude).getByText('claude')).toBeInTheDocument();
    expect(within(claude).getByText('/login')).toBeInTheDocument();
    expect(within(claude).getByText(/ANTHROPIC_API_KEY antes de levantar/)).toBeInTheDocument();
    expect(screen.getByText(/0 de 2 listos/)).toBeInTheDocument();
    fireEvent.click(within(node).getByRole('checkbox', { name: 'Lo tengo' }));
    expect(screen.getByText(/1 de 2 listos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  });

  it.each([[SITE_LINK], [LOCAL_LINK]])('opens the pasted bridge link %s in this tab', (link) => {
    const navigate = vi.fn();
    renderWizard({ navigate });
    fireEvent.click(screen.getByRole('button', { name: 'Ya tengo el puente corriendo' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Pegá el enlace que imprimió la terminal' }), { target: { value: link } });
    fireEvent.click(screen.getByRole('button', { name: /Abrir Studio/ }));
    expect(navigate).toHaveBeenCalledWith(link);
  });

  it.each([
    ['https://evil.example/w#bridge=4455&token=abcDEF123_-xyz7890', 'no es de este sitio'],
    ['http://127.0.0.1:4455/w/#bridge=4455', 'No parece un enlace del puente'],
    ['', 'Pegá el enlace completo'],
  ])('rejects %s without navigating', (link, message) => {
    const navigate = vi.fn();
    renderWizard({ navigate });
    fireEvent.click(screen.getByRole('button', { name: 'Ya tengo el puente corriendo' }));
    const input = screen.getByRole('textbox', { name: 'Pegá el enlace que imprimió la terminal' });
    fireEvent.change(input, { target: { value: link } });
    fireEvent.click(screen.getByRole('button', { name: /Abrir Studio/ }));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('opens on the connect step with the error and the help expanded when the connection failed', () => {
    renderWizard({ error: 'El token no es válido.' });
    expect(heading('Conectá Studio con tu máquina')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('El token no es válido.');
    expect(screen.getByRole('button', { name: /bloquea la conexión/ })).toHaveAttribute('aria-expanded', 'true');
    const help = screen.getByRole('region', { name: /bloquea la conexión/ });
    expect(help).toHaveTextContent('Chrome');
    expect(within(help).getByText('npx @e-burgos/sdd-studio --local-ui')).toBeInTheDocument();
  });

  it('keeps the blocked-connection help folded until asked without an error', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Ya tengo el puente corriendo' }));
    const toggle = screen.getByRole('button', { name: /bloquea la conexión/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('npx @e-burgos/sdd-studio --local-ui')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText('npx @e-burgos/sdd-studio --local-ui')).toBeInTheDocument();
  });

  it('ignores Escape so nothing is lost', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Repo que ya tengo' }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(heading('¿Cómo querés empezar?')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Repo que ya tengo' })).toHaveAttribute('aria-checked', 'true');
  });

  it('copies a command with its own button', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderWizard();
    goToConnect('Repo que ya tengo');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar: npx @e-burgos/sdd-harness configure sdd' }));
    await screen.findByRole('button', { name: 'Copiado: npx @e-burgos/sdd-harness configure sdd' });
    expect(writeText).toHaveBeenCalledWith('npx @e-burgos/sdd-harness configure sdd');
  });

  it('switches to English', () => {
    renderWizard({}, 'en');
    expect(heading('From an idea to a project built with AI agents')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Español' }));
    expect(heading('De una idea a un proyecto construido con agentes de IA')).toBeInTheDocument();
  });

  describe('motion', () => {
    let restore: () => void = () => undefined;
    afterEach(() => restore());

    it('renders a static backdrop and plain titles with reduced motion', () => {
      restore = mockMatchMedia((query) => query.includes('reduce') || query.includes('min-width'));
      renderWizard();
      expect(screen.queryByTestId('seam-canvas')).toBeNull();
      const title = heading('De una idea a un proyecto construido con agentes de IA');
      expect(title.querySelectorAll('span')).toHaveLength(0);
      fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
      expect(heading('¿Cómo querés empezar?')).toBeInTheDocument();
    });

    it('mounts the animated layers on wide screens without crashing when WebGL is missing', async () => {
      restore = mockMatchMedia((query) => query.includes('min-width'));
      const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
      renderWizard();
      expect(await screen.findByTestId('seam-canvas')).toBeInTheDocument();
      expect(heading('De una idea a un proyecto construido con agentes de IA')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
      expect(await screen.findByRole('heading', { level: 1, name: '¿Cómo querés empezar?' })).toBeInTheDocument();
      getContext.mockRestore();
    });
  });
});
