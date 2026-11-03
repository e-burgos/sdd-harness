# apps/studio — spec-e-burgos-009-studio-tucu-ui · cycle-07

## Estado
Studio usa `@e-burgos/tucu-ui` 3.10.0. Alert, Tooltip, Badge, ConfirmDialog, Button y los campos con `color` toman sus tonos de los tokens `--tucu-*` (grupo «Tones») en `@layer components`; Studio no tenía overrides con `!` ni variantes `dark:` sobre ellos, así que no hubo nada que borrar ni tokens que pisar.

## Estructura
- Sin cambios de código: solo la dependencia.
- Si Studio necesita un tono propio, se pisa el token «Tones» en `globals.css`, nunca con `!` en el `className`.

## Dependencias
- `@e-burgos/tucu-ui` 3.9.1 → 3.10.0 (exacta).

## Qué sigue
- Sin pendientes de la adopción.
