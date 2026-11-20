# FIX-e-burgos-013 — claude-inventory.spec no falla al limpiar su carpeta temporal

## Problema
El `afterEach` de `claude-inventory.spec.ts` borra el tmpdir mientras una escritura atómica de la sonda (temporal + rename) puede seguir en curso: `rm` falla con `ENOTEMPTY` en algunas corridas.

## Solución aplicada
- El borrado del tmpdir reintenta (`maxRetries`, `retryDelay`).

### Archivos modificados
- `apps/studio-bridge/src/workspace/claude-inventory.spec.ts`
