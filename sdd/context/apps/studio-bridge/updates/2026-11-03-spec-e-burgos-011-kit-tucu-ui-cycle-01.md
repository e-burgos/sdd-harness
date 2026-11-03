# apps/studio-bridge — spec-e-burgos-011-kit-tucu-ui · cycle-01

## Estado
`sdd/tools.json` admite la clave opcional `tucu_ui` (schema del kit). `kit-tools.ts` no cambia: valida con el schema y conserva la clave al escribir rtk, el mod o el gate; los specs de paridad y de schema cubren `tucu_ui`.

## Estructura
- Sin cambios de código; solo `kit-tools.parity.spec.ts` y `kit-tools.spec.ts`.

## Dependencias
- Sin cambios.

## Qué sigue
- Exponer el interruptor de tucu-ui en el módulo Kit de Studio (requiere correr `sdd-tucu.mjs`, no solo escribir el archivo).
