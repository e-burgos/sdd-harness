const COMBINING_MARKS = /[̀-ͯ]/g;

export const normalizeSearch = (text: string): string => text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim();

export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = normalizeSearch(query);
  if (needle === '') return true;
  return fields.some((field) => field != null && normalizeSearch(field).includes(needle));
}
