# FIX-e-burgos-013-001 — CI de PR #64: reveal en Windows y timer de tucu-ui Select en jsdom

| Campo         | Valor |
| ------------- | ----- |
| **ID**        | FIX-e-burgos-013-001 |
| **Tipo**      | BUGFIX |
| **Severidad** | low |
| **Fecha**     | 2026-11-05 |
| **Autor**     | e-burgos |
| **Estado**    | implemented |
| **Spec**      | spec-e-burgos-013-studio-project-wizard |

## Problema

En el CI de PR #64 (head 1c103a2) fallaron los dos jobs:

- **windows-latest:** `reveal.spec.ts > opens a folder inside the allowed bases with the platform opener`. `revealPath` elegía la semántica de rutas (`posix`/`win32`) según la plataforma del abridor, así que con `platform: 'darwin'` sobre rutas `D:\…` reales rechazaba la carpeta como fuera de las bases.
- **ubuntu-latest:** todos los tests en verde, pero Vitest atrapó un error no manejado (`window is not defined`). El `Select` de tucu-ui 3.10.0 programa un `setTimeout` de 100 ms al cerrarse y no lo cancela al desmontar; en `threadlink.spec.tsx` se disparaba después de que jsdom se había desmontado.

## Solución

- `apps/studio-bridge/src/wizard/reveal.ts`: la semántica de rutas sale de `process.platform` (las rutas son del sistema de archivos real); `ctx.platform` solo elige el comando que abre la carpeta.
- `apps/studio/src/lib/test-utils/pick-option.ts`: `waitForSelectToClose()` espera el cierre del `Select`; los cuatro specs que abren selects lo usan en `afterEach`. El arreglo de fondo (cancelar el timer al desmontar) va al repo de tucu-ui.

## Archivos

- `apps/studio-bridge/src/wizard/reveal.ts`
- `apps/studio/src/lib/test-utils/pick-option.ts`
- `apps/studio/src/components/helpselect.spec.tsx`
- `apps/studio/src/components/workspace/modes.spec.tsx`
- `apps/studio/src/components/workspace/composer.spec.tsx`
- `apps/studio/src/components/workspace/threadlink.spec.tsx`

## Validación

Local: `pnpm typecheck`, bridge 953 y Studio 1189 tests sin errores no manejados. Pendiente: CI de PR #64 en `ubuntu-latest` y `windows-latest`.
