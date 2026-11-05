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

- **windows-latest (segunda corrida, 340ba39):** `steps-1-3.spec.tsx > confirms before a mode change…` no encontraba el paso «Forma». Al cargar el catálogo el wizard se ubica en el paso restaurado dentro de un efecto; en el runner lento ese efecto corría después del click del test y volvía al paso guardado.

## Solución

- `apps/studio-bridge/src/wizard/reveal.ts`: la semántica de rutas sale de `process.platform` (las rutas son del sistema de archivos real); `ctx.platform` solo elige el comando que abre la carpeta.
- `apps/studio/src/lib/test-utils/pick-option.ts`: `waitForSelectToClose()` espera el cierre del `Select`; los cuatro specs que abren selects lo usan en `afterEach`. El arreglo de fondo (cancelar el timer al desmontar) va al repo de tucu-ui.

- `wizard-context.tsx` expone `positioned` y `NewProjectCenter.tsx` no muestra ningún paso hasta que el wizard se ubicó en el paso restaurado: el usuario ya no ve el paso inicial un instante ni puede perder un click contra el posicionamiento. Era una carrera real del producto, que el runner lento de Windows dejó a la vista (tercera corrida, d22c6dd: `steps-4-6.spec.tsx > applies nothing when the user cancels…`).
- `openStep` de `steps-1-3.spec.tsx` y `steps-4-6.spec.tsx` repite el click dentro de `waitFor` hasta que el paso pedido esté abierto.

## Archivos

- `apps/studio-bridge/src/wizard/reveal.ts`
- `apps/studio/src/components/modules/new-project/wizard-context.tsx`
- `apps/studio/src/components/modules/new-project/NewProjectCenter.tsx`
- `apps/studio/src/lib/test-utils/pick-option.ts`
- `apps/studio/src/components/helpselect.spec.tsx`
- `apps/studio/src/components/workspace/modes.spec.tsx`
- `apps/studio/src/components/workspace/composer.spec.tsx`
- `apps/studio/src/components/workspace/threadlink.spec.tsx`
- `apps/studio/src/components/modules/new-project/__tests__/steps-1-3.spec.tsx`
- `apps/studio/src/components/modules/new-project/__tests__/steps-4-6.spec.tsx`

## Validación

Local: `pnpm typecheck`, bridge 953 y Studio 1189 tests sin errores no manejados. Pendiente: CI de PR #64 en `ubuntu-latest` y `windows-latest`.
