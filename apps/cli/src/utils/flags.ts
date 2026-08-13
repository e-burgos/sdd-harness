import { logger } from './logger.js';

/**
 * Parsea un flag "a,b,c" contra su lista de valores válidos.
 *
 * Cada multiselect de @clack tiene su flag equivalente para que un agente pueda
 * correr el comando sin TTY: los prompts no son respondibles por stdin (clack
 * concatena el texto piped al valor inicial y nunca envía).
 */
export function parseListFlag(
  raw: string,
  allowed: readonly string[],
  flag: string,
): string[] {
  const values = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (values.length === 0) {
    logger.error(`${flag} needs at least one value — valid: ${allowed.join(', ')}.`);
    process.exit(1);
  }

  const unknown = values.filter((v) => !allowed.includes(v));
  if (unknown.length > 0) {
    logger.error(
      `Unknown value for ${flag}: ${unknown.join(', ')} — valid: ${allowed.join(', ')}.`,
    );
    process.exit(1);
  }

  return [...new Set(values)];
}
