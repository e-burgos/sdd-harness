import { randomBytes, timingSafeEqual } from 'node:crypto';

export const createToken = (): string => randomBytes(32).toString('base64url');

export function tokensMatch(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Sin Origin (cliente no navegador) se acepta: el token sigue siendo obligatorio. */
export function originAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return true;
  return allowed.some((pattern) =>
    pattern.endsWith(':*')
      ? new RegExp(`^${escapeRe(pattern.slice(0, -2))}(:\\d{1,5})?$`).test(origin)
      : pattern === origin,
  );
}
