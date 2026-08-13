import { zodToJsonSchema } from 'zod-to-json-schema';
import { HarnessConfigSchema } from './schema.js';

export const CONFIG_SCHEMA_FILENAME = 'harness.config.schema.json';

/**
 * JSON Schema del config de `init --config`, derivado del schema zod (fuente
 * única). Permite a agentes y editores validar un harness.config.json sin
 * ejecutar la CLI — el contrato de la vía no interactiva es inspeccionable.
 */
export function buildConfigJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(HarnessConfigSchema, {
    $refStrategy: 'none',
  }) as Record<string, unknown>;
}
