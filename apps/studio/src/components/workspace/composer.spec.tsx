import { fireEvent, render, screen } from '@testing-library/react';
import { defaultThreadOptions } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { ComposerView } from './Composer';

function setup(extra: Partial<React.ComponentProps<typeof ComposerView>> = {}) {
  const onSubmit = vi.fn();
  const onOptionsChange = vi.fn();
  render(
    <I18nProvider initial="es">
      <ComposerView
        options={defaultThreadOptions()} onOptionsChange={onOptionsChange} onSubmit={onSubmit}
        agents={['sdd-orchestrator', 'sdd-planner']} agentLocked={false} error={null} {...extra}
      />
    </I18nProvider>,
  );
  return { onSubmit, onOptionsChange, box: screen.getByPlaceholderText('Escribí un mensaje… (/ para comandos)') };
}

describe('ComposerView', () => {
  it('sends on Enter, keeps Shift+Enter as newline and clears', () => {
    const { onSubmit, box } = setup();
    fireEvent.change(box, { target: { value: 'hola' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('hola');
    expect(box).toHaveValue('');
  });
  it('disables effort when the model is kit and enables it otherwise', () => {
    const { onOptionsChange } = setup();
    expect(screen.getByLabelText('Esfuerzo')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'opus' } });
    expect(onOptionsChange).toHaveBeenCalledWith({ model: 'opus', effort: 'medium' });
  });
  it('locks the agent selector in DMs', () => {
    setup({ agentLocked: true });
    expect(screen.getByLabelText('Agente')).toBeDisabled();
  });
  it('shows a composer error', () => {
    setup({ error: 'Comando desconocido: nope' });
    expect(screen.getByRole('alert')).toHaveTextContent('Comando desconocido: nope');
  });
});
