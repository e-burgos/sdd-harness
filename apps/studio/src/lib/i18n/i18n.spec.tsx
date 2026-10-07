import { act, render, screen } from '@testing-library/react';
import { en } from './en';
import { es } from './es';
import { I18nProvider, detectLang, useT } from './i18n';

function Probe() {
  const { t, lang, setLang } = useT();
  return (
    <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
      {t('conn.unreachable', { port: 4320 })}
    </button>
  );
}

describe('i18n', () => {
  it('detects the language', () => {
    expect(detectLang('en-US', null)).toBe('en');
    expect(detectLang('es-AR', null)).toBe('es');
    expect(detectLang(undefined, null)).toBe('es');
    expect(detectLang('en-US', 'es')).toBe('es');
  });
  it('interpolates and switches language', () => {
    localStorage.clear();
    render(<I18nProvider initial="es"><Probe /></I18nProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('No hay un puente escuchando en el puerto 4320');
    act(() => screen.getByRole('button').click());
    expect(screen.getByRole('button')).toHaveTextContent('No bridge is listening on port 4320');
    expect(localStorage.getItem('sdd-studio:lang')).toBe('en');
  });
  it('has the bad-message connection key in both languages', () => {
    expect(es['conn.bad-message']).toContain('rechazó');
    expect(en['conn.bad-message']).toContain('rejected');
  });
});
