import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { EventRows, formatWhen } from './channel-sections';

const AT = '2026-03-04T15:30:00.000Z';

describe('channel section dates', () => {
  it('formats with the language it is given, not the browser locale', () => {
    expect(formatWhen(AT, 'es')).toBe(new Date(AT).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }));
    expect(formatWhen(AT, 'en')).toBe(new Date(AT).toLocaleString('en', { dateStyle: 'short', timeStyle: 'short' }));
    expect(formatWhen(AT, 'es')).not.toBe(formatWhen(AT, 'en'));
    expect(formatWhen(undefined, 'es')).toBe('');
  });

  it.each(['es', 'en'] as const)('shows the event time in %s', (lang) => {
    render(
      <I18nProvider initial={lang}>
        <EventRows events={[{ channelId: 'general', botKind: 'tools.changed', at: AT, payload: { tool: 'rtk', from: true, to: false } }] as never} emptyText="vacío" />
      </I18nProvider>,
    );
    expect(screen.getByText(formatWhen(AT, lang))).toBeInTheDocument();
  });
});
