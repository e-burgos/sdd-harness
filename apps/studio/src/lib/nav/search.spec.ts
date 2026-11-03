import { matchesQuery, normalizeSearch } from './search';

describe('matchesQuery', () => {
  it('ignores case and accents', () => {
    expect(normalizeSearch('  Métricas ')).toBe('metricas');
    expect(matchesQuery('METRICAS', 'Métricas del ciclo')).toBe(true);
    expect(matchesQuery('arquitectura', 'Arquitéctura')).toBe(true);
  });

  it('matches any field and ignores null fields', () => {
    expect(matchesQuery('pagos', null, undefined, 'spec-dev-001-pagos')).toBe(true);
    expect(matchesQuery('zzz', 'a', null)).toBe(false);
  });

  it('matches everything on an empty query', () => {
    expect(matchesQuery('   ', 'x')).toBe(true);
    expect(matchesQuery('', null)).toBe(true);
  });
});
