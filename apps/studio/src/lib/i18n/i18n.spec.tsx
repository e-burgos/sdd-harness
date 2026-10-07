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
  it('keeps <html lang> in sync with the selected language', () => {
    localStorage.clear();
    render(<I18nProvider initial="es"><Probe /></I18nProvider>);
    expect(document.documentElement.lang).toBe('es');
    act(() => screen.getByRole('button').click());
    expect(document.documentElement.lang).toBe('en');
  });
  it('has the bad-message connection key in both languages', () => {
    expect(es['conn.bad-message']).toContain('rechazó');
    expect(en['conn.bad-message']).toContain('rejected');
  });
  it('falls back to the key for unknown entries', () => {
    function Unknown() {
      const { t } = useT();
      return <span>{t('nope.missing' as keyof typeof es)}</span>;
    }
    render(<I18nProvider initial="es"><Unknown /></I18nProvider>);
    expect(screen.getByText('nope.missing')).toBeInTheDocument();
  });
  it('has the same placeholders in es and en for every key', () => {
    const holders = (v: string) => [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      expect(holders(en[key]), key).toEqual(holders(es[key]));
    }
  });

  it('renders es on the first pass and applies the detected language after effects', async () => {
    localStorage.clear();
    const spy = vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    const seen: string[] = [];
    function Rec() {
      seen.push(useT().lang);
      return null;
    }
    render(<I18nProvider><Rec /></I18nProvider>);
    spy.mockRestore();
    expect(seen[0]).toBe('es');
    expect(seen.at(-1)).toBe('en');
  });
});
