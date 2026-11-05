import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { GenerationState } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createSeamShader } from '@/lib/motion/seam-shader';
import { useMotionAllowed } from '@/lib/motion/use-motion-allowed';
import { StageList } from '../GenerationProgress';
import { renderWizard } from './harness';

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

async function ready() {
  renderWizard();
  await screen.findByRole('radiogroup', { name: 'Alcance del proyecto' });
}

const fillScale = (testId: string) => screen.getByTestId(testId).style.transform;

describe('wizard motion', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('renders the scope doors as radios over a static backdrop when motion is not allowed', async () => {
    await ready();
    expect(screen.queryByTestId('seam-canvas')).not.toBeInTheDocument();
    const doors = screen.getByTestId('scope-doors');
    expect(['scope-front', 'scope-back', 'scope-fullstack'].map((id) => screen.getByTestId(id).getAttribute('role'))).toEqual(['radio', 'radio', 'radio']);
    expect(screen.getByRole('radio', { name: 'Solo back' })).toHaveAccessibleDescription('Solo la API o los servicios. Conviene cuando el front ya existe o todavía no hace falta.');
    expect(screen.getByRole('radio', { name: 'Full stack' })).toBe(screen.getByTestId('scope-fullstack'));
    fireEvent.click(screen.getByTestId('scope-back'));
    expect(doors.dataset.selected).toBe('back');
    expect(screen.getByTestId('scope-back')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('scope-front')).toHaveAttribute('aria-checked', 'false');
  });

  it('fills the progress rail up to the current step and moves focus to the new step title', async () => {
    await ready();
    expect(fillScale('wizard-progress-fill')).toBe('scaleY(0)');
    fireEvent.click(screen.getByTestId('scope-fullstack'));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(fillScale('wizard-progress-fill')).toBe('scaleY(0.2)');
    await waitFor(() => expect(document.activeElement?.tagName).toBe('H1'));
    expect(document.activeElement).toHaveTextContent('Forma');
  });

  it('announces the step position politely', async () => {
    await ready();
    expect(screen.getByText('Paso 1 de 6')).toHaveAttribute('aria-live', 'polite');
  });
});

describe('useMotionAllowed', () => {
  it('allows motion on wide screens without reduced motion', () => {
    const restore = mockMatchMedia((query) => query.includes('min-width'));
    const { result } = renderHook(() => useMotionAllowed(1024));
    expect(result.current).toBe(true);
    restore();
  });

  it('turns motion off when the user prefers reduced motion', () => {
    const restore = mockMatchMedia(() => true);
    const { result } = renderHook(() => useMotionAllowed(1024));
    expect(result.current).toBe(false);
    restore();
  });

  it('turns motion off on narrow screens', () => {
    const restore = mockMatchMedia(() => false);
    const { result } = renderHook(() => useMotionAllowed(1024));
    expect(result.current).toBe(false);
    restore();
  });
});

describe('createSeamShader', () => {
  it('returns null when the browser has no WebGL so the stage keeps its CSS backdrop', () => {
    const canvas = document.createElement('canvas');
    canvas.getContext = (() => null) as typeof canvas.getContext;
    expect(createSeamShader(canvas, { split: 0.5, mouseX: 0.5, mouseY: 0.5, hover: 0 })).toBeNull();
  });
});

describe('StageList', () => {
  const stages: GenerationState['stages'] = [
    { stage: 'prepare', status: 'done' },
    { stage: 'scaffold', status: 'done' },
    { stage: 'install', status: 'active' },
    { stage: 'generate', status: 'pending' },
    { stage: 'validate', status: 'pending' },
    { stage: 'build', status: 'pending' },
  ];

  it('fills the stage bar with the settled stages and keeps every stage with its status', () => {
    render(
      <I18nProvider initial="es">
        <StageList stages={stages} />
      </I18nProvider>,
    );
    expect(fillScale('stage-progress-fill')).toBe(`scaleX(${2 / 6})`);
    expect(document.querySelector('[data-stage="install"]')).toHaveAttribute('aria-current', 'step');
    expect([...document.querySelectorAll('[data-stage]')].map((item) => item.getAttribute('data-status'))).toEqual(['done', 'done', 'active', 'pending', 'pending', 'pending']);
  });
});
