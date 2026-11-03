export function formatFixDate(iso: string | null | undefined, lang: string): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: /T\d/.test(iso) ? 'short' : undefined }).format(new Date(time));
}
